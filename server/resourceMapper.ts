import { config } from "../server.settings.ts"
import { contentType, getCharset } from "@std/media-types";

export const routes: Record<string, string> = {}
export const headers: Record<string, object> = {}
export const appProprieties: Record<string, WebdeskApplication> = {}
export const ready: Promise<void> =
(async () => {
	await addAppsToRoutes()
	await compileIndex()

	routes["/"] = config.compiledIndexPath
	headers["/"] = { status: 200, headers: {"content-type": "text/html; charset=utf-8;"} }

	routes["/style.css"] = config.cssFilePath
	headers["/style.css"] = { status: 200, headers: {"content-type": "text/css; charset=utf-8;"} }

	routes["/script.js"] = config.frontendScriptPath
	headers["/script.js"] = { status: 200, headers: {"content-type": "text/js; charset=utf-8;"} }
})()

async function addAppsToRoutes() {
	const applicationNames: string[] = []
	for await (const entry of Deno.readDir("app")) {
		if (entry.isDirectory) applicationNames.push(entry.name)
	}

	const processingQueue = applicationNames.map(async appName => {
		appName = appName.toLocaleLowerCase()
		let mimeType: string
		try {
			const textManifest = await Deno.readTextFile(`app/${appName}/manifest.json`)
			const manifestJSON: WebdeskApplication = JSON.parse(textManifest)
			appProprieties[appName] = manifestJSON

			routes[`/apps/${appName}/index`] = `app/${appName}/${manifestJSON.index}`

			mimeType = routes[`/apps/${appName}/index`].slice(routes[`/apps/${appName}/index`].lastIndexOf(".") + 1)
			headers[`/apps/${appName}/index`] = { status: 200, headers: {"content-type": `${contentType(mimeType)}; charset=${getCharset(mimeType)}`} }

			routes[`/apps/${appName}/icon`] = `app/${appName}/${manifestJSON.icon}`

			mimeType = routes[`/apps/${appName}/icon`].slice(routes[`/apps/${appName}/icon`].lastIndexOf(".") + 1)
			headers[`/apps/${appName}/icon`] = { status: 200, headers: {"content-type": `${contentType(mimeType)}`} }
		} catch (err) { console.error(`Failed to load app ${appName}:`, err) }
	})

	return await Promise.all(processingQueue)
}

async function compileIndex() {
	const componentNames: string[] = []
	const webdeskBaseIndex: string = config.comment + (await Deno.readTextFile("static/index.htm"))
	const webdeskSplitIndex: string[] = webdeskBaseIndex.split("<!--Assets-->")

	for await (const component of Deno.readDir("static/components")) {
		if (component.isFile) componentNames.push(component.name)
	}

	const processingQueue = componentNames.map(async componentName => {
		return await Deno.readTextFile(`static/components/${componentName}`)
	})

	const componentsHTMLArray = await Promise.all(processingQueue)
	await Deno.writeTextFile(config.compiledIndexPath, [webdeskSplitIndex[0], componentsHTMLArray.join("\n"), ...webdeskSplitIndex.slice(1)].join("\n"))
}

interface WebdeskApplication {
	icon: string
	index: string
	desc: string
}