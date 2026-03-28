// TODO: Handle applicationWatcher special cases

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

class WebdeskApplicationManifest {
	routes: Record<string, string> = {}
	description: string = "No description"
	modules: string[] = []
	titlebar: string = ""
	ignore: string[] = []
	dni: boolean = false
	index: string = ""
	icon: string = ""

	constructor(manifest?: WebdeskApplicationManifest) {
		if (manifest) {
			const empty = new WebdeskApplicationManifest()
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

type ResourcesUpdatedData = {
	origins: Record<string, string>
	commands: Record<string, unknown>
	assets: Record<string, string | Uint8Array>
}

type AssetUpdatedData = {
	endpoint: string
	data: Uint8Array
	origin: string
}

class BackendEvent<T = void> {
	private callbacks: ((data: T) => void)[] = [ ]

	static RESOURCES_UPDATED = new BackendEvent<ResourcesUpdatedData>()
	static ASSET_UPDATED = new BackendEvent<AssetUpdatedData>()

	emit(data: T) { this.callbacks.forEach((callback) => { callback(data) }) }
	on(...newCallbacks: ((data: T) => void)[]) { this.callbacks.push(...newCallbacks) }

	constructor() { }
}

const webdesk = new class {
	private ignoreFileEvents = false

	private async watcher() {
		for await (const fileEvent of Deno.watchFs("static")) {
			if (webdesk.ignoreFileEvents) { continue }
			webdesk.ignoreFileEvents = true

			switch (fileEvent.kind) {
				case "any": log.debug(`Noticed something (any) happened to "${fileEvent.paths.join(`" and "`)}"`); continue
				case "other": log.debug(`Noticed something (other) happened to "${fileEvent.paths.join(`" and "`)}"`); continue

				case "access": log.debug(`Noticed a file access for "${fileEvent.paths.join(`" and "`)}" was/were accessed`); continue
				case "create": log.debug(`Noticed a file creation for "${fileEvent.paths.join(`" and "`)}" was/were created`); continue
				case "rename": log.debug(`Noticed a file rename for "${fileEvent.paths.join(`" and "`)}" was/were renamed`); continue
				case "remove": log.debug(`Noticed a file deletion for "${fileEvent.paths.join(`" and "`)}" was/were deleted`); continue

				case "modify": log.debug(`Noticed that "${fileEvent.paths.join(`" and "`)}" was/were modified`); break
			}

			fileEvent.paths.forEach((path: string) => {
				let file
				
				if (config.platform === 0) { file = path.substring(resources.cwd.length + 1).replaceAll("\\", "/") }
				else { file = path.substring(resources.cwd.length + 3) }

				log.warn(`Webdesk file modified! Updating endpoint`)

				switch(file) {
					case `${config.staticFolder}/index.htm`: return BackendEvent.ASSET_UPDATED.emit({ endpoint: "/", data: Deno.readFileSync(file), origin: file })
					case `${config.staticFolder}/style.css`: return BackendEvent.ASSET_UPDATED.emit({ endpoint: "/style", data: Deno.readFileSync(file), origin: file })
					case `${config.staticFolder}/serviceWorker.js`: return BackendEvent.ASSET_UPDATED.emit({ endpoint: "/sw", data: Deno.readFileSync(file), origin: file })
					case `${config.staticFolder}/script.js`: return BackendEvent.ASSET_UPDATED.emit({ endpoint: "/script", data: Deno.readFileSync(file), origin: file })
					case `${config.staticFolder}/manifest.json`: return BackendEvent.ASSET_UPDATED.emit({ endpoint: "/manifest", data: Deno.readFileSync(file), origin: file })
				}
			})

			setTimeout(() => { webdesk.ignoreFileEvents = false }, 75)
		}
	}
	register(): { assets: Record<string, string | Uint8Array>, origins: Record<string, string>, commands: Record<string, unknown> } {
		const assets: Record<string, Uint8Array> = {}
		const origins: Record<string, string> = {}

		assets["/"] = Deno.readFileSync(origins["/"] = `${config.staticFolder}/index.htm`)
		assets["/style"] = Deno.readFileSync(origins["/style"] = `${config.staticFolder}/style.css`)
		assets["/sw"] = Deno.readFileSync(origins["/sw"] = `${config.staticFolder}/serviceWorker.js`)
		assets["/script"] = Deno.readFileSync(origins["/script"] = `${config.staticFolder}/script.js`)
		assets["/manifest"] = Deno.readFileSync(origins["/manifest"] = `${config.staticFolder}/manifest.json`)

		const commands: Record<string, unknown> = {
			"/api/_/assetsHash": resources.getAssetsHash,
			"/api/_/getManifests": applications.getManifests,
			"/api/_/defaultTitlebar": [ Deno.readFileSync(`${config.staticFolder}/titlebar.htm`), "text/html" ],
		}

		return { assets: assets, origins: origins, commands: commands }
	}

	constructor() {
		this.watcher()
	}
}

const applications = new class {
	private ignoreFileEvents = false
	private manifests: Record<string, WebdeskApplicationManifest> = {}

	private async getAssets(appName: string, custom: Record<string, string>, ignore: string[], path: string = ""): Promise<{ assets: Record<string, Uint8Array>, origins: Record<string, string> }> {
		const localOrigins: Record<string, string> = {}
		const localAssets: Record<string, Uint8Array> = {}
		const indexingTasks: Promise<{ assets: Record<string, Uint8Array>, origins: Record<string, string> }>[] = []

		for await (const entry of Deno.readDir(`${config.appFolder}/${appName}${path}`)) {
			if (ignore.includes(`${path}${entry.name}`) || entry.isSymlink) {
				log.debug(`Skipped indexing of application ${appName}'s "${entry.name}" (from "${config.appFolder}/${appName}${path}")`)
				continue
			}
			else if (entry.isDirectory) { indexingTasks.push(this.getAssets(appName, custom, ignore, `${path}/${entry.name}`)) }
			else {
				const endpointPath = custom[`${path}${entry.name}`] || `${path}/${entry.name}`.substring(1)
				const endpoint = `/apps/${appName}/` + endpointPath
				localAssets[endpoint] = Deno.readFileSync(localOrigins[endpoint] = `${config.appFolder}/${appName}${path}/${entry.name}`)
			}
		}

		const subFolders = await Promise.all(indexingTasks)

		for (const subFolder of subFolders) {
			Object.assign(localAssets, subFolder.assets)
			Object.assign(localOrigins, subFolder.origins)
		}

		return { assets: localAssets, origins: localOrigins }
	}
	private async watcher() {
		for await (const fileEvent of Deno.watchFs("apps", { recursive: true })) {
			if (applications.ignoreFileEvents) { continue }
			applications.ignoreFileEvents = true

			switch (fileEvent.kind) {
				case "any": log.debug(`Noticed something (any) happened to "${fileEvent.paths.join(`" and "`)}"`); continue
				case "other": log.debug(`Noticed something (other) happened to "${fileEvent.paths.join(`" and "`)}"`); continue

				case "access": log.debug(`Noticed a file access for "${fileEvent.paths.join(`" and "`)}" was/were accessed`); continue
				case "create": log.debug(`Noticed a file creation for "${fileEvent.paths.join(`" and "`)}" was/were created`); continue
				case "rename": log.debug(`Noticed a file rename for "${fileEvent.paths.join(`" and "`)}" was/were renamed`); continue
				case "remove": log.debug(`Noticed a file deletion for "${fileEvent.paths.join(`" and "`)}" was/were deleted`); continue

				case "modify": log.debug(`Noticed that "${fileEvent.paths.join(`" and "`)}" was/were modified`); break
			}

			fileEvent.paths.forEach((path: string) => {
				let file
				
				if (config.platform === 0) { file = path.substring(resources.cwd.length + 1).replaceAll("\\", "/") }
				else { file = path.substring(resources.cwd.length + 3) }

				const fileEndpoint = resources.origins[file]

				if (fileEndpoint) {
					log.info(`File modified! Requesting endpoint update`)
					BackendEvent.ASSET_UPDATED.emit({ endpoint: fileEndpoint, data: Deno.readFileSync(file), origin: file })
				}
			})

			setTimeout(() => { applications.ignoreFileEvents = false }, 75)
		}
	}
	private async getCommands(appName: string, modules: string[] = []) {
		const commands: Record<string, unknown> = {}

		for (const path of modules) {
			const module = await import(`../${config.appFolder}/${appName}/${path}`)
			for (const entry of Object.keys(module)) { commands[`/api/${appName}/${entry}`] = module[entry] }
		}

		return commands
	}
	async register(appName: string): Promise<{ assets: Record<string, string | Uint8Array>, origins: Record<string, string>, commands: Record<string, unknown> }> {
		const textManifest = await Deno.readTextFile(`${config.appFolder}/${appName}/manifest.json`)
		const manifest: WebdeskApplicationManifest = new WebdeskApplicationManifest(JSON.parse(textManifest))
		applications.manifests[appName] = manifest

		const { assets: appAssets, origins: appOrigins } = await this.getAssets(appName, manifest.routes, manifest.ignore)
		const appCommands = await this.getCommands(appName, manifest.modules)

		return { assets: appAssets, origins: appOrigins, commands: appCommands }
	}
	getManifests(_request: Request) {
		return new Response(JSON.stringify(applications.manifests), { status: 200, headers: { "content-type": MIMES.json } })
	}

	constructor() {
		this.watcher()
	}
}

export const resources = new class {
	private hash: string = ""

	readonly cwd = Deno.cwd()

	mime: Record<string, string | undefined> = {}
	assets: Record<string, Uint8Array> = {}
	commands: Record<string, unknown> = {}
	origins: Record<string, string> = {}

	private async generateHashFromAssets() {
		const data = new TextEncoder().encode(JSON.stringify(resources.assets))
		const hashBuffer = await crypto.subtle.digest("SHA-1", data)
		const hashArray = Array.from(new Uint8Array(hashBuffer))

		resources.hash = hashArray.join("")
		log.debug(`Assets hash changed: ${resources.hash}`)
	}
	private logRegistred(message: string, endpoints: string[]) {
		endpoints.forEach((endpoint) => { log.info(`${message} "${endpoint}"`) })
	}
	private registerResources({ assets, origins, commands }: { assets: Record<string, string | Uint8Array>, origins: Record<string, string>, commands: Record<string, unknown> }) {
		const assetCount = Object.keys(assets).length
		const commandCount = Object.keys(commands).length

		resources.logRegistred("Registred asset on", Object.keys(assets))

		for (const endpoint of Object.keys(origins)) {
			resources.mime[endpoint] = MIMES[origins[endpoint].split(".").at(-1)!]
			resources.origins[origins[endpoint]] = endpoint
		}

		Object.assign(resources.assets, assets)

		resources.logRegistred("Registred command on", Object.keys(commands))
		Object.assign(resources.commands, commands)

		log.info(`Updated ${assetCount} assets and ${commandCount} commands`)
		resources.generateHashFromAssets()
	}
	private registerAsset({ endpoint, data, origin }: { endpoint: string, data: Uint8Array | string, origin: string }) {
		const update = {
			assets: { [endpoint]: data },
			origins: { [endpoint]: origin },
			commands: { },
		}

		resources.registerResources(update)
	}
	private async init() {
		for await (const entry of Deno.readDir(`${config.appFolder}/`)) {
			if (!entry.isDirectory) { continue }

			try { resources.registerResources(await applications.register(entry.name)) }
			catch(error) { log.warn(`Error during indexing of app "${entry.name}": ${(error as Error).message}`) }
		}

		resources.registerResources(webdesk.register())
	}
	getAssetsHash() { return resources.hash }

	constructor() {
		this.init()

		BackendEvent.RESOURCES_UPDATED.on(this.registerResources)
		BackendEvent.ASSET_UPDATED.on(this.registerAsset)
	}
}