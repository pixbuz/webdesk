import { log, ApplicationManifest, LookupEntry, ApplicationModule, ThinResponse, WrappedRequest, proxyIt, CacheEntry, ApplicationCommand } from "@utils/mod.ts"
import * as yaml from "@std/yaml"
import { easyResponse } from "@server/mod.ts";

const settings = {
	appCache: {
		enable: false,
		maxFiles: 5
	},
	manifestsFolder: "manifests/",
	assetsFolder: "applications/",
	// ^ If modified remember to change deno.json "imports" -> "@apps" to the same value
	servicesFolder: "services/",
	freezeInstances: true,
} as const

interface Application extends ApplicationManifest {}

class Cache {
	private readonly entries: Record<string, CacheEntry> = {}

	public add(pathname: string, response: ThinResponse) {
		if (!settings.appCache.enable) return log.dbug(`Cache disabled: skipping application "${this.appName}" at "${pathname}"`)
		
		const size = (response.content as string).length ?? 0
		if (!this.entries[pathname]) this.entries[pathname] = { points: 0, size }

		this.entries[pathname].points++
		this.entries[pathname].size = size

		const topFiles = Object.entries(this.entries)
			.sort(([ _pathnameA, { points: pointsA, size: sizeA } ], [ _pathnameB, { points: pointsB, size: sizeB } ]) => {
				if (pointsB !== pointsA) return pointsB - pointsA
				return sizeB - sizeA
			})
			.slice(0, settings.appCache.maxFiles)
			.map(([path]) => path)

		if (topFiles.includes(pathname)) {
			log.info(`Cached "${pathname}" for application "${this.appName}" (${size} bytes)`)
			this.entries[pathname].response = response
		}

		for (const key in this.entries) if (this.entries[key].response && !topFiles.includes(key)) delete this.entries[key].response
	}

	public serve(pathname: string) {
		if (!settings.appCache.enable) return log.dbug(`Cache disabled: skipping serve of asset "${pathname}" for application "${this.appName}"`)
		
		log.verb(`Serving asset "${pathname}" for application "${this.appName}"`)
		log.dbug(`Cached entries for application "${this.appName}":`, Object.fromEntries(
			Object.entries(this.entries)
				.filter(([_pathname, entry ]) => entry.response)
				.map(([ pathname, entry ]) => [pathname, { ...entry, response: "Cached" }])
		))
		if (this.entries[pathname] && this.entries[pathname].response) return this.entries[pathname].response
		log.verb(`Cache MISS for application "${this.appName}" asset "${pathname}"`)
		return false
	}
	
	constructor(public readonly domain: string, private readonly appName: string) {}
}

class Application {
	private readonly lookup: Record<string, LookupEntry> = { }
	private readonly conflicts: string[] = [ ]
	
	private cache: Cache
	private service: Service

	private addRoute(pathname: string, value: LookupEntry): void {
		const existing = this.lookup[pathname]
		let safePathname = pathname
		
		log.dbug(`Adding endpoint "${pathname}" to application "${this.name}". Current lookup table: { ${Object.keys(this.lookup).join(", ")} }`)
		if (value.type === "command") this.lookup[pathname] = value
		else if (this.conflicts.includes(pathname)) {
			log.verb(`Endpoint "${pathname}" marked as conflicting. Appending extension to new asset!`)
			this.lookup[safePathname = pathname + value.extension] = value
		} else if (existing) {
			this.conflicts.push(pathname)
			log.warn(`Conflict at "${pathname}" in application "${this.name}"! Appending extension to current and future endpoints!`)
			
			delete this.lookup[pathname]
			
			this.addRoute(pathname, existing)
			return this.addRoute(pathname, value)
		} else this.lookup[pathname] = value
		
		const target = value.type === "file" ? `file "${value.path}"` : "command"
		log.verb(`Application "${this.name}" is now serving ${target} at endpoint "${safePathname}"`)
	}
	private async populateAssetsLookupTable(leaf: string = this.folder) {
		const ignores = [ ...this.backend.modules ]
		const routeKeys = Object.keys(this.frontend.routes)
			.filter(key => key !== "/" && key.trim() !== "")
		const maskRegex = routeKeys.length > 0
			? new RegExp(routeKeys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|"))
			: null
		
		log.dbug(`Indexing folder "${leaf}/" for application "${this.name}" (ignore list is ${ignores.join(", ")})`)
		for await (const { name, isFile, isDirectory } of Deno.readDir(settings.assetsFolder + leaf)) {
			const relativePath = leaf + "/" + name
			const absolutePath = settings.assetsFolder + relativePath
			const defaultPathname = relativePath.slice(this.folder.length)
			log.dbug(`Indexing file "${name}": rel path "${relativePath}"; abs path "${absolutePath}"; pathname "${defaultPathname}"`)
			if (name.startsWith("_")) {
				log.verb(`Skipping file "${relativePath}" in application "${this.name}" (prefix)`)
				continue
			} else if (ignores.includes(defaultPathname)) {
				log.verb(`Skipping file "${relativePath}" in application "${this.name}" (ignored)`)
				continue
			} else if (isDirectory) {
				log.dbug(`Starting worker for folder "${name}" in application "${this.name}"`)
				this.populateAssetsLookupTable(relativePath)
			} else if (isFile) {
				const [_, stripped, extension = ""] = defaultPathname.match(/^(.*?)(\.[^.\/]+)?$/)!
				const mime = MIMES[extension.slice(1) as keyof typeof MIMES] || "application/octet-stream"
				const { size } = await Deno.stat(absolutePath)
				let pathname = this.frontend.routes[defaultPathname]
				
				if (!pathname) pathname = maskRegex ? stripped.replace(maskRegex, match => this.frontend.routes[match] || "") : stripped
				
				this.addRoute(pathname, { path: absolutePath, extension, type: "file", mime, size, })
			}
		}
	}
	private importModules() {
		if (this.backend.modules.length <= 0) return log.verb(`Application "${this.name}" has no backend modules to import`)
		this.backend.modules.forEach(async moduleFile => {
			try {
				// Dynamically import it
				const module = await import(`@apps/${this.folder}${moduleFile}`) as Partial<ApplicationModule>
				// Use the exported map object to add the routes to the commands (pathname -> Function)
				for (const [ pathname, callback ] of Object.entries(module.map || {})) this.addRoute(pathname, { type: "command", callback: callback as ApplicationCommand, name: callback.name, })
			} catch (error) { log.warn(`Failed to import module "${moduleFile}" for application "${this.name}":\n${(error as Error).stack}`) }
		})
	}
	private normalizeManifestProprieties(manifest: ApplicationManifest) {
		// Ensure files have an absolute file path from the app root
		if (!this.frontend.index.startsWith("/")) this.frontend.index = "/" + this.frontend.index
		if (!this.frontend.icon.startsWith("/")) this.frontend.icon = "/" + this.frontend.icon
		
		if (manifest.backend.modules.length > 0) this.backend.modules = manifest.backend.modules.map(module => module.startsWith("/") ? module : "/" + module)
		
		// Set pathnames of main app assets
		this.frontend.routes = { [this.frontend.index]: "/", [this.frontend.icon]: "/icon" }
		
		// For each route, prefix the pathname and file with a /
		// TODO: Is this reversed? (file -> pathname instead of pathname -> file)
		for (let [ file, pathname ] of Object.entries(manifest.frontend.routes || {})) {
			if (!file.startsWith("/")) file = "/" + file
			if (!pathname.startsWith("/")) pathname = "/" + pathname
			this.frontend.routes[file] = pathname
		}
	}
	private async executeCommand(request: Request, callback: ApplicationCommand) {
		try {
			const result = (await callback(request)) || {}
			if (result instanceof Response) {
				log.info(`Application "${this.name}" successfully executed command "${callback.name}" (returned Response)`)
				return { content: result, code: 0, mime: "", bypass: true }
			}
			const cleanResult = { content: result.content || "", code: result.code || 200, mime: result.mime || "text/plain" }
			log.info(`Application "${this.name}" successfully executed command "${callback.name}" ${(cleanResult.content as string).length || "???"} bytes`)
			return cleanResult
		} catch (error) {
			log.warn(`Error executing command "${callback.name}" for application "${this.name}":\n${(error as Error).stack}`)
			return { content: `Internal Server Error:\n${(error as Error).stack}`, code: 500, mime: "text/plain" }
		}
	}
	private async readFile(path: string, mime: string) {
		try {
			const content = await Deno.readFile(path)
			log.verb(`Application "${this.name}" successfully read file "${path}" (${content.length} bytes)`)
			return { content, code: 200, mime }
		} catch (error) {
			log.warn(`Error reading file "${path}" for application "${this.name}":\n${(error as Error).stack}`)
			return { content: `Internal Server Error:\n${(error as Error).stack}`, code: 500, mime: "text/plain" }
		}
	}

	public replyer = async ({ pathname, request }: WrappedRequest) => {
		const asset = this.lookup[pathname]
		const cacheResult = this.cache.serve(pathname)
		let response: ThinResponse

		log.info(`Application "${this.name}" handling request for "${pathname}"`)
		if (cacheResult) {
			log.verb(`Cache HIT for application "${this.name}" asset "${pathname}"`)
			response = cacheResult
		} else if (!asset) {
			log.verb(`Asset "${pathname}" not found in application "${this.name}"`)
			response = { content: `No file at ${pathname}`, code: 404, mime: "text/plain" }
			log.dbug(`Skipping cache for 404 response on asset "${pathname}" in application "${this.name}"`)
		} else if (asset.type === "file") {
			log.verb(`Application "${this.name}" replied with ${asset.mime} for "${pathname}"`)
			response = await this.readFile(asset.path, asset.mime)
		} else /* if (asset.type === "command") */ {
			log.info(`Application "${this.name}" executing command "${asset.name}" for request "${pathname}"`)
			response = await this.executeCommand(request, asset.callback)
		}

		if (asset) this.cache.add(pathname, response as ThinResponse)
		// TODO: Command caching
		
		// log.dbug(`Application "${this.name}" replying to request for "${pathname}" with`, response)
		return response
	}
	public constructor(private readonly folder: string, manifest: ApplicationManifest) {
		Object.assign(this, manifest)

		log.dbug(`Registring application "${this.name}"`)
		applications[this.domain] = this
		
		this.normalizeManifestProprieties(manifest)
		if (exists(`${settings.assetsFolder}${folder}`)) this.populateAssetsLookupTable()
		this.importModules()
		
		this.service = new Service(folder, this.domain, this.name)
		this.cache = new Cache(this.domain, this.name)
		
		log.info(`Registred application "${this.name}" on domain "${this.domain}" (level ${this.backend.level})`)
		if (settings.freezeInstances) Object.freeze(this)
	}
}

class Service {
	public static readonly scripts: string[] = [ ]
	private readonly pathnames: Record<string, string> = { }
	
	private async indexServicesPathnames(leaf: string = "") {
		for await (const { name, isFile, isDirectory } of Deno.readDir(`${settings.servicesFolder}${this.folder}${leaf}`)) {
			const absolutePath = `${settings.servicesFolder}${this.folder}${leaf}/${name}`
			const defaultPathname = (leaf || "/") + (name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name)
			if (name.startsWith("_")) {
				log.verb(`Skipping registring of service "${name}" of application "${this.appName}" (prefix)`)
				continue
			} else if (isDirectory) {
				this.indexServicesPathnames((leaf || "/") + name + "/")
			} else if (isFile) {
				this.pathnames[defaultPathname] = absolutePath
				Service.scripts.push(`/srv/${this.domain}${defaultPathname}`)
				log.verb(`Application "${this.appName}" can now use service "${leaf}/${name}" on "${defaultPathname}"`)
				log.dbug(`Service pathnames available:`, this.pathnames)
			}
		}
	}
	private modFile(subFolder: string = "/") {
		const paths = Object.keys(this.pathnames)
		const exports = paths
			.filter(services => services.startsWith(subFolder))
			.map(service => `export * from "/srv/${this.domain}${service}";`).join("\n")
		if (exports.length <= 0) return `No service in subfolder "${subFolder}"`
		return exports
	}

	public reply = async ({ pathname }: WrappedRequest) => {
		const serviceFile = this.pathnames[pathname]
		log.info(`Service "${this.appName}" responding to request for "${pathname}"`)
		
		if (pathname.endsWith("/")) return { content: this.modFile(pathname), mime: "text/javascript", code: 200 }as ThinResponse
		if (serviceFile) return { content: await Deno.readTextFile(serviceFile), mime: "text/javascript", code: 200 } as ThinResponse 
		return { content: `No service file on endpoint "${pathname}"`, mime: "text/plain", code: 400 } as ThinResponse
	}
	public constructor(public readonly folder: string, private readonly domain: string, private readonly appName: string) {
		servicesImportMap[`@${folder}/`] = `/srv/${domain}/`
		services[domain] = this
		
		if (exists(`${settings.servicesFolder}${folder}`)) this.indexServicesPathnames()
		
		log.info(`Added "${appName}" to service share`)
		if (settings.freezeInstances) Object.freeze(this)
	}
}

function compileImportMap() {
	return `<script type="importmap">{"imports":${JSON.stringify(servicesImportMap)}}</script>`
}

function compilePreload() {
	return Service.scripts.map(service => `<link rel="modulepreload" href="${service}">`).join("\n")
}

function compileModules() {
	return Service.scripts.map(service => `<script async type="module" src="${service}"></script>`).join("\n")
}

function exists(path: string): boolean {
	try {
		const _info = Deno.statSync(path)
		return true
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) return false
		throw error
	}
}

const servicesImportMap: Record<string, string> = { }
const applications: Record<string, Application> = { }
const services: Record<string, Service> = { }

export const Applications = applications as Readonly<typeof applications>
export const Services = services as Readonly<typeof services>
export const Compiles = {
	importMap: compileImportMap,
	preloads: compilePreload,
	modules: compileModules,
} as const

const MIMES = {
	html: "text/html",
	htm: "text/html",
	css: "text/css",
	js: "text/javascript",
	txt: "text/plain",
	xml: "text/xml",

	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	svg: "image/svg+xml",
	ico: "image/x-icon",
	webp: "image/webp",

	woff: "font/woff",
	woff2: "font/woff2",
	ttf: "font/ttf",
	otf: "font/otf",

	json: "application/json",
	pdf: "application/pdf",
	zip: "application/zip",
	bin: "application/octet-stream",

	mp3: "audio/mpeg",
	mp4: "video/mp4",
	wav: "audio/wav",
} as const

for await (const { name: fileName, isFile } of Deno.readDir(settings.manifestsFolder)) {
	if (!isFile) continue
	try {
		const textManifest = await Deno.readTextFile(settings.manifestsFolder + fileName)
		const appName = fileName.slice(0, fileName.indexOf("."))
		const manifest = yaml.parse(textManifest) as ApplicationManifest
		const cleanManifest = new ApplicationManifest(appName, manifest)
		new Application(appName, cleanManifest)
	} catch (error) { log.warn((error as Error).stack) }
}