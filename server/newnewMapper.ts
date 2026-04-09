// TODO: Keep in cache only most requested files using a point system

// NOTE: Webdesk as "kernel" app?
// NOTE: Service workers on applications are outside the scope of version 1

import { log } from "./log.ts"
import { config } from "../server.config.ts"
import { runInThisContext } from "node:vm";

type Command = (req: Request) => (CommandOutput | Response)
type CommandOutput = { data: unknown, type: string }
type FileContent = Uint8Array
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
	constructor(browserOrigin: string | null, fileOrigin: LongFilePath = "", body?: any) {
		const extension = fileOrigin.substring(fileOrigin.lastIndexOf(".") + 1)
		const mime = MIMES[extension as keyof typeof MIMES] || "application/octet-stream"
		super(body, { status: (body ? 200 : 400), headers: {
			"content-type": (mime || "text/plain"),
			"Access-Control-Allow-Origin": (browserOrigin || "*"),
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Credentials": "true",
		} })
	}
}

class ApplicationManifest {
	routes: Record<string, string> = {}
	description: string = "No description"
	modules: string[] = []
	titlebar: string = ""
	ignore: string[] = []
	dni: boolean = false
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
	public get(either: K | V) { return this.map.get(either) }

	public delete(either: K | V) {
		this.map.delete(either)
		this.size = this.map.size
	}

	public set(key: K, value: V) {
		this.map.set(key, value)
		this.map.set(value, key)
		this.size = this.map.size
	}
}

class BaseRoute {
	private readonly cacheRatio = .5
	private readonly hashes: Record<Endpoint, Hash> = { }
	private readonly cache: Record<Endpoint, FileContent> = { }
	private readonly endpointScore: Record<Endpoint, number> = { }

	private totalEndpoints = 0
	private requestsRecieved = 0
	private requestsForCacheUpdate = 1

	private readonly addAssetsFromFolder = this.addAssetsFromAppFolder

	private updateEndpointScores(endpoint: Endpoint) {
		if (!this.origins.has(endpoint)) { return }

		this.endpointScore[endpoint] = (this.endpointScore[endpoint] || 0) + 1
		if (this.requestsRecieved % this.requestsForCacheUpdate === 0) { this.updateCache() }
	}

	private async calculateHash(endpoint: Endpoint, origin: LongFilePath) {
		const fileContents = await Deno.readFile(origin)
		const hashArray = new Uint8Array(await crypto.subtle.digest("SHA-1", fileContents))
		const hashText = Array.from(hashArray).map((byte) => { return byte.toString(16).padStart(2, "0") }).join("")

		this.hashes[endpoint] = hashText
	}

	private async updateCache() {
		log.debug(`Updating cache of ${this.appName}`)
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
			try {
				const filePath = this.origins.get(endpoint)
				this.cache[endpoint] = await Deno.readFile(filePath)
			} catch (error) { log.warn(`Error trying to cache ${endpoint} of application ${this.appName}: ${(error as Error).message}`) }
		}

		this.requestsForCacheUpdate *= 2
		log.info(`Application ${this.appName}'s cached enpoints: ${topEndpoints.join(", ")}`)
		log.debug(`Next cache update at ${this.requestsForCacheUpdate} requests (${this.requestsRecieved} current)`)
	}

	protected readonly commands: Record<Endpoint, Command> = { }
	protected readonly origins: BiDiMap<Endpoint, LongFilePath> = new BiDiMap()

	protected constructor (protected readonly basePath: string, protected readonly appName: string, protected readonly manifest?: ApplicationManifest) { }

	protected async addAssetsFromAppFolder(path: string = "") {
		if (!this.manifest) { return }
		const baseFiles = [ this.manifest.index, this.manifest.icon, this.manifest.script, this.manifest.style, "manifest.json" ]
		const { routes, ignore } = this.manifest
		for await (const entry of Deno.readDir(`${this.basePath}${path}`)) {
			if (baseFiles.includes(`${path}${entry.name}`)) { continue }
			else if (ignore.includes(`${path}${entry.name}`)) {
				log.debug(`Skipped indexing of application ${this.appName}'s "${entry.name}" as per manifest`)
				continue
			}
			else if (entry.isSymlink) { log.debug(`Skipped indexing of application ${this.appName}'s "${entry.name}", is system link`) }
			else if (entry.isDirectory) { this.addAssetsFromFolder(`${path}/${entry.name}`) }
			else /* if (entry.isFile) */ {
				const endpoint = routes[`${path}${entry.name}`] || `${path}/${entry.name}`
				this.addFile(endpoint, `${path}/${entry.name}`, true)
			}
		}
	}

	protected addMainAssets() {
		if (!this.manifest) { return }
		const { index, icon, script, style } = this.manifest
		if (index) { this.addFile("/", index, true) }
		else { log.info(`Application ${this.appName} has no index specified`) }
		if (icon) { this.addFile("/icon", icon, true) }
		else { log.info(`Application ${this.appName} has no icon specified`) }
		if (script) { this.addFile("/js", script, true) }
		else { log.debug(`Application ${this.appName} has no script specified`) }
		if (style) { this.addFile("/style", style, true) }
		else { log.debug(`Application ${this.appName} has no style specified`) }
	}

	private addFile(endpoint: Endpoint, origin: LongFilePath, isOriginRelative: boolean = false) {
		const cleanOrigin = origin.replaceAll("..", "")
		let longPath = cleanOrigin

		if (isOriginRelative) { longPath = `${this.basePath}${cleanOrigin.startsWith("/") ? cleanOrigin : "/" + cleanOrigin}` }

		this.origins.set(endpoint, longPath)
		this.totalEndpoints++

		this.calculateHash(endpoint, longPath)
	}

	public respond (request: Request) {
		const origin = request.headers.get("origin")
		const requestURL = new URL(request.url)
		const endpoint = requestURL.pathname

		this.requestsRecieved++
		this.updateEndpointScores(endpoint)

		if (this.cache[endpoint]) { return new SmartResponse(origin, this.origins.get(endpoint), this.cache[endpoint]) }
		else if (this.origins.has(endpoint)) { return new SmartResponse(origin, this.origins.get(endpoint), Deno.readFileSync(this.origins.get(endpoint))) }
		else if (this.commands[endpoint]) {
			/* Commands stuff */
		}

		return new SmartResponse(origin)
	}
}

export class AppRoute extends BaseRoute {
	public static readonly registred: Record<string, AppRoute> = { }
	public static readonly manifests: Record<string, string> = { }
	public static readonly hashes: Record<string, string> = { }

	public static async create(appName: string) {
		try {
			const manifestContents = await Deno.readTextFile(`./apps/${appName}/manifest.json`)
			const manifestObject = new ApplicationManifest(JSON.parse(manifestContents))
			AppRoute.manifests[appName] = manifestContents
			AppRoute.registred[appName] = new AppRoute(appName, manifestObject)
		} catch(error) { return log.debug(`Error while making the app route for ${appName}: ${(error as Error).message}`) }
	}

	private constructor(appName: string, manifest: WebdeskManifest) {
		super(`${config.appFolder}/${appName}`, appName, manifest)
		log.info(`Making a subdomain route for ${appName}`)

		this.addAssetsFromAppFolder()
		this.addMainAssets()

		// log.debug(`Application ${this.appName} watcher starting`)
		// new UpdateWatcher(`${config.appFolder}/${appName}`, this.watcherEndpointManipulator.bind(this))
	}
}