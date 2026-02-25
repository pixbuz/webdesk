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

type TitlebarProprieties = {
	path?: string,
	dynamic: boolean,
	buttons: Record<string, string>
}

class WebdeskApplicationManifest {
	routes: Record<string, string> = {}
	titlebar: TitlebarProprieties = {
		path: undefined,
		buttons: {},
		dynamic: false
	}
	description: string = "No description"
	commands: string[] = []
	ignore: string[] = []
	index: string = ""
	icon: string = ""

	// Normalize the data
	constructor(manifest?: WebdeskApplicationManifest) {
		if (manifest) {
			const empty = new WebdeskApplicationManifest()
			const norm = { ...empty, ...manifest }
			norm.ignore = [
				...manifest.ignore || [],
				...this.commands,
				this.titlebar.path || "",
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
	// Return the manifests
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
	commander() {
		// Contains the endpoints mapped to the functions
		const result: Record<string, unknown> = {}
		result["/api/_/manifest"] = manifests	// Retuns all the manifests
		result["/api/_/intro"] = intro	// Returns the intro page

		// Return the object for processing
		return result
	}
	// Indexes webdesk's files
	indexer() {
		// Contains webdesk's assets
		const assets: Record<string, Uint8Array> = {
			"/": Deno.readFileSync(`${config.staticFolder}/index.htm`),
			"/style": Deno.readFileSync(`${config.staticFolder}/style.css`),
			"/script": Deno.readFileSync(`${config.staticFolder}/script.js`),
			"/sw": Deno.readFileSync(`${config.staticFolder}/serviceWorker.js`),
			"/manifest": Deno.readFileSync(`${config.staticFolder}/manifest.json`),
		}
		const origins: Record<string, string> = {
			"/": `${config.staticFolder}/index.htm`,
			"/style": `${config.staticFolder}/style.css`,
			"/script": `${config.staticFolder}/script.js`,
			"/sw": `${config.staticFolder}/serviceWorker.js`,
			"/manifest": `${config.staticFolder}/manifest.json`,
		}
		// Contains webdesk's commands
		const commands: Record<string, unknown> = this.commander()
		// Return the assets and commands
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

		// Return the assets object
		return [ assets, origins ]
	}
	// Register the app's titlebar
	private async indexTitlebar(appName: string, path: string) {
		const result: { [endpoint: string]: unknown } = { [`/apps/${appName}/titlebar`]: undefined }
		if (path == "") { result.endpoint = await Deno.readTextFile(`${config.staticFolder}/titlebar.htm`) } }
		else { result }
		return { [endpoint]: await Deno.readTextFile(`${config.appFolder}/${path}`) }
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

		// Retun the app commands
		return commands
	}
	// Indexes an app, assets and commands included
	// TODO: titlebar indexing
	async index(appName: string) {
		// Read and normalize the manifest
		const manifest: WebdeskApplicationManifest = new WebdeskApplicationManifest(JSON.parse(await Deno.readTextFile(`${config.appFolder}/${appName}/manifest.json`)))
		// Save the application manifest
		applications.manifests[appName] = manifest
		// Index the app default assets
		const [assets, origins] = await this.indexAssets(appName, manifest.routes, manifest.ignore)
		Object.assign(assets, this.indexTitlebar(appName, manifest.titlebar.path))
		// Index the app commands
		const commands = await this.indexCommands(appName, manifest.commands)
		// Return all the app stuff
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

	constructor() {(async () => {
		// For every app in the app folder
		for await (const entry of Deno.readDir(`${config.appFolder}/`)) {
			// TODO: ensure the manifest is present before indexing
			if (!entry.isDirectory) { continue }
			// Register the app resources to the server
			applications.index(entry.name).then(([assets, origins, commands]) => {
				this.registerAssets(assets, origins)
				this.registerCommand(commands)
			})
		}

		// Register webdesk resources to the server
		const [webdeskAssets, webdeskOrigins, webdeskCommands] = webdesk.indexer()
		this.registerAssets(webdeskAssets, webdeskOrigins)
		this.registerCommand(webdeskCommands)
	})()}
}