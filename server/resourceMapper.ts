import { throwDeprecation } from "node:process";
import { log } from "./log.ts"

type AppAssetsTree = {
	[key: string]: string | AppAssetsTree | Uint8Array
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
	ready: Promise<void> = new Promise<void>((res) => { this.readyResolve = res })
	apps: AppAssetsTree = {
		assets: {},
		commands: {}
	}
	// Indexes all the wanted app assets in parallel
	private async indexAppAssets(appName: string, branch: AppAssetsTree, ignore: string[], path: string = "") {
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
			else if (entry.isDirectory) {
				branch[entry.name] = {}
				indexingTasks.push(this.indexAppAssets(appName, branch[entry.name] as AppAssetsTree, ignore, `${path}/${entry.name}`))
			}
			// If the entry is a file, add it to the app assets
			else if (entry.isFile) {
				branch[entry.name] = Deno.readFileSync(`apps/${appName}${path}/${entry.name}`)
				log.info(`Indexed ${entry.name} from apps/${appName}${path}`)
			}
		}
		await Promise.all(indexingTasks)
	}
	// Register an app commands
	private async indexAppCommands(appName: string, commands: string[] = []) {
		// sasa
		const branch: AppAssetsTree = (this.apps.commands as AppAssetsTree)[appName] = {}

		for (const command of commands) {
			const module = await import(`../apps/${appName}/${command}`)
			for (const entry of Object.keys(module)) { if (module[entry] instanceof Function) { branch[entry] = module[entry] } }
		}
	}
	// Indexes an app, resources and commands included
	private async indexApp(appName: string) {
		const manifest: WebdeskApplicationManifest = JSON.parse(await Deno.readTextFile(`apps/${appName}/manifest.json`))
		const fullIgnoreList: string[] = [...manifest.ignore, "/manifest.json"]
		const appBranch = (this.apps.assets as AppAssetsTree)[appName] = {}
		await this.indexAppCommands(appName, manifest.commands)
		await this.indexAppAssets(appName, appBranch, fullIgnoreList)
	}

	constructor() {(async () => {
		const appIndexingTasks: Promise<void>[] = []

		for await (const app of Deno.readDir("apps")) {
			if (app.isDirectory) { appIndexingTasks.push(this.indexApp(app.name)) }
		}

		Promise.all(appIndexingTasks)
			.then(resources.readyResolve as ((value: void[]) => void[]))
	})()}
}