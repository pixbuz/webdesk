// TODO: Keep in cache only most requested files using a point system

import { log } from "./log.ts"
import { config } from "../server.config.ts"

const MIMES: Readonly<Record<string, string>> = Object.freeze({
	"html": "text/html",
	"htm": "text/html",
	"css": "text/css",
	"js": "text/javascript",
	"txt": "text/plain",
	"xml": "text/xml",

	"jpg": "image/jpeg",
	"jpeg": "image/jpeg",
	"png": "image/png",
	"gif": "image/gif",
	"svg": "image/svg+xml",
	"ico": "image/x-icon",
	"webp": "image/webp",

	"woff": "font/woff",
	"woff2": "font/woff2",
	"ttf": "font/ttf",
	"otf": "font/otf",

	"json": "application/json",
	"pdf": "application/pdf",
	"zip": "application/zip",
	"bin": "application/octet-stream",

	"mp3": "audio/mpeg",
	"mp4": "video/mp4",
	"wav": "audio/wav",
})

const cwd = Deno.cwd()

class SmartResponse extends Response {
	constructor(body?: any, mime: string = "text/plain") {
		let content: BodyInit, code: number

		if (body === undefined) { content = ""; code = 400 }
		else { content = body as BodyInit; code = 200 }

		super(content, { status: code, headers: { "content-type": mime } })
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
	private watcherIgnoreFileEvent: boolean = false

	public static create() {
		if (WebdeskRoute.initialized) { return }
		else { return new WebdeskRoute() }
	}

	private async watcher() {
		log.debug(`Webdesk watcher started`)
		for await (const { kind, paths, flag } of Deno.watchFs(`${config.staticFolder}`, { recursive: true })) {
			if (this.watcherIgnoreFileEvent) { continue }
			this.watcherIgnoreFileEvent = true

			if (flag === "rescan") {
				log.debug(`Noticed something (other) happened, refreshing the watcher`)
				this.watcher()
				return
			}

			this.watcherEndpointManipulator(paths, kind)

			setTimeout(() => { this.watcherIgnoreFileEvent = false }, 100)
		}
	}

	private watcherEndpointManipulator(paths: string[], kind: string) {
		log.debug(`A "${kind}" file event happend to Webdesk's files: "${paths.join(`", "`)}"`)

		paths.forEach(async (origin: string) => {
			const path = this.getRelativePath(origin)
			const fileEndpoint = this.origins[path]

			try {
				const stats = await Deno.stat(origin)
				if (stats.isDirectory) { return log.debug(`"${config.staticFolder}/${path}" is a folder, skipping`) }
				else if (stats.isSymlink) { return log.debug(`"${config.staticFolder}/${path}" is a system link, skipping`) }
			} catch(error) { log.debug(`Error while getting ${origin} stats: ${(error as Error).message}`) }

			switch(kind) {
				case "modify": {
					log.warn(`Webdesk's file at ${path} was modified! Updating endpoint`)
					return this.updateAsset(fileEndpoint, origin)
				}
				case "remove": {
					log.warn(`File at ${path} was deleted! Removing endpoint (${fileEndpoint})`)
					delete this.files[fileEndpoint]
					delete this.origins[fileEndpoint]
					return
				}
				case "create": {
					log.warn(`File at ${path} was created! Adding endpoint (${path})`)

					this.updateAsset(path, origin)
					return
				}
			}
		})
	}

	private getRelativePath(origin: string) {
		const baseRemove = cwd.length + config.staticFolder.length

		if (config.platform === 0) { return origin.substring(baseRemove + 1).replaceAll("\\", "/") }
		else { return origin.substring(baseRemove + 3) }
	}

	private async updateAsset(endpoint: string, origin: string) {
		try {
			this.files[endpoint] = await Deno.readFile(this.origins[endpoint] = origin)
			const extension = origin.substring(origin.lastIndexOf(".") + 1)
			
			this.mimes[endpoint] = MIMES[extension]
		}
		catch (error) { log.error(`Failed to register Webdesks's ${endpoint}: ${(error as Error).message}`) }
	}

	public readonly mimes: Record<string, string> = { }
	public readonly origins: Record<string, string> = { }
	public readonly commands: Record<string, (req: Request) => (CommandOutput | Response)> = { }
	public readonly files: Record<string, Uint8Array | string> = { }

	public respond(request: Request): Response {
		const pathname = new URL(request.url).pathname

		if (this.commands[pathname] && pathname.startsWith("/api")) {
			const result = this.commands[pathname](request)

			if (result instanceof Response) { return result }
			else { return new SmartResponse(result.data, result.type) }
		}
		else if (this.files[pathname]) { return new SmartResponse(this.files[pathname], this.mimes[pathname]) }
		else { return new SmartResponse() }
	}

	private constructor() {
		this.updateAsset("/", `${config.staticFolder}/index.htm`)
		this.updateAsset("/style", `${config.staticFolder}/style.css`)
		this.updateAsset("/manifest", `${config.staticFolder}/manifest.json`)
		this.updateAsset("/titlebar", `${config.staticFolder}/titlebar.htm`)

		this.updateAsset("/launchers", `${config.staticFolder}/js/launchers.js`)
		this.updateAsset("/core", `${config.staticFolder}/js/core.js`)
		this.updateAsset("/dock", `${config.staticFolder}/js/dock.js`)
		this.updateAsset("/ui", `${config.staticFolder}/js/ui.js`)
		this.updateAsset("/wm", `${config.staticFolder}/js/wm.js`)
		this.updateAsset("/sw", `${config.staticFolder}/js/sw.js`)

		this.commands = {
			// "/api/_/assetsHash": Route.getAssetsHash,
			"/api/getManifests": Route.getManifests,
		}

		this.watcher()
	}
}

export class Route {
	private static manifests: Record<string, WebdeskManifest> = { }

	public static readonly registred: Record<string, Route> = { }

	public static async create(appName: string): Promise<void> {
		let manifestObject: WebdeskManifest

		try {
			const manifestContents: string = await Deno.readTextFile(`./apps/${appName}/manifest.json`)
			manifestObject = new WebdeskManifest(JSON.parse(manifestContents))
		} catch(error) {
			log.debug(`Atempted to make a route for ${appName}, but ${(error as Error).message}`)
			return
		}

		Route.registred[appName] = new Route(appName, manifestObject)
	}

	public static getManifests(_request: Request) {
		return { data: JSON.stringify(Route.manifests), type: MIMES.json }
	}

	private appName: string = ""
	private ignore: string[] = [ ]
	private routes: Record<string, string> = { }
	private watcherIgnoreFileEvent: boolean = false

	private async watcher() {
		log.debug(`Application ${this.appName} watcher started`)
		for await (const { kind, paths, flag } of Deno.watchFs(`${config.appFolder}/${this.appName}`, { recursive: true })) {
			if (this.watcherIgnoreFileEvent) { continue }
			this.watcherIgnoreFileEvent = true

			if (flag === "rescan") {
				log.debug(`Noticed something (other) happened, refreshing the watcher`)
				this.watcher()
				return
			}

			this.watcherEndpointManipulator(paths, kind)

			setTimeout(() => { this.watcherIgnoreFileEvent = false }, 100)
		}
	}

	private watcherEndpointManipulator(paths: string[], kind: string) {
		log.debug(`A "${kind}" file event happend to "${this.appName}"'s files: "${paths.join(`", "`)}"`)

		paths.forEach(async (origin: string) => {
			const path = this.getRelativePath(origin)
			const fileEndpoint = this.origins[path]

			try {
				const stats = await Deno.stat(origin)
				if (this.ignore.includes(path)) { return log.debug(`File "${this.appName}/${path}" is ignored`) }
				else if (stats.isDirectory) { return log.debug(`"${this.appName}/${path}" is a folder, skipping`) }
				else if (stats.isSymlink) { return log.debug(`"${this.appName}/${path}" is a system link, skipping`) }
			} catch(error) { log.debug(`Error while getting ${origin} stats: ${(error as Error).message}`) }

			switch(kind) {
				case "modify": {
					log.info(`"${this.appName}"'s file at ${path} was modified! Updating endpoint`)
					return this.updateAsset(fileEndpoint, origin)
				}
				case "remove": {
					log.info(`File at ${path} was deleted! Removing endpoint (${fileEndpoint})`)
					delete this.files[fileEndpoint]
					delete this.origins[fileEndpoint]
					return
				}
				case "create": {
					const endpoint = this.routes[path] || path
					log.info(`File at ${path} was created! Adding endpoint (${endpoint})`)

					this.updateAsset(endpoint, origin)
					return
				}
			}
		})
	}

	private async registerFolderAssets(path: string = "") {
		const baseFiles = [ this.manifest.index, this.manifest.icon, this.manifest.script, this.manifest.style, "manifest.json" ]

		for await (const entry of Deno.readDir(`${config.appFolder}/${this.appName}${path}`)) {
			if (baseFiles.includes(`${path}${entry.name}`)) { continue }
			else if (this.ignore.includes(`${path}${entry.name}`) || entry.isSymlink) {
				log.debug(`Skipped indexing of "${this.appName}"'s "${entry.name}" as per manifest (from "${config.appFolder}/${this.appName}${path}")`)
				continue
			}
			else if (entry.isDirectory) { this.registerFolderAssets(`${path}/${entry.name}`) }
			else {
				const endpoint = this.routes[`${path}${entry.name}`] || `${path}/${entry.name}`

				this.updateAsset(endpoint, `${config.appFolder}/${this.appName}${path}/${entry.name}`)
			}
		}
	}

	private registerMainAssets() {
		const basePath = `${config.appFolder}/${this.appName}`

		this.updateAsset("/", `${basePath}/${this.manifest.index}`)
		this.updateAsset("/js", `${basePath}/${this.manifest.script}`)
		this.updateAsset("/icon", `${basePath}/${this.manifest.icon}`)
		this.updateAsset("/style", `${basePath}/${this.manifest.style}`)
	}

	private getRelativePath(origin: string) {
		const baseRemove = cwd.length + config.appFolder.length + this.appName.length + 2

		if (config.platform === 0) { return origin.substring(baseRemove + 1).replaceAll("\\", "/") }
		else { return origin.substring(baseRemove + 3) }
	}

	private async updateAsset(endpoint: string, origin: string) {
		try {
			this.files[endpoint] = await Deno.readFile(this.origins[endpoint] = origin)
			const extension = origin.substring(origin.lastIndexOf(".") + 1)

			this.mimes[endpoint] = MIMES[extension]
		}
		catch (error) { log.warn(`Failed to register "${this.appName}"'s ${endpoint}: ${(error as Error).message}`) }
	}

	public readonly manifest: WebdeskManifest
	public readonly mimes: Record<string, string> = { }
	public readonly origins: Record<string, string> = { }
	public readonly commands: Record<string, (req: Request) => (CommandOutput | Response)> = { }
	public readonly files: Record<string, Uint8Array | string> = { }

	public respond(request: Request): Response {
		const pathname = new URL(request.url).pathname

		if (this.commands[pathname] && pathname.startsWith("/api")) {
			const result = this.commands[pathname](request)

			if (result instanceof Response) { return result }
			else { return new SmartResponse(result.data, result.type) }
		}
		else if (this.files[pathname]) { return new SmartResponse(this.files[pathname], this.mimes[pathname]) }
		else { return new SmartResponse() }
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
		this.watcher()
	}
}