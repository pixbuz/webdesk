import { WebdeskApplication } from "./application.ts"

export async function registerApplication(appName: string): Promise<WebdeskApplication> {
	const returnOBJ: WebdeskApplication = { installed: false, name: appName, assets: `${Deno.cwd()}/app/${appName}` }
	const appManifestText: string = await Deno.readTextFile(`app/${appName}/manifest.json`)
	const appManifest: object = 

	console.log(returnOBJ)
	return returnOBJ
}