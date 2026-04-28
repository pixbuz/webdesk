// TODO: Keep in cache only most requested files using a point system
// TODO: Long / short relative path distinctions
// TODO: Caching the heaviest file when point ties

// NOTE: Symbols tho?
// NOTE: Get set methods tho?
// NOTE: Service workers on applications are outside the scope of version 1

import { log } from "./log.ts"
import { config } from "../server.config.ts"

type Command = (req: Request) => (CommandOutput | Response | Promise<CommandOutput> | Promise<Response>)
type CommandOutput = { data: unknown, type: string }
type FileContent = Uint8Array
type RelativeFilePath = string
type LongFilePath = string
type Endpoint = string
type Hash = string

const MIMES = Object.freeze({
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
})
log.verbose(`Mapper is initializing with support for these file extensions: ${Object.keys(MIMES).join(", ")}`)

class SmartResponse extends Response {
	constructor(browserOrigin: string | null, fileOrigin: RelativeFilePath = "", body?: unknown) {
		log.verbose(`Extracting the mime of filename "${fileOrigin}"`)
		const extension = fileOrigin.substring(fileOrigin.lastIndexOf(".") + 1)
		const mime = MIMES[extension as keyof typeof MIMES] || "application/octet-stream"
		
		log.debug(`Using ${mime} for the content type based on the file extension`)
		
		super(body as BodyInit, { status: (body ? 200 : 400), headers: {
			"content-type": (mime || "text/plain"),
			"Access-Control-Allow-Origin": (browserOrigin || "*"),
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Credentials": "true",
		} })

		log.debug(`Sending back a response with status ${body ? 200 : 400}`)
	}
}

class CommandResponse extends Response {
	constructor(browserOrigin: string, data?: unknown, type?: string) {
		super(data as BodyInit, { status: (data ? 200 : 500), headers: {
			"content-type": (type || "text/plain"),
			"Access-Control-Allow-Origin": (browserOrigin || "*"),
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Credentials": "true",
		}})
	}
}

class ApplicationManifest {
	routes: Record<string, string> = {}
	description: string = "No description"
	service: boolean = false
	modules: string[] = []
	titlebar: string = ""
	ignore: string[] = []
	script: string = ""
	style: string = ""
	index: string = ""
	icon: string = ""

	constructor(manifest?: ApplicationManifest) {
		if (manifest) {
			const empty = new ApplicationManifest()
			const norm = { ...empty, ...manifest }
			norm.ignore = [
				...manifest.ignore || [],
				...this.modules,
				"manifest.json",
			]

			return norm
		}
	}
}

class BiDiMap<K, V> {
	private readonly map: Map<K | V, K | V > = new Map()
	public size = 0

	public has(either: K | V) { return this.map.has(either) }
	public get(either: K | V) { return this.map.get(either)! }

	public delete(either: K | V) {
		this.map.delete(either)
		this.size = this.map.size / 2
	}

	public set(key: K, value: V) {
		this.map.set(key, value)
		this.map.set(value, key)
		this.size = this.map.size / 2
	}
}

class BaseRoute {
	private static updateHashes(name: string, fileHashes: Record<Endpoint, Hash>) {
		log.verbose(`Iterating through all file hashes of ${name} to calculate a single hash`)
		let appHash = 0
		for (const [_endpoint, hash] of Object.entries(fileHashes)) {
			const numericHash = parseInt(hash, 16)
			appHash += numericHash
		}
		AppRoute.hashes[name] = appHash
	}

	private readonly cacheRatio = .5
	private readonly hashes: Record<Endpoint, Hash> = { }
	private readonly cache: Record<Endpoint, FileContent> = { }
	private readonly endpointScore: Record<Endpoint, number> = { }

	private totalEndpoints = 0
	private requestsRecieved = 0
	private requestsForCacheUpdate = 1

	private readonly addAssetsFromFolder = this.addAssetsFromAppFolder

	private removeHash(endpoint: Endpoint) {
		log.debug(`Removing the stored hash for endpoint ${endpoint}`)
		delete this.hashes[endpoint]
		AppRoute.updateHashes(this.name, this.hashes)
	}
	
	private updateEndpointScores(endpoint: Endpoint) {
		if (!this.origins.has(endpoint)) {
			log.verbose(`Ignoring score update because the endpoint ${endpoint} has no origin`)
			return
		}

		this.endpointScore[endpoint] = (this.endpointScore[endpoint] || 0) + 1
		log.verbose(`Checking if the total request count ${this.requestsRecieved} hit the next update interval ${this.requestsForCacheUpdate}`)
		if (this.requestsRecieved % this.requestsForCacheUpdate === 0) {
			log.debug(`Request threshold was met, updating cache`)
			this.updateCache()
		}
	}

	private async cacheFile(endpoint: Endpoint) {
		try {
			const relPath = this.origins.get(endpoint)
			log.verbose(`Reading the file at ${relPath} to cache it`)
			this.cache[endpoint] = await Deno.readFile(relPath)
			log.debug(`Successfully added ${endpoint} into the cache`)
		} catch (error) { log.warn(`Something went wrong trying to cache ${endpoint} for ${this.name}: ${(error as Error).message}`) }
	}

	private async calculateHash(endpoint: Endpoint, origin: RelativeFilePath) {
		log.verbose(`Generating hash for ${origin}`)
		const fileContents = await Deno.readFile(origin)
		const hashArray = new Uint8Array(await crypto.subtle.digest("SHA-1", fileContents))
		const hashText = Array.from(hashArray).map((byte) => { return byte.toString(16).padStart(2, "0") }).join("")

		this.hashes[endpoint] = hashText
		AppRoute.updateHashes(this.name, this.hashes)
	}

	private addFile(endpoint: Endpoint, origin: RelativeFilePath, isEndpoint: boolean = false) {
		log.verbose(`Processing ${origin} to ensure it does not contain directory traversal attempts`)
		const cleanOrigin = origin.replaceAll("..", "")
		let relPath = cleanOrigin

		if (isEndpoint) {
			log.debug(`Prefixing the endpoint file with the base path ${this.basePath}`)
			relPath = `${this.basePath}${cleanOrigin.startsWith("/") ? cleanOrigin : "/" + cleanOrigin}`
		}

		this.origins.set(endpoint, relPath)
		this.totalEndpoints++

		this.calculateHash(endpoint, relPath)
	}

	private updateCache(resetCounter = false) {
		log.info(`Starting a cache update for application ${this.name}`)
		log.verbose(`Calculating the cache limit based on the ratio ${this.cacheRatio}`)
		const cacheLimit = Math.max(1, Math.ceil(this.totalEndpoints * this.cacheRatio))
		
		log.verbose(`Sorting all endpoints by their request number to prioritize the most frequently accessed files`)
		const sortedEndpoints = Object.entries(this.endpointScore)
			.sort(([_endpointA, scoreA], [_endpointB, scoreB]) => { return (scoreB - scoreA) })
			.map(([endpoint]) => { return endpoint })

		const topEndpoints = sortedEndpoints.slice(0, cacheLimit)

		log.verbose(`Checking existing cache entries to remove files no longer in the top requested list ${cacheLimit}`)
		for (const endpoint in this.cache) {
			if (!topEndpoints.includes(endpoint)) {
				log.debug(`Removing ${endpoint} from cache`)
				delete this.cache[endpoint]
			}
		}

		for (const endpoint of topEndpoints) {
			if (this.cache[endpoint]) {
				log.verbose(`Skipping ${endpoint} as it is already present in cache`)
				continue
			}
			else {
				log.verbose(`Caching ${endpoint} from the top requested list`)
				this.cacheFile(endpoint)
			}
		}

		if (!resetCounter) {
			this.requestsForCacheUpdate *= 2
			log.debug(`Setting the next update interval to ${this.requestsForCacheUpdate} requests`)
		}
		else {
			this.requestsForCacheUpdate = 0
			log.debug(`Resetting the request counter for the cache update interval`)
		}

		log.info(`Cache updated for application ${this.name} with ${topEndpoints.length} endpoints in cache`)
	}

	private addCommand(name: string, value: unknown, endpoint: Endpoint) {
		const valueType = typeof value
		log.verbose(`Checking if "${name}" can be used as an API command`)
		
		switch(valueType) {
			case "object": {
				log.debug(`Mapped "${name}" as a static data command because it is an object`)
				return this.api[endpoint] = value as CommandOutput
			}
			case "function": {
				log.debug(`Mapped "${name}" as an executable command function`)
				return this.api[endpoint] = value as Command
			}
			default: {
				log.debug(`Skipped adding the command "${name}" in ${this.name} because its type "${valueType}" is not supported`)
				return
			}
		}
	}

	protected readonly api: Record<Endpoint, Command | CommandOutput> = { }
	protected readonly origins: BiDiMap<Endpoint, RelativeFilePath> = new BiDiMap()

	protected constructor(protected readonly basePath: string, protected readonly name: string, protected readonly manifest: ApplicationManifest) { UpdateWatcher.start() }

	protected requestCacheUpdate(resetCounter = false) {
		log.info(`Application ${this.name} has requested a full cache refresh`)
		this.updateCache(resetCounter)
		return true
	}

	protected addMainAssets() {
		const { index, icon, script, style } = this.manifest
		log.verbose(`Checking the manifest of ${this.name} to link the primary assets`)
		
		if (index) {
			log.debug(`Setting up application ${this.name} index to "${index}" following the manifest`)
			this.addFile("/", index, true)
		} else log.debug(`Note: ${this.name} has no index file defined in its manifest`)
		
		if (icon) {
			log.debug(`Setting up application ${this.name} icon to "${icon}" following the manifest`)
			this.addFile("/icon", icon, true)
		} else log.debug(`Note: ${this.name} has no icon file defined in its manifest`)
		
		if (script) {
			log.debug(`Setting up application ${this.name} script to "${script}" following the manifest`)
			this.addFile("/js", script, true)
		} else log.debug(`Note: ${this.name} has no script file defined in its manifest`)
		
		if (style) {
			log.debug(`Setting up application ${this.name} style to "${style}" following the manifest`)
			this.addFile("/style", style, true)
		} else log.debug(`Note: ${this.name} has no style file defined in its manifest`)
	}

	protected async addCommands(differentModulesEndpoints = false) {
		const { modules } = this.manifest
		log.info(`Loading API modules for application ${this.name}`)
		
		for (const moduleName of modules) {
			log.verbose(`Importing module ${moduleName} to extract exports`)
			const module = await import(`../${this.basePath}/${moduleName}`)
			for (const [ name, value ] of Object.entries(module)) {
				let endpoint = `/api/${name}`
				if (differentModulesEndpoints) {
					log.debug(`Using module-specific routing for command ${name} from ${moduleName}`)
					endpoint = `/api/${moduleName}/${name}`
				}
				this.addCommand(name, value, endpoint)
			}
		}
	}

	protected requestFileRemove(path: RelativeFilePath) {
		const endpoint = this.origins.get(path)
		log.verbose(`Checking if the file at ${path} is currently mapped to an active endpoint`)
		
		if (!endpoint) {
			log.debug(`Ignored removal request because the file ${path} wasn't tracked`)
			return false
		}
		
		log.info(`Removing endpoint ${endpoint} from ${this.name} as the file was deleted`)
		this.origins.delete(endpoint)
		this.removeHash(endpoint)
		this.totalEndpoints--
		return true
	}

	protected requestFileAdd(relPath: RelativeFilePath) {
		log.verbose(`Attempting to add a new file ${relPath} to application ${this.name}`)
		const file = relPath.substring(config.appFolder.length + this.name.length + 2)
		const endpoint = this.manifest.routes[file] || `/${file}`
		
		log.verbose(`Checking ignore list to see if ${file} is allowed to be indexed`)
		for (const ignored of this.manifest.ignore) {
			if (file.startsWith(ignored)) {
				log.debug(`Rejected the addition of ${file} because it matches the ignore pattern "${ignored}"`)
				return false
			}
		}
		
		// TODO: Custom routes
		log.debug(`Accepted the new file and mapping it to the ${endpoint} endpoint`)
		this.addFile(endpoint, relPath)
		return true
	}

	protected requestFileUpdate(path: RelativeFilePath) {
		const shortRelPath = path.substring(this.basePath.length + 1)
		const endpoint = this.origins.get(path)
		
		log.verbose(`Inspecting the update event for ${path} to determine if it is a module or a static asset`)
		
		if (this.manifest.modules.includes(shortRelPath)) {
			log.debug(`Detected a change in an API module of application ${this.name}, re-importing the commands`)
			return this.addCommands()
		} else if (!endpoint) {
			log.debug(`Ignoring the update because ${path} isn't tracked`)
			return false
		}
		
		log.info(`Updating the data for endpoint ${endpoint} in application ${this.name}`)
		
		if (!this.cache[endpoint]) {
			log.debug(`Skipping cache update since endpoint ${endpoint} isn't cached`)
			return false
		}
		
		this.cacheFile(endpoint)
		return true
	}

	protected async addAssetsFromAppFolder(path: string = "") {
		const baseFiles = [ this.manifest.index, this.manifest.icon, this.manifest.script, this.manifest.style, ...this.manifest.modules, "manifest.json" ]
		const { routes, ignore } = this.manifest
		
		log.verbose(`Walking through the directory tree at ${this.basePath}/${path} to index the files`)
		
		for await (const entry of Deno.readDir(`${this.basePath}/${path}`)) {
			if (baseFiles.includes(`${path}${entry.name}`)) {
				log.verbose(`Skipping ${entry.name} because it is already handled as a main asset`)
				continue
			}
			else if (ignore.includes(`${path}${entry.name}`)) {
				log.debug(`Skipping ${entry.name} because it is explicitly ignored in the manifest`)
				continue
			}
			else if (entry.isSymlink) {
				log.debug(`Skipping ${entry.name} because it is a system symbolic link`)
				continue
			}
			else if (entry.isDirectory) {
				log.debug(`Descending into subdirectory ${entry.name} to continue indexing`)
				this.addAssetsFromFolder(`${path}${entry.name}/`)
			}
			else {
				const endpoint = routes[`${path}${entry.name}`] || `/${path}${entry.name}`
				log.debug(`Mapping file ${entry.name} and assigning it to endpoint ${endpoint}`)
				this.addFile(endpoint, `/${path}${entry.name}`, true)
			}
		}
	}

	protected async runCommand(apiCommand: Command, request: Request, browserOrigin: string) {
		try {
			log.verbose(`Executing the logic for command "${apiCommand.name}" of application ${this.name}`)
			const result = await apiCommand(request)
			
			if (result instanceof Response) {
				log.debug(`Command returned a standard response object, checking its headers`)
				const origin = result.headers.get("origin")
				if (!origin) { log.warn(`Command "${apiCommand.name}" returned a response missing the origin header which might cause CORs errors`) }
				return result
			} else {
				log.debug(`Command returned a data object, wrapping it in a command response`)
				return new CommandResponse(browserOrigin, result.data, result.type)
			}
		} catch (error) {
			log.warn(`An error occurred while running the command "${apiCommand.name}", returning an empty response: ${(error as Error).message}`)
			log.printStack((error as Error).stack)
			return new CommandResponse(browserOrigin)
		}
	}

	public respond(request: Request) {
		const origin = request.headers.get("origin") || "*"
		const requestURL = new URL(request.url)
		const endpoint = requestURL.pathname

		this.requestsRecieved++
		this.updateEndpointScores(endpoint)

		log.debug(`Application ${this.name} is handling the request number ${this.requestsRecieved} for ${endpoint}`)

		log.verbose(`Checking if it's cached`)
		if (this.cache[endpoint]) {
			log.debug(`Serving ${endpoint} from the cache`)
			return new SmartResponse(origin, this.origins.get(endpoint), this.cache[endpoint])
		}
		
		log.verbose(`Cache miss, checking if it's tracked`)
		if (this.origins.has(endpoint)) {
			log.debug(`Reading the file and serving ${endpoint}`)
			return new SmartResponse(origin, this.origins.get(endpoint), Deno.readFileSync(this.origins.get(endpoint)))
		}
		
		log.verbose(`No file found for ${endpoint}, checking it's an API command`)
		if (this.api[endpoint]) {
			const api = this.api[endpoint]
			if (typeof api === "function") {
				log.debug(`Triggering the command function registered at ${endpoint}`)
				return this.runCommand(api, request, origin)
			}
			else {
				log.debug(`Returning the static data registered at ${endpoint}`)
				return new CommandResponse(origin, api.data, api.type)
			}
		}

		log.debug(`Application ${this.name} doesn't have ${endpoint}`)
		return new SmartResponse(origin)
	}
}

class UpdateWatcher {
	public static started = false

	public static start() {
		if (this.started) { return }
		this.started = true
		new UpdateWatcher()
	}

	private getApplicationRelativePath(origin: LongFilePath) {
		let relPath = origin
		if (Deno.build.os === "windows") { relPath = relPath.replaceAll("\\", "/") }
		relPath = relPath.substring(relPath.indexOf(config.appFolder))
		return relPath
	}

	private getWebdeskRelativePath(origin: LongFilePath) {
		let relPath = origin
		if (Deno.build.os === "windows") { relPath = relPath.replaceAll("\\", "/") }
		relPath = relPath.substring(relPath.indexOf(config.staticFolder))
		return relPath
	}

	private getAppName(relPath: RelativeFilePath) {
		const appRelativePath = relPath.substring(config.appFolder.length + 1)
		const appName = appRelativePath.substring(0, appRelativePath.indexOf("/"))
		return appName
	}

	private async startApplication() {
		log.info(`File system watcher for applications is starting up`)
		for await (const { kind, paths, flag } of Deno.watchFs(`${config.appFolder}`, { recursive: true })) {

			if (flag === "rescan") {
				log.debug(`Rescan flag was detected, restarting the application watcher to ensure state consistency`)
				this.startApplication()
				return
			}

			for (const origin of paths) {
				const relPath = this.getApplicationRelativePath(origin)
				const appName = this.getAppName(relPath)

				log.verbose(`Analyzing a ${kind} event for ${origin}`)
				if (!appName || !AppRoute.registred[appName]) {
					log.debug(`Ignoring the event because ${appName || "the file"} does not belong to any installed app`)
					continue
				} else {
					log.debug(`Forwarding the ${kind} event for ${relPath} to application ${appName}`)
					AppRoute.registred[appName].fileUpdated(relPath, kind)
				}
			}
		}
	}

	private async startWebdesk() {
		log.info(`File system watcher for Webdesk is starting up`)
		for await (const { kind, paths, flag } of Deno.watchFs(`${config.staticFolder}`, { recursive: true })) {
			if (flag === "rescan") {
				log.debug(`Detected a rescan flag for static folders, restarting the Webdesk watcher`)
				this.startWebdesk()
				return
			}

			for (const origin of paths) {
				const relPath = this.getWebdeskRelativePath(origin)
				log.debug(`Notifying Webdesk about a ${kind} change in ${relPath}`)
				webdeskRoute.fileUpdated(relPath, kind)
			}
		}
	}

	private constructor() {
		this.startApplication()
		this.startWebdesk()
	}
}

export class AppRoute extends BaseRoute {
	public static readonly manifests: Record<string, ApplicationManifest> = { }
	public static readonly registred: Record<string, AppRoute> = { }
	public static readonly hashes: Record<string, number> = { }

	public static getManifests() { return { data: JSON.stringify(AppRoute.manifests), type: MIMES.json } }
	public static getHashes() { return { data: JSON.stringify(AppRoute.hashes), type: MIMES.json } }

	public static async create(name: string) {
		log.verbose(`Attempting to create a new route for ${name}`)
		try {
			const manifestContents = await Deno.readTextFile(`./apps/${name}/manifest.json`)
			const manifestObject = new ApplicationManifest(JSON.parse(manifestContents))
			
			log.verbose(`Adding ${name} to the manifest list`)
			AppRoute.manifests[name] = manifestObject
			
			AppRoute.registred[name] = new AppRoute(name, manifestObject)
			log.info(`Successfully created the route for application ${name}`)
		} catch(error) { log.error(`Critical error trying to create the route for ${name}: ${(error as Error).message}`) }
	}

	private constructor(name: string, manifest: ApplicationManifest) {
		super(`${config.appFolder}/${name}`, name, manifest)
		log.info(`Initializing the subdomain route for application ${name}`)

		this.addAssetsFromAppFolder()
		this.addMainAssets()
		this.addCommands()
	}

	public fileUpdated(path: RelativeFilePath, kind: string) {
		log.verbose(`The route for application ${this.name} is deciding how to handle a ${kind} file event`)
		switch(kind) {
			case "remove": {
				log.debug(`Removing the endpoint at ${path}`)
				return this.requestFileRemove(path)
			}
			case "modify": {
				log.debug(`Requesting update for endpoint at ${path}`)
				return this.requestFileUpdate(path)
			}
		}
	}
}

export const webdeskRoute = new class WebdeskRoute extends BaseRoute {
	public hash = "0".repeat(40)

	public constructor() {
		const manifest = new ApplicationManifest()
		manifest.service = true
		manifest.description = "Webdesk kernel"
		manifest.routes = {
			"index.htm": "/",
			"style.css": "/style",
			"sw.json": "/manifest",
			"titlebar.htm": "/titlebar",
			"webdesk.svg": "/favicon.ico",
			
			"js/launchers.js": "/launchers",
			"js/core.js": "/core",
			"js/dock.js": "/dock",
			"js/ui.js": "/ui",
			"js/wm.js": "/wm",
			"js/sw.js": "/sw",
		}

		super(`${config.staticFolder}`, "Webdesk", manifest)
		log.info(`Initializing the Webdesk route`)

		this.addAssetsFromAppFolder()
		this.api["/api/appHashes"] = AppRoute.getHashes
		this.api["/api/getManifests"] = AppRoute.getManifests
	}

	public fileUpdated(path: RelativeFilePath, kind: string) {
		log.verbose(`Webdesk route is processing a ${kind} change for ${path}`)
		switch(kind) {
			case "remove": {
				log.debug(`Removing a static asset from its internal mapping`)
				return this.requestFileRemove(path)
			}
			case "modify": {
				log.debug(`Updating a static asset to reflect new file changes`)
				return this.requestFileUpdate(path)
			}
		}
	}
}