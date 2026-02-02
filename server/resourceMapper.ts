import { log } from "./log.ts"
import { config } from "../server.config.ts"

type AssetsLookupTable = {
	[key: string]: Uint8Array<ArrayBuffer>
}

type CommandsLookupTable = {
	[key: string]: Function
}

type WebdeskApplicationManifest = {
	routes: Record<string, string>
	commands: string[]
	ignore: string[]
	index: string
	desc: string
	icon: string
}

type WebdeskFiles = {
	script: string,
	index: string,
	css: string,
}

export const resources = new class {
	// // Saves the resolve for the ready method
	// private readyResolve = function() { /* Dummy Function */ }
	// // Flags when all resources have been indexed
	// ready: Promise<void> = new Promise<void>((res) => { this.readyResolve = res })
	webdesk: WebdeskFiles = {
		// Webdesk index
		index: "",
		// Webdesk css
		css: "",
		// Webdesk script
		script: ""
	}
	// Contains the endpoints and the associated assets contents
	assets: AssetsLookupTable = {}
	// Contains the endpoints and the associated functions
	commands: CommandsLookupTable = {}
	// Contains the manifests of the installed apps
	manifests: Record<string, WebdeskApplicationManifest> = {}
	// Indexes all the wanted app assets in parallel
	private async indexAppAssets(appName: string, ignore: string[], path: string = "") {
		// Processing queue
		const indexingTasks: Promise<void>[] = []
		// Read all the files in the current folder
		for await (const entry of Deno.readDir(`apps/${appName}${path}`)) {
			// If the ignore list contains the relative path of an entry, skip indexing
			if (ignore.includes(`${path}/${entry.name}`)) {
				log.info(`Skipped indexing of ${entry.name} from apps/${appName}${path}`)
				continue
			}
			// If the entry is a folder, queue it to index
			else if (entry.isDirectory) { indexingTasks.push(this.indexAppAssets(appName, ignore, `${path}/${entry.name}`)) }
			// If the entry is a file, add it to the app assets
			else if (entry.isFile) {
				this.assets[`/apps/${appName}${path}/${entry.name}`] = Deno.readFileSync(`apps/${appName}${path}/${entry.name}`)
				log.info(`Indexed ${entry.name} from apps/${appName}${path}`)
			}
		}
		// Wait for all subfolders to finish indexing
		await Promise.all(indexingTasks)
	}
	// Override the default indexes with custom ones
	private indexCustomAssets(appName: string, custom: Record<string, string>) {
		// For every custom route
		for (const route of Object.keys(custom)) {
			// Save the new endpoint with the value of the default asset
			this.assets[`/apps/${appName}/${route}`] = this.assets[`/apps/${appName}/${custom[route]}`]
			// Remove the default asset
			delete this.assets[`/apps/${appName}/${custom[route]}`]
		}
	}
	// Register the commands of an app
	private async indexAppCommands(appName: string, commands: string[] = []) {
		// For every file containing server commands
		for (const command of commands) {
			// Import the module
			const module = await import(`../apps/${appName}/${command}`)
			// For each export of the module...
			for (const entry of Object.keys(module)) {
				// If it's a function, dedicate an endpoint for the function
				if (module[entry] instanceof Function) { this.commands[`/api/${appName}/${entry}`] = module[entry] }
			}
		}
	}
	// Indexes an app, assets and commands included
	private async indexApp(appName: string) {
		// Read the manifest
		const manifest: WebdeskApplicationManifest = JSON.parse(await Deno.readTextFile(`apps/${appName}/manifest.json`))
		// Save the manifest
		this.manifests[appName] = manifest
		// Compile a list of files that will skip indexing
		const fullIgnoreList: string[] = [...(manifest.ignore || []), ...(manifest.commands || []) , "/manifest.json"]
		// Index the app commands
		await this.indexAppCommands(appName, manifest.commands)
		// Index the app default assets
		await this.indexAppAssets(appName, fullIgnoreList)
		// Index the app custom assets
		this.indexCustomAssets(appName, manifest.routes)
	}
	// Adds all the template elements to the index page
	// TODO: Discontinue it(?)
	async indexWebdesk() {
		// Task parallelization array
		const fileReadTasks: Promise<string>[] = []
		// Split the base index html file into 2 parts
		const webdeskSplitIndex: string[] = (await Deno.readTextFile(config.indexFilePath)).split("<!--Assets-->")
		// Read all the files inside the components folder
		for await (const component of Deno.readDir(config.componentsPath)) {
			// If the entry is a file, add it to the file read queue
			if (component.isFile) { fileReadTasks.push(Deno.readTextFile(`${config.componentsPath}/${component.name}`)) }
		}
		// Save the index as text, joining the first base part, all the components and the second base part
		this.webdesk.index = [webdeskSplitIndex[0], (await Promise.all(fileReadTasks)).join("\n"), webdeskSplitIndex[1]].join("\n")
	}
	// Indexes the webdesk base command/s
	indexWebdeskCommands() {
		// Get command for an app or all app manifests
		this.commands["/api/_/manifest"] = (queries: string[]) => {
			// Return string
			let manifests: string = ""
			// For all apps the request contains
			for (const app of queries) {
				// If no app specified, send the full app list
				if (!app) { return JSON.stringify(resources.manifests) }
				// Return the app manifest or an empty object
				manifests += `,${JSON.stringify(resources.manifests[app] || { })}`
			}
			// Return the manifests
			return manifests.substring(1)
		}
	}
	// Compiles into a single file the css and adds it to the endpoint
	async indexCSS() {
		// Add all CSS Files to the processing Queue
		const cssNames: Set<string> = new Set(["base.css", "animations.css", "customization.css"])
		// Read all the css files
		const processingQueue = [...cssNames].map(async (cssFile) => {
			return await Deno.readTextFile(`${config.cssStylesPath}/${cssFile}`)
		})
		// Compile all the css files into a single endpoint
		this.webdesk.css = (await Promise.all(processingQueue)).join("\n")
	}
	// Adds the endpoint for the webdesk script
	async indexScripts() {
		// Read the script file
		this.webdesk.script = await Deno.readTextFile(`${config.frontendScriptsPath}/script.js`)
	}
	// Add all webdesk endpoints
	async initWebdesk() {
		const tasks: (Promise<void> | void)[] = []

		tasks.push(this.indexCSS())
		tasks.push(this.indexWebdesk())
		tasks.push(this.indexScripts())
		tasks.push(this.indexWebdeskCommands())

		await Promise.all(tasks)
	}

	constructor() {(async () => {
		// const initTasks: Promise<void>[] = []

		// initTasks.push(this.initWebdesk())
		this.initWebdesk()

		for await (const app of Deno.readDir("apps")) {
			// if (app.isDirectory) { initTasks.push(this.indexApp(app.name)) }
			if (app.isDirectory) { this.indexApp(app.name) }
		}

		// Promise.all(initTasks)
			// .then(resources.readyResolve)
	})()}
}