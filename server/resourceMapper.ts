import { log } from "./log.ts"
import { config } from "../server.config.ts"

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
	routes: Record<string, string> = {}
	description: string = ""
	commands: string[] = []
	ignore: string[] = []
	titlebar: TitlebarProprieties = {
		path: "",
		dynamic: false,
		buttons: {
			"minimize": "default",
			"maximise": "default",
		}
	}
	index: string = ""
	icon: string = ""
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

const webdesk = new class {
	css: string = "" // CSS
	html: string = "" // HTML
	manifest: string = "" // PWA Manifest
	script: string = "" // Frontend script
	sw: string = "" // Service Worker script

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
	// // Compiles all CSS files into one and adds indexes the result
	// async csser() {
	// 	// Read all the css files
	// 	const processingQueue = ["base.css", "customization.css", "intro.css", "animations.css"].map(async (cssFile) => {
	// 		return await Deno.readTextFile(`${config.cssStylesPath}/${cssFile}`)
	// 	})
	// 	// Compile all the css files into a single endpoint
	// 	webdesk.css = (await Promise.all(processingQueue)).join("\n")
	// }
	// TODO: Ugly sad miserable hack
	index() {
		// Contains webdesk's assets
		const assets: AssetsLookupTable = {
			"/": Deno.readTextFileSync("static/index.htm"),
			"/script": Deno.readTextFileSync(`static/script.js`),
			"/sw": Deno.readTextFileSync(`static/serviceWorker.js`),
			"/manifest": Deno.readTextFileSync(`static/manifest.json`),
			"/css": `${Deno.readTextFileSync(`static/base.css`)}\n${Deno.readTextFileSync(`static/customization.css`)}\n${Deno.readTextFileSync(`static/intro.css`)}\n${Deno.readTextFileSync(`static/animations.css`)}`,
		}
		// Contains webdesk's commands
		const commands: CommandsLookupTable = this.commander()
		// Return the assets and commands
		return [ assets, commands ]
	}
}

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
			// If the entry is a folder, queue it to index
			else if (entry.isDirectory) { indexingTasks.push(this.indexAssets(appName, custom, ignore, `${path}/${entry.name}`)) }
			// If the entry is a file, add it to the app assets
			else if (entry.isFile) {
				// If the file is supposed to have a custom path, use it
				if (custom[`${path}${entry.name}`]) {
					assets[`apps/${appName}/${custom[`${path}${entry.name}`]}`] = Deno.readFileSync(`apps/${appName}${path}/${entry.name}`)
					log.debug(`Indexed app ${appName}'s ${entry.name} (from "apps/${appName}${path}") on "apps/${appName}/${custom[`${path}${entry.name}`]}"`)
				}
				// Otherwise save it as the relative path
				else {
					assets[`/apps/${appName}${path}/${entry.name}`] = Deno.readFileSync(`apps/${appName}${path}/${entry.name}`)
					log.debug(`Indexed app ${appName}'s ${entry.name} (from "apps/${appName}${path}") on "/apps/${appName}${path}/${entry.name}"`)
				}
			}
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
				log.info(`Binded ${entry} to "/api/${appName}/${entry}" (from ${appName} module "/apps/${appName}/${path}")`)
			}
		}

		// Retun the app commands
		return commands
	}
	// Indexes an app, assets and commands included
	async index(appName: string) {
		// Read and normalize the manifest
		const manifest: WebdeskApplicationManifest = {...(new WebdeskApplicationManifest), ...JSON.parse(await Deno.readTextFile(`apps/${appName}/manifest.json`))}
		// Save the application manifest
		applications.manifests[appName] = manifest
		// Compile a list of files that will skip indexing
		const fullIgnoreList: string[] = [
			...manifest.ignore,
			...manifest.commands,
			manifest.index,
			manifest.icon,
			"/manifest.json"
		]
		// Index the app commands
		const commands = await this.indexCommands(appName, manifest.commands)
		// Index the app default assets
		const assets = await this.indexAssets(appName, manifest.routes, fullIgnoreList)
		// Return all the app stuff
		return [ assets, commands ]
	}
}

export const resources = new class {
	// Contains the endpoints and the associated assets contents
	assets: AssetsLookupTable = {}
	// Contains the endpoints and the associated functions
	commands: CommandsLookupTable = {}
	// Webdesk logic class
	webdesk = webdesk
	// Application indexer logic class
	apps = applications
	// Register a server asset
	private registerAssets(asset: AssetsLookupTable = {}) {
		Object.assign(this.assets, ...asset)
	}
	// Register a server command
	private registerCommand(command: object = {}) {
		Object.assign(this.commands, ...command)
	}

	constructor() {(async () => {
		const assets = webdesk.index()
	})()}
}