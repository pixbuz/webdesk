import { log } from "./log.ts"

type AssetsLookupTable = {
	[key: string]: Uint8Array<ArrayBuffer> | string
}

type CommandsLookupTable = {
	[key: string]: Function
}

type TitlebarProprieties = {
	path: string,
	dynamic: boolean,
	buttons: Record<string, string>
}

class WebdeskApplicationManifest {
	routes: Record<string, string>
	description: string
	commands: string[]
	ignore: string[]
	titlebar: TitlebarProprieties
	index: string
	icon: string

	constructor(manifest: WebdeskApplicationManifest) {
		this.description = manifest.description || "Undefined description"
		this.commands = manifest.commands || []
		this.routes = manifest.routes || {}
		this.index = manifest.index || ""
		this.icon = manifest.icon || ""

		this.ignore = [
			...manifest.ignore || [],
			...this.commands,
			"/manifest.json",
		]

		this.titlebar = {
			path: "",
			buttons: {},
			dynamic: false,
		}
		this.titlebar = { ...this.titlebar, ...manifest.titlebar}
	}
}

// Returns the intro page
function intro(_queries: string[]) {
	return [ Deno.readFileSync("static/intropage.htm"), "text/html; charset=UTF-8" ]
}
// Command for fetching the default app titlebar
function titlebar(queries: string[]) {
	// Return html string
	let titlebar: string = ""
	for (const app of queries) {
		// If the app has a titlebar specified, read the html and return it
		// If no app specified, return the default titlebar
		if (app && applications.manifests[app].titlebar) {
			titlebar = Deno.readTextFileSync(`apps/${app}/${applications.manifests[app].titlebar}`)
		} else {
			titlebar = Deno.readTextFileSync(`static/titlebar.htm`)
			break
		}
	}
	// Return the titlebar
	return [ titlebar, "text/html; charset=UTF-8" ]
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
	return [ manifests.substring(1), "application/json" ]
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
		const result: CommandsLookupTable = {}
		result["/api/_/manifest"] = manifests	// Retuns all the manifests
		result["/api/_/titlebar"] = titlebar	// Retuns an application titlebar
							// TODO: Passive indexing
		result["/api/_/intro"] = intro	// Returns the intro page
		// Return the object for processing
		return result
	}
	// TODO: Ugly sad miserable hack
	index() {
		// Contains webdesk's assets
		const assets: AssetsLookupTable = {
			"/": Deno.readTextFileSync("static/index.htm"),
			"/script": Deno.readTextFileSync(`static/script.js`),
			"/sw": Deno.readTextFileSync(`static/serviceWorker.js`),
			"/manifest": Deno.readTextFileSync(`static/manifest.json`),
			"/style": `${Deno.readTextFileSync(`static/css/base.css`)}\n${Deno.readTextFileSync(`static/css/customization.css`)}\n${Deno.readTextFileSync(`static/css/intro.css`)}\n${Deno.readTextFileSync(`static/css/animations.css`)}`,
		}
		// Contains webdesk's commands
		const commands: CommandsLookupTable = this.commander()
		// Return the assets and commands
		return [ assets, commands ]
	}
}
// Application indexer logic class
const applications = new class {
	// Contains the manifests of the installed apps
	manifests: Record<string, WebdeskApplicationManifest> = {}
	// Indexes all the wanted app assets in parallel
	private async indexAssets(appName: string, custom: Record<string, string>, ignore: string[], path: string = "") {
		// Contains an apps assets
		const assets: Record<string, Uint8Array> = {}
		// Processing queue
		const indexingTasks: Promise<Record<string, Uint8Array<ArrayBufferLike>>>[] = []
		// Read all the files in the current folder
		for await (const entry of Deno.readDir(`apps/${appName}${path}`)) {
			// If the ignore list contains the relative path of an entry, skip indexing
			if (ignore.includes(`${path}/${entry.name}`)) {
				log.debug(`Skipped indexing of ${appName}'s ${entry.name} (from "apps/${appName}${path}")`)
				continue
			}
			// If the entry is a link, espooky
			else if (entry.isSymlink) {
				log.debug(`Skipped indexing of ${appName}'s symlink ${entry.name} (from "apps/${appName}${path}")`)
				continue
			}
			// If the entry is a folder, queue it to index
			else if (entry.isDirectory) { indexingTasks.push(this.indexAssets(appName, custom, ignore, `${path}/${entry.name}`)) }
			// If the file is supposed to have a custom path, use it
			else if (custom[`${path}${entry.name}`]) { assets[`apps/${appName}/${custom[`${path}${entry.name}`]}`] = Deno.readFileSync(`apps/${appName}${path}/${entry.name}`) }
			// Otherwise save it as the relative path
			else { assets[`/apps/${appName}${path}/${entry.name}`] = Deno.readFileSync(`apps/${appName}${path}/${entry.name}`) }
		}
		// Wait for all subfolders to finish indexing
		const subfolders = await Promise.all(indexingTasks)
		// Add the assets from the subfolders
		Object.assign(assets, ...subfolders)

		// Return the assets object
		return assets
	}
	// Register the commands of an app
	private async indexCommands(appName: string, modules: string[] = []) {
		const commands: Record<string, unknown> = {}
		// For each file with server commands
		for (const path of modules) {
			// Import the module
			const module = await import(`../apps/${appName}${path}`)
			// For each export of the module, map it to an endpoint
			for (const entry of Object.keys(module)) {
				commands[`/api/${appName}/${entry}`] = module[entry]
			}
		}

		// Retun the app commands
		return commands
	}
	// Indexes an app, assets and commands included
	async index(appName: string) {
		// Read and normalize the manifest
		const manifest: WebdeskApplicationManifest = new WebdeskApplicationManifest(JSON.parse(await Deno.readTextFile(`apps/${appName}/manifest.json`)))
		// Save the application manifest
		applications.manifests[appName] = manifest
		// Index the app default assets
		const assets = await this.indexAssets(appName, manifest.routes, manifest.ignore)
		// Evil incefficiency that allows us some crazy work
		Object.assign(assets, {
			[`/apps/${appName}/icon`]: assets[`/apps/${appName}/${manifest.icon}`],
			[`/apps/${appName}/index`]: assets[`/apps/${appName}/${manifest.index}`],
		})
		// Index the app commands
		const commands = await this.indexCommands(appName, manifest.commands)
		// Return all the app stuff
		return [ assets, commands ]
	}
}
// 
export const resources = new class {
	// Contains the endpoints and the associated assets contents
	assets: AssetsLookupTable = {}
	// Contains the endpoints and the associated functions
	commands: CommandsLookupTable = {}
	// Batch log stuff
	private logRegistred(message: string, endpoints: string[]) {
		for (const endpoint of endpoints) {
			log.info(`${message} "${endpoint}"`)
		}
	}
	// Register a server asset
	private registerAssets(asset = {}) {
		this.logRegistred("Registred asset on ", Object.keys(asset))
		Object.assign(this.assets, asset)
	}
	// Register a server command
	private registerCommand(command = {}) {
		this.logRegistred("Registred command on ", Object.keys(command))
		Object.assign(this.commands, command)
	}

	constructor() {(async () => {
		// For every app in the app folder
		for await (const entry of Deno.readDir("apps/")) {
			// TODO: ensure the manifest is present before indexing
			if (!entry.isDirectory) { continue }
			// Register the app resources to the server
			applications.index(entry.name).then(([assets, commands]) => {
				this.registerAssets(assets)
				this.registerCommand(commands)
			})
		}

		// Register webdesk resources to the server
		const [webdeskAssets, webdeskCommands] = webdesk.index()
		this.registerAssets(webdeskAssets)
		this.registerCommand(webdeskCommands)
	})()}
}