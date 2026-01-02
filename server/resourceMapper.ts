import { config } from "../server.settings.ts"
import { contentType, getCharset } from "@std/media-types";

export const routes: Record<string, string> = {}
export const headers: Record<string, object> = {}
export const appProprieties: Record<string, WebdeskApplication> = {}
export const ready: Promise<void> = init()

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

			routes[`/apps/${appName}/`] = `app/${appName}/${manifestJSON.index.toLocaleLowerCase()}`
			mimeType = manifestJSON.index.toLocaleLowerCase().slice(manifestJSON.index.toLocaleLowerCase().lastIndexOf(".") + 1)
			headers[`/apps/${appName}/`] = { status: 200, headers: {"content-type": `${contentType(mimeType)}; charset=${getCharset(mimeType)}`} }

			routes[`/apps/${appName}/icon`] = `app/${appName}/${manifestJSON.icon.toLocaleLowerCase()}`
			mimeType = manifestJSON.icon.toLocaleLowerCase().slice(manifestJSON.icon.toLocaleLowerCase().lastIndexOf(".") + 1)
			headers[`/apps/${appName}/icon`] = { status: 200, headers: {"content-type": `${contentType(mimeType)}`} }

			for (const route of Object.keys(manifestJSON.routes)) {
				routes[`/apps/${appName}/${route.toLocaleLowerCase()}`] = `app/${appName}/${manifestJSON.routes[route].toLocaleLowerCase()}`
				mimeType = manifestJSON.routes[route].toLocaleLowerCase().slice(manifestJSON.routes[route].toLocaleLowerCase().lastIndexOf(".") + 1)
				headers[`/apps/${appName}/${route.toLocaleLowerCase()}`] = { status: 200, headers: {"content-type": `${contentType(mimeType)}`} }
			}
		} catch (err) { console.error(`Failed to load app ${appName}:`, err) }
	})

	await Promise.all(processingQueue)
}

async function compileIndex() {
	const componentNames: string[] = []
	const webdeskBaseIndex: string = config.comment + (await Deno.readTextFile("static/index.htm"))
	const webdeskSplitIndex: string[] = webdeskBaseIndex.split("<!--Assets-->")

	for await (const component of Deno.readDir(config.componentsPath)) {
		if (component.isFile) componentNames.push(component.name)
	}

	const processingQueue = componentNames.map(async componentName => {
		return await Deno.readTextFile(`${config.componentsPath}/${componentName}`)
	})

	const compiledHTMLComponents = (await Promise.all(processingQueue)).join("\n")
	await Deno.writeTextFile(config.compiledIndexPath, [webdeskSplitIndex[0], compiledHTMLComponents, ...webdeskSplitIndex.slice(1)].join("\n"))
}

async function compileScripts() {
	const scriptNames: string[] = []
	for await (const script of Deno.readDir(config.frontendScriptsPath)) {
		if (script.isFile) scriptNames.push(script.name)
	}

	const processingQueue = scriptNames.map(async scriptName => {
		return `//./ ${scriptName}\n` + (await Deno.readTextFile(`${config.frontendScriptsPath}/${scriptName}`))
	})

	const compiledScripts = (await Promise.all(processingQueue)).join("\n")
	await Deno.writeTextFile(config.compiledScriptPath, compiledScripts)
}

async function init() {
	const dependencies: Promise<void>[] = [
		addAppsToRoutes(),
		compileScripts(),
		compileIndex(),
	]

	await Promise.all(dependencies)

	routes["/"] = config.compiledIndexPath
	headers["/"] = { status: 200, headers: {"content-type": "text/html; charset=utf-8;"} }

	routes["/style.css"] = config.cssFilePath
	headers["/style.css"] = { status: 200, headers: {"content-type": "text/css; charset=utf-8;"} }

	routes["/script.js"] = config.compiledScriptPath
	headers["/script.js"] = { status: 200, headers: {"content-type": "text/js; charset=utf-8;"} }
}

if (config.serverDebugMode) {
	(async () => {
		for await (const _event of Deno.watchFs("static")) {
			init()
		}
	})()
}

interface WebdeskApplication {
	icon: string
	index: string
	desc: string
	routes: Record<string, string>
}