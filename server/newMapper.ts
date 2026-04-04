// TODO: Keep in cache only most requested files using a point system
// TODO: Base Route and then sub class webdesk and application
// TODO: ^^^ pls webdesk doing strange stuff

// NOTE: Webdesk as "kernel" app?

import { log } from "./log.ts"
import { config } from "../server.config.ts"

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
	constructor(origin: string | null, body?: any, mime?: string) {
		super(body, { status: (body ? 200 : 400), headers: {
			"content-type": (mime || "text/plain"),
			"Access-Control-Allow-Origin": (origin || "*"),
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Credentials": "true",
		} })
	}
}

type CommandOutput = {
	data: unknown,
	type: string
}

export class WebdeskManifest {
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

	constructor(manifest?: WebdeskManifest) {
		if (manifest) {
			const empty = new WebdeskManifest()
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

export class WebdeskRoute {
	private static initialized: boolean = false
	private static sw: Uint8Array

	public static create() {
		if (WebdeskRoute.initialized) { return }
		else { return new WebdeskRoute() }
	}

	public static getSW() { return WebdeskRoute.sw }

	private readonly hashEncoder = new TextEncoder()
	private hash: string = "0".repeat(40)

	private async watcherEndpointManipulator(origin: string, kind: string) {
		log.debug(`A ${kind} file event happend to Webdesk's file ${origin}"`)

		const path = getWebdeskRelativePath(origin)
		let fileEndpoint: string

		switch(path) {
			case "/index.htm": { fileEndpoint = "/"; break }
			case "/style.css": { fileEndpoint = "/style"; break }
			case "/manifest.json": { fileEndpoint = "/manifest"; break }
			case "/titlebar.htm": { fileEndpoint = "/titlebar"; break }

			case "/js/launchers.js": { fileEndpoint = "/launchers"; break }
			case "/js/core.js": { fileEndpoint = "/core"; break }
			case "/js/dock.js": { fileEndpoint = "/dock"; break }
			case "/js/ui.js": { fileEndpoint = "/ui"; break }
			case "/js/wm.js": { fileEndpoint = "/wm"; break }
			case "/js/sw.js": { fileEndpoint = "/sw"; break }

			default: { return log.warn(`An unknown Webdesk's file ${path} (${origin}) was ${kind}`) }
		}

		try {
			const stats = await Deno.stat(origin)
			if (stats.isDirectory) { return log.debug(`"${config.staticFolder}/${path}" is a folder, skipping`) }
			else if (stats.isSymlink) { return log.debug(`"${config.staticFolder}/${path}" is a system link, skipping`) }
		} catch(error) { log.debug(`Error while getting ${origin} stats: ${(error as Error).message}`) }

		switch(kind) {
			case "modify": {
				log.warn(`Webdesk's file at ${fileEndpoint} was modified! Updating endpoint`)
				return this.updateAsset(fileEndpoint, path)
			}
			case "remove": {
				log.warn(`File at ${path} was deleted! Removing endpoint (${fileEndpoint})`)
				delete this.files[fileEndpoint]
				delete this.origins[fileEndpoint]
				return
			}
			case "create": {
				log.warn(`File at ${path} was created! Adding endpoint (${path})`)

				this.updateAsset(fileEndpoint, path)
				return
			}
		}
	}

	private async updateAsset(endpoint: string, relPath: string) {
		this.origins[endpoint] = relPath
		const basePath = `${config.staticFolder}/`
		try {
			const extension = relPath.substring(relPath.lastIndexOf(".") + 1)
			this.files[endpoint] = await Deno.readFile(`${basePath}/${relPath}`)
			this.mimes[endpoint] = MIMES[extension as keyof typeof MIMES]
			this.generateHash()
		}
		catch (error) { log.error(`Failed to register Webdesk's ${endpoint}: ${(error as Error).message}`) }
	}

	private async generateHash() {
		const data = this.hashEncoder.encode(JSON.stringify(this.files))
		const hashArray = new Uint8Array (await crypto.subtle.digest("SHA-1", data))
		const hashText = Array.from(hashArray).map((byte) => { return byte.toString(16).padStart(2, "0") }).join("")

		log.debug(`New assets hash for Webdesk (ends in ${hashText.slice(-4)})`)

		this.hash = hashText
	}

	private returnHashes() {
		const appHashes = Route.getAppsHash()
		Object.assign(appHashes, { webdesk: this.hash })

		return { data: JSON.stringify(appHashes), type: MIMES.json }
	}

	public readonly mimes: Record<string, string> = { }
	public readonly origins: Record<string, string> = { }
	public readonly files: Record<string, Uint8Array | string> = { }
	public readonly commands: Record<string, (req: Request) => (CommandOutput | Response)> = { }

	public respond(request: Request): Response {
		const pathname = new URL(request.url).pathname

		if (this.commands[pathname] && pathname.startsWith("/api")) {
			const result = this.commands[pathname](request)

			if (result instanceof Response) { return result }
			else { return new SmartResponse(request.headers.get("origin"), result.data, result.type) }
		}
		else if (this.files[pathname]) { return new SmartResponse(request.headers.get("origin"), this.files[pathname], this.mimes[pathname]) }
		else { return new SmartResponse(request.headers.get("origin")) }
	}

	private constructor() {
		this.updateAsset("/", `/index.htm`)
		this.updateAsset("/style", `/style.css`)
		this.updateAsset("/titlebar", `/titlebar.htm`)
		this.updateAsset("/manifest", `/manifest.json`)
		this.updateAsset("/favicon.ico", `/webdesk.svg`)

		this.updateAsset("/launchers", `/js/launchers.js`)
		this.updateAsset("/core", `/js/core.js`)
		this.updateAsset("/dock", `/js/dock.js`)
		this.updateAsset("/ui", `/js/ui.js`)
		this.updateAsset("/wm", `/js/wm.js`)
		this.updateAsset("/sw", `/js/sw.js`)
		

		this.commands = {
			"/api/appHashes": this.returnHashes.bind(this),
			"/api/getManifests": Route.getManifests,
		}

		WebdeskRoute.sw = Deno.readFileSync(`${config.staticFolder}/js/sw.js`)

		log.debug(`Webdesk watcher starting`)
		new UpdateWatcher(config.staticFolder, this.watcherEndpointManipulator.bind(this))
	}
}

export class Route {
	private static manifests: Record<string, WebdeskManifest> = { }
	private static hashes: Record<string, string> = { }

	public static readonly registred: Record<string, Route> = { }

	public static getAppsHash() { return Route.hashes }
	public static getManifests(_request: Request) { return { data: JSON.stringify(Route.manifests), type: MIMES.json } }

	public static async create(appName: string): Promise<void> {
		let manifestObject: WebdeskManifest
		try {
			const manifestContents: string = await Deno.readTextFile(`./apps/${appName}/manifest.json`)
			manifestObject = new WebdeskManifest(JSON.parse(manifestContents))
		} catch(error) { return log.debug(`Atempted to make a route for ${appName}, but ${(error as Error).message}`) }
		Route.registred[appName] = new Route(appName, manifestObject)
	}

	private readonly hashEncoder = new TextEncoder()

	private readonly appName: string = ""
	private readonly ignore: string[] = [ ]
	private readonly routes: Record<string, string> = { }
	private readonly origins: Record<string, string> = { }
	private readonly watcherLookup: Record<string, string> = { }

	private async watcherEndpointManipulator(origin: string, kind: string) {
		log.debug(`A ${kind} file event happend to ${this.appName}'s "${origin}"`)

		const path = getApplicationRelativePath(origin)
		const fileEndpoint = this.watcherLookup[path]

		try {
			// TODO: Improve folder handling
			const stats = await Deno.stat(origin)
			if (this.ignore.includes(path)) { return log.debug(`File "${this.appName}/${path}" is ignored`) }
			else if (stats.isDirectory) { return log.debug(`"${this.appName}/${path}" is a folder, skipping`) }
			else if (stats.isSymlink) { return log.debug(`"${this.appName}/${path}" is a system link, skipping`) }
		} catch(error) { log.debug(`Error while getting ${origin} stats: ${(error as Error).message}`) }

		switch(kind) {
			case "modify": {
				log.info(`Updating ${this.appName}'s at ${fileEndpoint} (modified)`)
				return this.updateAsset(fileEndpoint, path)
			}
			case "remove": {
				log.info(`Removing ${this.appName}'s at ${fileEndpoint} (removed)`)
				delete this.files[fileEndpoint]
				delete this.origins[fileEndpoint]
				return
			}
			case "create": {
				const endpoint = this.routes[path] || path
				log.info(`Creating ${this.appName}'s at ${endpoint} (created)`)
				return this.updateAsset(endpoint, path)
			}
		}
	}

	private async registerFolderAssets(path: string = "") {
		const baseFiles = [ this.manifest.index, this.manifest.icon, this.manifest.script, this.manifest.style, "manifest.json" ]
		for await (const entry of Deno.readDir(`${config.appFolder}/${this.appName}${path}`)) {
			if (baseFiles.includes(`${path}${entry.name}`)) { continue }
			else if (this.ignore.includes(`${path}${entry.name}`)) {
				log.debug(`Skipped indexing of application ${this.appName}'s "${entry.name}" per manifest`)
				continue
			}
			else if (entry.isSymlink) { log.debug(`Skipped indexing of application ${this.appName}'s "${entry.name}", is system link`) }
			else if (entry.isDirectory) { this.registerFolderAssets(`${path}/${entry.name}`) }
			else /* if (entry.isFile) */ {
				const endpoint = this.routes[`${path}${entry.name}`] || `${path}/${entry.name}`
				this.updateAsset(endpoint, `${path}/${entry.name}`)
			}
		}
	}

	private async updateAsset(endpoint: string, relPath: string) {
		const basePath = `${config.appFolder}/${this.appName}`
		this.origins[endpoint] = relPath
		this.watcherLookup[relPath] = endpoint

		try {
			const extension = relPath.substring(relPath.lastIndexOf(".") + 1)

			this.files[endpoint] = await Deno.readFile(`${basePath}${relPath}`)
			this.mimes[endpoint] = MIMES[extension as keyof typeof MIMES]

			this.generateHash()
		} catch (error) { log.warn(`Failed to register application ${this.appName}'s ${endpoint}: ${(error as Error).message}`) }
	}

	private async generateHash() {
		const data = this.hashEncoder.encode(JSON.stringify(this.files))
		const hashArray = new Uint8Array (await crypto.subtle.digest("SHA-1", data))
		const hashText = Array.from(hashArray).map((byte) => { return byte.toString(16).padStart(2, "0") }).join("")

		log.debug(`New assets hash for ${this.appName} (ends in ${hashText.slice(-4)})`)

		Route.hashes[this.appName] = hashText
	}

	private registerMainAssets() {
		const { index, icon, script, style } = this.manifest

		if (index) { this.updateAsset("/", index.startsWith("/") ? index : `/${index}`) }
		else { log.info(`Application ${this.appName} has no index specified`) }
		if (icon) { this.updateAsset("/icon", icon.startsWith("/") ? icon : `/${icon}`) }
		else { log.info(`Application ${this.appName} has no icon specified`) }

		if (script) { this.updateAsset("/js", script.startsWith("/") ? script : `/${script}`) }
		else { log.debug(`Application ${this.appName} has no script specified`) }
		if (style) { this.updateAsset("/style", style.startsWith("/") ? style : `/${style}`) }
		else { log.debug(`Application ${this.appName} has no style specified`) }

		// NOTE: Outside the scope of version 1
		// this.addSW()
	}

	private addSW() {
		this.origins["/sw"] = "/sw.js"
		this.files["/sw"] = WebdeskRoute.getSW()
		this.mimes["/sw"] = MIMES.js

		this.generateHash()
	}

	private constructor(appName: string, manifest: WebdeskManifest) {
		log.info(`Making a subdomain route for ${appName}`)

		this.appName = appName
		this.manifest = manifest
		this.ignore = manifest.ignore
		this.routes = manifest.routes

		Route.manifests[appName] = manifest

		this.registerFolderAssets()
		this.registerMainAssets()

		log.debug(`Application ${this.appName} watcher starting`)
		new UpdateWatcher(`${config.appFolder}/${appName}`, this.watcherEndpointManipulator.bind(this))
	}

	public readonly manifest: WebdeskManifest
	public readonly mimes: Record<string, string> = { }
	public readonly files: Record<string, Uint8Array | string> = { }
	public readonly commands: Record<string, (req: Request) => (CommandOutput | Response)> = { }

	public respond(request: Request): Response {
		const pathname = new URL(request.url).pathname

		if (this.commands[pathname] && pathname.startsWith("/api")) {
			const result = this.commands[pathname](request)

			if (result instanceof Response) { return result }
			else { return new SmartResponse(request.headers.get("origin"), result.data, result.type) }
		}
		else if (this.files[pathname]) { return new SmartResponse(request.headers.get("origin"), this.files[pathname], this.mimes[pathname]) }
		else { return new SmartResponse(request.headers.get("origin")) }
	}
}

class UpdateWatcher {
	private watcherIgnoreFileEvent: boolean = false

	async start(folder: string, callback: (path: string, kind: string) => void) {
		for await (const { kind, paths, flag } of Deno.watchFs(folder, { recursive: true })) {
			if (this.watcherIgnoreFileEvent) { continue }
			this.watcherIgnoreFileEvent = true

			if (flag === "rescan") {
				log.debug(`Noticed something (other) happened, refreshing the watcher`)
				this.start(folder, callback)
				return
			}

			for (const path of paths) { callback(path, kind) }

			setTimeout(() => { this.watcherIgnoreFileEvent = false }, 100)
		}
	}

	constructor(folder: string, callback: (path: string, kind: string) => void) {
		this.start(folder, callback)
	}
}

function getApplicationRelativePath(origin: string): string {
	let relPath: string = origin

	if (Deno.build.os === "windows") { relPath = relPath.replaceAll("\\", "/") }

	relPath = relPath.substring(relPath.indexOf(config.appFolder) + config.appFolder.length + 1)
	relPath = relPath.substring(relPath.indexOf("/"))

	return relPath
}

function getWebdeskRelativePath(origin: string): string {
	let relPath: string = origin

	if (Deno.build.os === "windows") { relPath = relPath.replaceAll("\\", "/") }

	relPath = relPath.substring(relPath.indexOf(config.staticFolder) + config.staticFolder.length)

	return relPath
}