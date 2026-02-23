import { log } from "./log.ts"
import { config } from "../server.config.ts"

type AssetsLookupTable = {
	[key: string]: Uint8Array<ArrayBuffer>
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

type WebdeskIndexers = {
	index: VoidFunction,
	commands: VoidFunction,
	serviceWorker: VoidFunction,
	manifest: VoidFunction,
	css: VoidFunction,
	scripts: VoidFunction
}

const webdesk = new class {
	css: string = "" // CSS
	index: string = "" // HTML
	manifest: string = "" // PWA Manifest
	script: string = "" // Frontend script
	sw: string = "" // Service Worker script
	// Returns the intro page
	intro(_queries: string[]) {
		return [ Deno.readFileSync("static/intropage.htm"), "text/html; charset=UTF-8" ]
	}
	// Command for fetching the default app titlebar
	titlebar(queries: string[]) {
		// Return html string
		let titlebar: string = ""
		for (const app of queries) {
			// If the app has a titlebar specified, read the html and return it
			// If no app specified, return the default titlebar
			if (app && this.manifests[app].titlebar) {
				titlebar = Deno.readTextFileSync(`apps/${app}/${this.manifests[app].titlebar}`)
			} else {
				titlebar = Deno.readTextFileSync(`static/titlebar.htm`)
				break
			}
		}
		// Return the titlebar
		return [ titlebar, "text/html; charset=UTF-8" ]
	}
	// Get command for an app or all app manifests
	manifests(queries: string[]) {
		// Return string
		let manifests: string = ""
		// For all apps the request contains
		for (const app of queries) {
			// If no app specified, send the full app list
			if (!app) {
				manifests = `,${JSON.stringify(this.manifests)}`
				break
			}
			// Return the app manifest or an empty object
			manifests += `,${JSON.stringify(this.manifests[app] || { })}`
		}
		// Return the manifests
		return [ manifests.substring(1), "application/json" ]
	}
	indexers: WebdeskIndexers = {
		// Indexes webdesk's index page
		async index() { webdesk.index = (await Deno.readTextFile("static/index.htm")) },
		// Indexes webdesk's frontend script
		async scripts() { webdesk.script = await Deno.readTextFile(`static/script.js`) },
		// Indexes webdesk's service worker
		async serviceWorker() { webdesk.sw = await Deno.readTextFile(`static/serviceWorker.js`) },
		// Indexes webdesk's manifest
		async manifest() { webdesk.manifest = await Deno.readTextFile(`static/manifest.json`) },
		// Indexes webdesk's API commands
		commands() {
			this.commands["/api/_/manifest"] = webdesk.manifests
			this.commands["/api/_/titlebar"] = webdesk.titlebar
			this.commands["/api/_/intro"] = webdesk.intro
		},
		// Compiles all CSS files into one and adds indexes the result
		async css() {
			// Read all the css files
			const processingQueue = ["base.css", "customization.css", "intro.css", "animations.css"].map(async (cssFile) => {
				return await Deno.readTextFile(`${config.cssStylesPath}/${cssFile}`)
			})
			// Compile all the css files into a single endpoint
			webdesk.css = (await Promise.all(processingQueue)).join("\n")
		},
	}
}

const applications = new class {
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
				if (custom[`apps/${appName}${path}/${entry.name}`]) { assets[custom[`apps/${appName}${path}/${entry.name}`]] = Deno.readFileSync(`apps/${appName}${path}/${entry.name}`) }
				// Otherwise save it as the relative path
				else { assets[`/apps/${appName}${path}/${entry.name}`] = Deno.readFileSync(`apps/${appName}${path}/${entry.name}`) }

				log.debug(`Indexed app ${appName}'s ${entry.name} (from "apps/${appName}${path}")`)
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
				log.info(`Binded ${entry} to "/api/${appName}/${entry}" (from ${appName} module "/apps/${appName}/${command}")`)
			}
		}

		// Retun the app commands
		return commands
	}
	// Indexes an app, assets and commands included
	async index(appName: string) {
		// Read and normalize the manifest
		const manifest: WebdeskApplicationManifest = {...(new WebdeskApplicationManifest), ...JSON.parse(await Deno.readTextFile(`apps/${appName}/manifest.json`))}
		// Compile a list of files that will skip indexing
		const fullIgnoreList: string[] = [...manifest.ignore, ...manifest.commands, "/manifest.json", ]
		// Index the app commands
		const commands = await this.indexCommands(appName, manifest.commands)
		// Index the app default assets
		const assets = await this.indexAssets(appName, manifest.routes, fullIgnoreList)
		// Return all the app stuff
		return [ manifest, assets, commands ]
	}
}

export const resources = new class {
	// Contains the endpoints and the associated assets contents
	assets: AssetsLookupTable = {}
	// Contains the endpoints and the associated functions
	commands: CommandsLookupTable = {}
	// Contains the manifests of the installed apps
	manifests: Record<string, WebdeskApplicationManifest> = {}
	webdesk = webdesk
	apps = applications

	constructor() {
		// Index Webdesk's main files
		for (const method of Object.values(webdesk.indexers)) { method.bind(this)() }

		;(async () => {
			for await (const app of Deno.readDir(`apps`)) {
				if (app.isDirectory) { this.apps.index(app.name) }
			}
		})()
	}
}