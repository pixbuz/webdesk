import { config } from "../server.settings.ts"
import { contentType, getCharset } from "@std/media-types";

export const routes: Record<string, Uint8Array<ArrayBuffer> | string> = {}
export const headers: Record<string, object> = {}
export const appProprieties: Record<string, WebdeskApplication> = {}
export const ready: Promise<void> = init()

async function addAppsToRoutes() {
	// TO ADD: Route all files in folder with proper paths
	//		Add "do not index" list
	const applicationNames: string[] = []
	for await (const entry of Deno.readDir("app")) {
		if (entry.isDirectory) applicationNames.push(entry.name.toLowerCase())
	}

	const processingQueue = applicationNames.map(async appName => {
		try {
			const textManifest = await Deno.readTextFile(`app/${appName}/manifest.json`)
			const manifestJSON: WebdeskApplication = JSON.parse(textManifest)
			appProprieties[appName] = manifestJSON

			registerRoute(`/apps/${appName}/`, `app/${appName}/${manifestJSON.index}`)
			registerHeaders(`/apps/${appName}/`, manifestJSON.index)

			registerRoute(`/apps/${appName}/icon`, `app/${appName}/${manifestJSON.icon}`)
			registerHeaders(`/apps/${appName}/icon`, manifestJSON.icon)

			for (const customRoute of Object.keys(manifestJSON.routes)) {
				registerRoute(customRoute, manifestJSON.routes[customRoute])
				registerHeaders(customRoute, manifestJSON.routes[customRoute])
			}
		} catch (err) { console.error(`Failed to load app ${appName}:`, err) }
	})

	await Promise.all(processingQueue)
}

async function registerRoute(endpoint: string, resourcePath: string) {
	routes[endpoint] = await Deno.readFile(resourcePath)
}

function registerHeaders(endpoint: string, mime: string, custom?: object) {
	const mimeType = mime.toLocaleLowerCase().slice(mime.toLocaleLowerCase().lastIndexOf(".") + 1)
	headers[endpoint] = { status: 200, headers: {"content-type": `${contentType(mimeType)}; charset=${getCharset(mimeType)}`}, ...custom }
}

async function compileIndex() {
	const componentNames: string[] = []
	const webdeskSplitIndex: string[] = (await Deno.readTextFile("static/index.htm")).split("<!--Assets-->")

	for await (const component of Deno.readDir(config.componentsPath)) {
		if (component.isFile) componentNames.push(component.name)
	}

	const processingQueue = componentNames.map(async componentName => {
		return await Deno.readTextFile(`${config.componentsPath}/${componentName}`)
	})

	routes["/"] = [webdeskSplitIndex[0], (await Promise.all(processingQueue)).join("\n"), webdeskSplitIndex[1]].join("\n")
	registerHeaders("/", "html")
}

async function compileScripts() {
	const scriptNames: string[] = []
	for await (const script of Deno.readDir(config.frontendScriptsPath)) {
		if (script.isFile) scriptNames.push(script.name)
	}

	const processingQueue = scriptNames.map(async scriptName => {
		return `//./ ${scriptName}\n` + (await Deno.readTextFile(`${config.frontendScriptsPath}/${scriptName}`))
	})

	routes["/script.js"] = (await Promise.all(processingQueue)).join("\n")
	registerHeaders("/script.js", "js")
}

async function init() {
	const dependencies: Promise<void>[] = [
		addAppsToRoutes(),
		compileScripts(),
		compileIndex(),
	]

	await Promise.all(dependencies)

	// routes["/"] = config.compiledIndexPath
	// headers["/"] = { status: 200, headers: {"content-type": "text/html; charset=utf-8;"} }

	registerRoute("/style.css", config.cssFilePath)
	registerHeaders("/style.css", "css")

	// routes["/script.js"] = config.compiledScriptPath
	// headers["/script.js"] = { status: 200, headers: {"content-type": "text/js; charset=utf-8;"} }
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