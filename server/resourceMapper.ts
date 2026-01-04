import { config } from "../server.settings.ts"
import { contentType, getCharset } from "@std/media-types";

// Contains the endpoints of the server, and the answare associated
export const routes: Record<string, Uint8Array<ArrayBuffer> | string> = {}
// Contains the endpoints' headers
export const headers: Record<string, object> = {}
// Contains all the successfully installed apps and associated manifest
export const installedApps: Record<string, WebdeskApplication> = {}
export const ready: Promise<void> = init()

interface WebdeskApplication {
	icon: string
	index: string
	desc: string
	routes: Record<string, string>
}

async function init() {
	const dependencies: Promise<void>[] = [
		addAppsToRoutes(),
		compileScripts(),
		compileIndex(),
	]

	await Promise.all(dependencies)

	registerRoute("/style.css", config.cssFilePath)
	registerHeaders("/style.css", "css")
}

async function registerRoute(endpoint: string, resourcePath: string) {
	// Caches an endpoint associeted resource on said endpoint
	routes[endpoint] = await Deno.readFile(resourcePath)
}

function registerHeaders(endpoint: string, mime: string, custom?: object) {
	// Registers the headers of an endpoint
	const mimeType = mime.toLocaleLowerCase().slice(mime.toLocaleLowerCase().lastIndexOf(".") + 1)
	headers[endpoint] = { status: 200, headers: {"content-type": `${contentType(mimeType)}; charset=${getCharset(mimeType)}`}, ...custom }
}

async function addAppsToRoutes() {
	// Used to index all the assets of each app
	// TODO: Route all files in folder with proper paths
	//	 Add "do not index" list
	const applicationNames: string[] = []
	for await (const entry of Deno.readDir("app")) {
		if (entry.isDirectory) applicationNames.push(entry.name.toLowerCase())
	}

	const processingQueue = applicationNames.map(async appName => {
		try {
			const textManifest = await Deno.readTextFile(`app/${appName}/manifest.json`)
			const manifestJSON: WebdeskApplication = JSON.parse(textManifest)

			registerRoute(`/apps/${appName}/`, `app/${appName}/${manifestJSON.index}`)
			registerHeaders(`/apps/${appName}/`, manifestJSON.index)

			registerRoute(`/apps/${appName}/icon`, `app/${appName}/${manifestJSON.icon}`)
			registerHeaders(`/apps/${appName}/icon`, manifestJSON.icon)

			for (const customRoute of Object.keys(manifestJSON.routes)) {
				registerRoute(customRoute, manifestJSON.routes[customRoute])
				registerHeaders(customRoute, manifestJSON.routes[customRoute])
			}

			installedApps[appName] = manifestJSON
		} catch (err) { console.error(`Failed to load app ${appName}:`, err) }
	})

	await Promise.all(processingQueue)
}

async function compileIndex() {
	// Adds all the components in the index page
	// TODO: Discontinue it
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
	// Bundles all the scripts in one
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