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

export const resources = new class {
	private readyResolve: Function = function() { /* Dummy function */ }
	// Flags when all resources have been indexed
	ready: Promise<void> = new Promise<void>((res) => { this.readyResolve = res })
	webdesk: { index: string; css: string } = {
		// Webdesk index
		index: "",
		// Webdesk css
		css: ""
	}
	// Contains the endpoints and the associated assets contents
	assets: AssetsLookupTable = {}
	// Contains the endpoints and the associated functions
	commands: CommandsLookupTable = {}
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
			// Import the module and save it
			const module = await import(`../apps/${appName}/${command}`)
			// For each exported entry of the module
			for (const entry of Object.keys(module)) {
				// If it's a function, map it to an api endpoint
				if (module[entry] instanceof Function) { this.commands[`/api/${appName}/${entry}`] = module[entry] }
			}
		}
	}
	// Indexes an app, assets and commands included
	private async indexApp(appName: string) {
		// Read the manifest
		const manifest: WebdeskApplicationManifest = JSON.parse(await Deno.readTextFile(`apps/${appName}/manifest.json`))
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
	async compileIndex() {
		// Task parallelization array
		const fileReadTasks: Promise<string>[] = []
		// Split the base index html file into 2 parts
		const webdeskSplitIndex: string[] = (await Deno.readTextFile(config.indexFilePath)).split("<!--Assets-->")
		// Read all the files inside the components folder
		for await (const component of Deno.readDir(config.componentsPath)) {
			// If the entry is a file, add it to the file read queue
			if (component.isFile) {
				fileReadTasks.push(Deno.readTextFile(`${config.componentsPath}/${component.name}`))
			}
		}
		// Set the / to the index, as a text file, joining the first base part, all the components and the second base part
		this.webdesk.index = [webdeskSplitIndex[0], (await Promise.all(fileReadTasks)).join("\n"), webdeskSplitIndex[1]].join("\n")
	}
	// 
	async compileCSS() {
		// Add all CSS Files to the processing Queue
		const cssNames: Set<string> = new Set(["base.css", "animations.css", "customization.css"])

		const processingQueue = [...cssNames].map((cssFile) => {
			return Deno.readTextFileSync(`${config.cssStylesPath}/${cssFile}`)
		})

		this.webdesk.css = processingQueue.join("\n")
	}
	//
	async indexWebdesk() {
		await this.compileCSS()
		await this.compileIndex()
	}

	constructor() {(async () => {
		const initTasks: Promise<void>[] = []

		for await (const app of Deno.readDir("apps")) {
			if (app.isDirectory) { initTasks.push(this.indexApp(app.name)) }
		}

		initTasks.push(this.indexWebdesk())

		Promise.all(initTasks)
			.then(resources.readyResolve as ((value: void[]) => void[]))
		
	})()}
}