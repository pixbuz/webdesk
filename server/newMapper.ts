import { log } from "./log.ts"

export class WebdeskManifest {
	routes: Record<string, string> = {}
	description: string = "No description"
	modules: string[] = []
	titlebar: string = ""
	ignore: string[] = []
	dni: boolean = false
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

export class Route {
	static readonly registred: Record<string, any> = {}

	static async create(appName: string) {
		try {
			const manifestContents: string = await Deno.readTextFile(`./apps/${appName}/manifest.json`)
			const manifestObject: WebdeskManifest = new WebdeskManifest(JSON.parse(manifestContents))
		} catch(error) {
			log.debug(`Atempted to make a route for ${appName}, but ${(error as Error).message}`)
		}
	}

	valid = false

	getManifest(appName: string) {
		
	}

	private constructor(appName: string) {
		log.info(`Making a subdomain route for ${appName}`)
	}
}