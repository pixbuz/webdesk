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

// Describes the titlebar propriety fields
type TitlebarProprieties = {
	path?: string,
	icon: boolean,
	dynamic: boolean,
	buttons: Record<string, string>,
}

// Provided a manifest object, returns it normalized
// ^^^^^^^^ with no manifest, returns an empty manifest
class WebdeskApplicationManifest {
	routes: Record<string, string> = {}
	titlebar: TitlebarProprieties = {
		icon: true,
		buttons: {},
		dynamic: false,
		path: undefined,
	}
	description: string = "No description"
	modules: string[] = []
	ignore: string[] = []
	index: string = ""
	icon: string = ""

	constructor(manifest?: WebdeskApplicationManifest) {
		if (manifest) {
			const empty = new WebdeskApplicationManifest()
			const norm = { ...empty, ...manifest }
			norm.titlebar = { ...empty.titlebar, ...(manifest.titlebar || {}) }
			norm.ignore = [
				...manifest.ignore || [],
				...this.modules,
				"manifest.json",
			]

			return norm
		}
	}
}

// Returns the intro page
function intro(_queries: string[]) {
	return [ Deno.readFileSync(`${config.staticFolder}/intropage.htm`), "text/html; charset=UTF-8" ] as [unknown, string]
}
// Get command for an app or all app manifests
function manifests(queries: string[]) {
	// Return string
	let manifests: string = ""

	// For all apps the request contains
	for (const app of queries) {
		// If no app specified, send the full app list
		if (!app) {
			manifests = `,${JSON.stringify(applications.manifests)}`
			break
		}
		// Return the app manifest or an empty object
		manifests += `,${JSON.stringify(applications.manifests[app] || { })}`
	}

	return [ manifests.substring(1), "application/json" ] as [unknown, string]
}
// Webdesk logic class
const webdesk = new class {
	css: string = "" // CSS
	html: string = "" // HTML
	manifest: string = "" // PWA manifest
	script: string = "" // Frontend script
	sw: string = "" // Service worker script

	// Indexes webdesk's API commands
	command() {
		// Contains the endpoints mapped to the functions
		const commands: Record<string, unknown> = {}
		commands["/api/_/manifest"] = manifests	// Retuns all the manifests
		commands["/api/_/intro"] = intro	// Returns the intro page
		commands["/api/_/titlebar"] = Deno.readTextFileSync(`${config.staticFolder}/titlebar.htm`)

		return commands
	}
	// Indexes webdesk's files
	index() {
		// Contains webdesk's file contents
		const assets: Record<string, Uint8Array> = {}
		// Contains webdesk's file paths
		const origins: Record<string, string> = {}

		assets["/"] = Deno.readFileSync(origins["/"] = `${config.staticFolder}/index.htm`)
		assets["/style"] = Deno.readFileSync(origins["/style"] = `${config.staticFolder}/style.css`)
		assets["/sw"] = Deno.readFileSync(origins["/sw"] = `${config.staticFolder}/serviceWorker.js`)
		assets["/script"] = Deno.readFileSync(origins["/script"] = `${config.staticFolder}/script.js`)
		assets["/manifest"] = Deno.readFileSync(origins["/manifest"] = `${config.staticFolder}/manifest.json`)

		// Contains webdesk's api commands
		const commands: Record<string, unknown> = this.command()

		return [ assets, origins, commands ]
	}
}
// Application indexer logic class
const applications = new class {
	// Contains the manifests of the installed apps
	manifests: Record<string, WebdeskApplicationManifest> = {}
	// Indexes all the wanted app assets in parallel
	private async indexAssets(appName: string, custom: Record<string, string>, ignore: string[], path: string = ""): Promise<[Record<string, Uint8Array>, Record<string, string>]> {
		// Contains an apps assets
		const assets: Record<string, Uint8Array> = {}
		// Used for file types an apps assets
		const origins: Record<string, string> = {}
		// Processing queue
		const indexingTasks: Promise<[Record<string, Uint8Array>, Record<string, string>]>[] = []

		// Read all the files in the current folder
		for await (const entry of Deno.readDir(`${config.appFolder}/${appName}${path}`)) {
			// If the ignore list contains the relative path of an entry, skip indexing
			if (ignore.includes(`${path}${entry.name}`) || entry.isSymlink) {
				log.debug(`Skipped indexing of ${appName}'s ${entry.name} (from "${config.appFolder}/${appName}${path}")`)
				continue
			}
			// If the entry is a folder, queue it to index
			else if (entry.isDirectory) { indexingTasks.push(this.indexAssets(appName, custom, ignore, `${path}/${entry.name}`)) }
			// If the file is supposed to have a custom path, use it
			else if (custom[`${path}${entry.name}`]) {
				assets[`/${config.appFolder}/${appName}/${custom[`${path}${entry.name}`]}`] = Deno.readFileSync(
					origins[`/${config.appFolder}/${appName}/${custom[`${path}${entry.name}`]}`] = `${config.appFolder}/${appName}${path}/${entry.name}`
				)
			}
			// Otherwise save it as the relative path
			else {
				assets[`/${config.appFolder}/${appName}${path}/${entry.name}`] = Deno.readFileSync(
					origins[`/${config.appFolder}/${appName}${path}/${entry.name}`] = `${config.appFolder}/${appName}${path}/${entry.name}`
				)
			}
		}

		// Wait for all subfolders to finish indexing
		const subfolders = await Promise.all(indexingTasks)
		for (const [subAssets, subOrigins] of subfolders) {
			// Add the assets from the subfolders
			Object.assign(assets, subAssets)
			// Add the origins from the subfolders
			Object.assign(origins, subOrigins)
		}

		return [ assets, origins ]
	}
	// Register the commands of an app
	private async indexCommands(appName: string, modules: string[] = []) {
		// Contains the application commands
		const commands: Record<string, unknown> = {}

		// For each file with server commands
		for (const path of modules) {
			// Import the module
			const module = await import(`../${config.appFolder}/${appName}/${path}`)
			// For each export of the module, map it to an endpoint
			for (const entry of Object.keys(module)) {
				commands[`/api/${appName}/${entry}`] = module[entry]
			}
		}

		return commands
	}
	// Indexes an app, assets and commands included
	async index(appName: string) {
		// Read the manifest contents as text
		const textManifest = await Deno.readTextFile(`${config.appFolder}/${appName}/manifest.json`)
		// Normalize the manifest
		const manifest: WebdeskApplicationManifest = new WebdeskApplicationManifest(JSON.parse(textManifest))
		// Save the application manifest
		applications.manifests[appName] = manifest

		// Index the app default assets
		const [assets, origins] = await this.indexAssets(appName, manifest.routes, manifest.ignore)
		// Index the app commands
		const commands = await this.indexCommands(appName, manifest.modules)

		return [ assets, origins, commands ]
	}
}
// Server resources as in assets and commands, and assets mime type
export const resources = new class {
	// Maps endpoints to the associated assets
	assets: Record<string, Uint8Array> = {}
	// Contains the endpoints MIME types
	mime: Record<string, string | undefined> = {}
	// Maps endpoints to the associated function
	commands: Record<string, unknown> = {}
	// Batch log stuff
	private logRegistred(message: string, endpoints: string[]) {
		for (const endpoint of endpoints) {
			log.info(`${message} "${endpoint}"`)
		}
	}
	// Register the mime of a batch of assets
	private registerMimes(origin: Record<string, string>) {
		for (const endpoint of Object.keys(origin)) {
			this.mime[endpoint] = MIMES[origin[endpoint].split(".").at(-1)!]
		}
	}
	// Register a server asset
	private registerAssets(asset = {}, origins = {}) {
		this.logRegistred("Registred asset on", Object.keys(asset))
		this.registerMimes(origins)
		Object.assign(this.assets, asset)
	}
	// Register a server command
	private registerCommand(command = {}) {
		this.logRegistred("Registred command on", Object.keys(command))
		Object.assign(this.commands, command)
	}

	private async init() {
		// For every app in the app folder
		for await (const entry of Deno.readDir(`${config.appFolder}/`)) {
			if (!entry.isDirectory) { continue }
			// Register the app resources to the server
			applications.index(entry.name).then(([appAssets, appOrigins, appCommands]) => {
				this.registerAssets(appAssets, appOrigins)
				this.registerCommand(appCommands)
			}).catch((error: Error) => { log.warn(`Error during indexing of app "${entry.name}": ${error.message}`) })
		}

		// Register webdesk resources to the server
		const [webdeskAssets, webdeskOrigins, webdeskCommands] = webdesk.index()
		this.registerAssets(webdeskAssets, webdeskOrigins)
		this.registerCommand(webdeskCommands)
	}

	constructor() {(async () => {
		this.init()
		for await (const _event of Deno.watchFs(".", { recursive: true })) {
			// TODO: improve the updating
			this.init()
		}
	})()}
}