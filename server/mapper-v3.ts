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

class SmartResponse extends Response {
	constructor(browserOrigin: string | null, fileOrigin: RelativeFilePath = "", body?: unknown) {
		const extension = fileOrigin.substring(fileOrigin.lastIndexOf(".") + 1)
		const mime = MIMES[extension as keyof typeof MIMES] || "application/octet-stream"
		super(body as BodyInit, { status: (body ? 200 : 400), headers: {
			"content-type": (mime || "text/plain"),
			"Access-Control-Allow-Origin": (browserOrigin || "*"),
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Credentials": "true",
		} })
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
		log.debug(`Removed file hash of ${endpoint}`)
		delete this.hashes[endpoint]
		AppRoute.updateHashes(this.name, this.hashes)
	}
	
	private updateEndpointScores(endpoint: Endpoint) {
		if (!this.origins.has(endpoint)) { return }

		this.endpointScore[endpoint] = (this.endpointScore[endpoint] || 0) + 1
		if (this.requestsRecieved % this.requestsForCacheUpdate === 0) { this.updateCache() }
	}

	private async cacheFile(endpoint: Endpoint) {
		try {
			const relPath = this.origins.get(endpoint)
			this.cache[endpoint] = await Deno.readFile(relPath)
		} catch (error) { log.warn(`Error trying to cache ${endpoint} of application ${this.name}: ${(error as Error).message}`) }
	}

	private async calculateHash(endpoint: Endpoint, origin: RelativeFilePath) {
		const fileContents = await Deno.readFile(origin)
		const hashArray = new Uint8Array(await crypto.subtle.digest("SHA-1", fileContents))
		const hashText = Array.from(hashArray).map((byte) => { return byte.toString(16).padStart(2, "0") }).join("")

		this.hashes[endpoint] = hashText
		AppRoute.updateHashes(this.name, this.hashes)
	}

	private addFile(endpoint: Endpoint, origin: RelativeFilePath, isEndpoint: boolean = false) {
		const cleanOrigin = origin.replaceAll("..", "")
		let relPath = cleanOrigin

		if (isEndpoint) { relPath = `${this.basePath}${cleanOrigin.startsWith("/") ? cleanOrigin : "/" + cleanOrigin}` }

		this.origins.set(endpoint, relPath)
		this.totalEndpoints++

		this.calculateHash(endpoint, relPath)
	}

	private updateCache(resetCounter = false) {
		log.debug(`Updating cache of ${this.name}`)
		const cacheLimit = Math.max(1, Math.ceil(this.totalEndpoints * this.cacheRatio))
		const sortedEndpoints = Object.entries(this.endpointScore)
			.sort(([_endpointA, scoreA], [_endpointB, scoreB]) => { return (scoreB - scoreA) })
			.map(([endpoint]) => { return endpoint })

		const topEndpoints = sortedEndpoints.slice(0, cacheLimit)

		for (const endpoint in this.cache) {
			if (!topEndpoints.includes(endpoint)) { delete this.cache[endpoint] }
		}

		for (const endpoint of topEndpoints) {
			if (this.cache[endpoint]) { continue }
			else { this.cacheFile(endpoint) }
		}

		if (!resetCounter) { this.requestsForCacheUpdate *= 2 }
		else { this.requestsForCacheUpdate = 0 }

		log.info(`Application ${this.name}'s cached enpoints: ${topEndpoints.join(", ")}`)
		log.debug(`Next cache update at ${this.requestsForCacheUpdate} requests (${this.requestsRecieved} current)`)
	}

	private addCommand(name: string, value: unknown, endpoint: Endpoint) {
		const valueType = typeof value
		log.info(`Adding application ${this.name} command "${name}" at ${endpoint}`)
		switch(valueType) {
			case "object": { return this.api[endpoint] = value as CommandOutput }
			case "function": { return this.api[endpoint] = value as Command }
			case "string":
			case "number":
			case "bigint":
			case "symbol":
			case "boolean":
			case "undefined":
			default: { return log.info(`Application ${this.name}'s ${name} command has a unsupported type (${valueType})`) }
		}
	}

	protected readonly api: Record<Endpoint, Command | CommandOutput> = { }
	protected readonly origins: BiDiMap<Endpoint, RelativeFilePath> = new BiDiMap()
	// protected readonly basePath: string
	// protected readonly appName: string
	// protected readonly manifest: ApplicationManifest

	protected constructor(protected readonly basePath: string, protected readonly name: string, protected readonly manifest: ApplicationManifest) { UpdateWatcher.start() }

	protected requestCacheUpdate(resetCounter = false) {
		log.info(`Application ${this.name} requested a whole cache update`)
		this.updateCache(resetCounter)
		return true
	}

	protected addMainAssets() {
		const { index, icon, script, style } = this.manifest
		if (index) { this.addFile("/", index, true) }
		else { log.info(`Application ${this.name} has no index specified`) }
		if (icon) { this.addFile("/icon", icon, true) }
		else { log.info(`Application ${this.name} has no icon specified`) }
		if (script) { this.addFile("/js", script, true) }
		else { log.debug(`Application ${this.name} has no script specified`) }
		if (style) { this.addFile("/style", style, true) }
		else { log.debug(`Application ${this.name} has no style specified`) }
	}

	protected async addCommands(differentModulesEndpoints = false) {
		const { modules } = this.manifest
		for (const moduleName of modules) {
			const module = await import(`../${this.basePath}/${moduleName}`)
			for (const [ name, value ] of Object.entries(module)) {
				let endpoint = `/api/${name}`
				if (differentModulesEndpoints) { endpoint = `/api/${moduleName}/${name}` }
				this.addCommand(name, value, endpoint)
			}
		}
	}

	protected requestFileRemove(path: RelativeFilePath) {
		const endpoint = this.origins.get(path)
		if (!endpoint) {
			log.info(`Application ${this.name} requested to remove an ignored file`)
			return false
		}
		log.info(`Application ${this.name} requested to remove ${endpoint}`)
		this.origins.delete(endpoint)
		this.removeHash(endpoint)
		this.totalEndpoints--
		return true
	}

	protected requestFileAdd(relPath: RelativeFilePath) {
		const file = relPath.substring(config.appFolder.length + this.name.length + 2)
		const endpoint = this.manifest.routes[file] || `/${file}`
		log.info(`Application ${this.name} requested to add ${endpoint}`)
		for (const ignored of this.manifest.ignore) {
			if (file.startsWith(ignored)) {
				log.debug(`The add request for file ${file} of ${this.name} was rejected`)
				return false
			}
		}
		this.addFile(endpoint, relPath)
		return true
	}

	protected requestFileUpdate(path: RelativeFilePath) {
		const shortRelPath = path.substring(this.basePath.length + 1)
		const endpoint = this.origins.get(path)
		if (this.manifest.modules.includes(shortRelPath)) {
			log.info(`Application ${this.name}'s ${path} module changed, updating commands`)
			return this.addCommands()
		} else if (!endpoint) {
			log.info(`Application ${this.name} requested to update an ignored file`)
			return false
		}
		
		log.info(`Application ${this.name} requested to update ${endpoint}`)
		
		if (!this.cache[endpoint]) {
			log.debug(`Application ${this.name}'s ${endpoint} wasn't in cache`)
			return false
		}
		this.cacheFile(endpoint)
		log.info(`Application ${this.name} cache updated`)
		return true
	}

	protected async addAssetsFromAppFolder(path: string = "") {
		const baseFiles = [ this.manifest.index, this.manifest.icon, this.manifest.script, this.manifest.style, ...this.manifest.modules, "manifest.json" ]
		const { routes, ignore } = this.manifest
		for await (const entry of Deno.readDir(`${this.basePath}/${path}`)) {
			if (baseFiles.includes(`${path}${entry.name}`)) { continue }
			else if (ignore.includes(`${path}${entry.name}`)) {
				log.debug(`Skipped indexing of application ${this.name}'s "${entry.name}" as per manifest`)
				continue
			}
			else if (entry.isSymlink) { log.debug(`Skipped indexing of application ${this.name}'s "${entry.name}", is system link`) }
			else if (entry.isDirectory) { this.addAssetsFromFolder(`${path}${entry.name}/`) }
			else /* if (entry.isFile) */ {
				const endpoint = routes[`${path}${entry.name}`] || `/${path}${entry.name}`
				this.addFile(endpoint, `/${path}${entry.name}`, true)
			}
		}
	}

	protected async runCommand(apiCommand: Command, request: Request, browserOrigin: string) {
		try {
			const result = await apiCommand(request)
			log.info(`Application ${this.name}'s "${apiCommand.name}" command ran without errors`)
			if (result instanceof Response) {
				const origin = result.headers.get("origin")
				if (!origin) { log.warn(`Application ${this.name}'s "${apiCommand.name}" command returned a response without an origin, the request will likely fail`) }
				else if (origin === this.name) { log.warn(`Application ${this.name}'s "${apiCommand.name}" command returned a response with the wrong origin, the request will likely fail`) }
				return result
			} else { return new CommandResponse(browserOrigin, result.data, result.type) }
		} catch (error) {
			log.warn(`Error running application ${this.name}'s "${apiCommand.name}" command: ${(error as Error).message}`)
			return new CommandResponse(browserOrigin)
		}
	}

	public respond(request: Request) {
		const origin = request.headers.get("origin") || "*"
		const requestURL = new URL(request.url)
		const endpoint = requestURL.pathname

		this.requestsRecieved++
		this.updateEndpointScores(endpoint)

		log.debug(`${this.name} recived a request for "${endpoint}" (request number ${this.requestsRecieved})`)

		if (this.cache[endpoint]) { return new SmartResponse(origin, this.origins.get(endpoint), this.cache[endpoint]) }
		else if (this.origins.has(endpoint)) { return new SmartResponse(origin, this.origins.get(endpoint), Deno.readFileSync(this.origins.get(endpoint))) }
		else if (this.api[endpoint]) {
			const api = this.api[endpoint]
			if (typeof api === "function") { return this.runCommand(api, request, origin) }
			else { return new CommandResponse(origin, api.data, api.type) }
		}

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
		log.info(`Application watcher started`)
		for await (const { kind, paths, flag } of Deno.watchFs(`${config.appFolder}`, { recursive: true })) {

			if (flag === "rescan") {
				log.debug(`Noticed something (other) with a rescan flag happened, refreshing the watcher`)
				this.startApplication()
				return
			}

			for (const origin of paths) {
				const relPath = this.getApplicationRelativePath(origin)
				const appName = this.getAppName(relPath)

				if (!appName || !AppRoute.registred[appName]) {
					log.debug(`Event ${kind} to file ${origin} doesn't interest any app`)
					continue
				} else { AppRoute.registred[appName].fileUpdated(relPath, kind) }
			}
		}
	}

	private async startWebdesk() {
		log.info(`Webdesk watcher started`)
		for await (const { kind, paths, flag } of Deno.watchFs(`${config.staticFolder}`, { recursive: true })) {
			if (flag === "rescan") {
				log.debug(`Noticed something (other) with a rescan flag happened, refreshing the watcher`)
				this.startWebdesk()
				return
			}

			for (const origin of paths) {
				const relPath = this.getWebdeskRelativePath(origin)
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
		try {
			const manifestContents = await Deno.readTextFile(`./apps/${name}/manifest.json`)
			const manifestObject = new ApplicationManifest(JSON.parse(manifestContents))
			if (!manifestObject.service) { AppRoute.manifests[name] = manifestObject }
			AppRoute.registred[name] = new AppRoute(name, manifestObject)
		} catch(error) { return log.debug(`Error while making the app route for ${name}: ${(error as Error).message}`) }
	}

	private constructor(name: string, manifest: ApplicationManifest) {
		super(`${config.appFolder}/${name}`, name, manifest)
		log.info(`Making a subdomain route for ${name}`)

		this.addAssetsFromAppFolder()
		this.addMainAssets()
		this.addCommands()
	}

	public fileUpdated(path: RelativeFilePath, kind: string) {
		switch(kind) {
			// case "create": { return this.requestFileAdd(path) }
			case "remove": { return this.requestFileRemove(path) }
			case "modify": { return this.requestFileUpdate(path) }
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
		log.info(`Making the Webdesk route`)

		this.addAssetsFromAppFolder()
		this.api["/api/appHashes"] = AppRoute.getHashes
		this.api["/api/getManifests"] = AppRoute.getManifests
	}

	public fileUpdated(path: RelativeFilePath, kind: string) {
		switch(kind) {
			// case "create": { return this.requestFileAdd(path) }
			case "remove": { return this.requestFileRemove(path) }
			case "modify": { return this.requestFileUpdate(path) }
		}
	}
}