import { contentType, getCharset } from "@std/media-types";
import { config } from "../server.settings.ts"

// Contains the endpoints of the server, and the answare associated
export const routes: Record<string, Uint8Array<ArrayBuffer> | string> = {}
const routesPaths: Record<string, string> = {}
const debouncer: string[] = []
// Contains the endpoints' headers
export const headers: Record<string, object> = {}
// Contains all the successfully installed apps and associated manifest
export const installedApps: Record<string, WebdeskApplication> = {}
export const ready: Promise<void> = init()

interface WebdeskApplication {
	routes: Record<string, string>
	ignore: string[]
	index: string
	desc: string
	icon: string
}

// TODO: Smart re-indexing of resources when updated

async function init() {
	// Function used to signal when all the routes and headers have been indexed (aka when the server is ready)
	const dependencies: Promise<void>[] = [
		addAppsToRoutes(),
		compileScripts(),
		compileIndex(),
	]
	await Promise.all(dependencies)

	compileCSS()
	resourceRefresher()
}

async function registerRoute(endpoint: string, resourcePath: string) {
	// Caches an endpoint associeted resource on said endpoint
	console.log(`Caching ${resourcePath} at ${endpoint}`)

	routes[endpoint] = await Deno.readFile(resourcePath)
	routesPaths[resourcePath] = endpoint
}

function registerHeaders(endpoint: string, mime: string, custom?: object) {
	// Registers the headers of an endpoint
	const mimeType = mime.toLocaleLowerCase().slice(mime.toLocaleLowerCase().lastIndexOf(".") + 1)
	headers[endpoint] = { status: 200, headers: {"content-type": `${contentType(mimeType)}; charset=${getCharset(mimeType)}`}, ...custom }
}

async function addAppsToRoutes() {
	// Used to index all the assets of each app
	const applicationNames: string[] = []
	for await (const entry of Deno.readDir("app")) {
		if (entry.isDirectory) applicationNames.push(entry.name.toLowerCase())
	}

	const processingQueue = applicationNames.map(async appName => {
		let textManifest: string

		try { textManifest = await Deno.readTextFile(`app/${appName}/manifest.json`) }
		catch(err) { console.error(`Failed to load app ${appName}'s manifest:`, err); return }

		const manifestJSON: WebdeskApplication = JSON.parse(textManifest)
		const ignoredFiles: string[] = manifestJSON.ignore
		ignoredFiles.push("manifest.json", manifestJSON.index, manifestJSON.icon, ...Object.keys(manifestJSON.routes))
		installedApps[appName] = manifestJSON

		await asyncFolderIndexer(appName, "/", ignoredFiles)

		for (const customRoute of Object.keys(manifestJSON.routes)) {
			registerRoute(`/apps/${appName}/${customRoute}`, `app/${appName}/${manifestJSON.routes[customRoute]}`)
			registerHeaders(`/apps/${appName}/${customRoute}`, manifestJSON.routes[customRoute])
		}

		registerRoute(`/apps/${appName}/`, `app/${appName}/${manifestJSON.index}`)
		registerHeaders(`/apps/${appName}/`, manifestJSON.index)

		registerRoute(`/apps/${appName}/icon`, `app/${appName}/${manifestJSON.icon}`)
		registerHeaders(`/apps/${appName}/icon`, manifestJSON.icon)
	})

	await Promise.all(processingQueue)
}

async function asyncFolderIndexer(appName: string, path: string, ignore: string[]) {
	// Used to add all needed files to an app endpoint
	for await (const entry of Deno.readDir(`app/${appName}${path}`)) {
		if (ignore.indexOf(`${path.slice(1) == "" ? "" : `${path.slice(1)}/`}${entry.name}`) > -1) continue
		else if (entry.isDirectory) await asyncFolderIndexer(appName, `${path}/${entry.name}`, ignore)
		else {
			registerRoute(`/apps/${appName}${path.slice(1)}/${entry.name}`, `app/${appName}${path.slice(1)}/${entry.name}`)
			registerHeaders(`/apps/${appName}${path.slice(1)}/${entry.name}`, entry.name)
		}
	}
}

async function compileIndex() {
	// Adds all the components in the index page
	// TODO: Discontinue it
	const componentNames: string[] = []
	const webdeskSplitIndex: string[] = (await Deno.readTextFile(config.indexFilePath)).split("<!--Assets-->")

	for await (const component of Deno.readDir(config.componentsPath)) {
		if (component.isFile) componentNames.push(component.name)
	}

	const processingQueue = componentNames.map(async componentName => {
		return await Deno.readTextFile(`${config.componentsPath}/${componentName}`)
	})

	routes["/"] = [webdeskSplitIndex[0], (await Promise.all(processingQueue)).join("\n"), webdeskSplitIndex[1]].join("\n")
	registerHeaders("/", "html")
}

function compileCSS() {
	// Not really compiling anything
	registerRoute("/style.css", config.cssFilePath)
	registerHeaders("/style.css", "css")
}

async function compileScripts() {
	// Bundles all the scripts into one
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

async function resourceRefresher() {
	// Used to dynamically re cache file contents after change
	// more of a debug feature than a production one
	for await (const event of Deno.watchFs(["app", "static"])) {
		const relativePath = event.paths[0].slice(Deno.cwd().length + 1)
		if (debouncer.indexOf(relativePath) > -1) continue

		if (relativePath === config.indexFilePath) {
			compileIndex()
			console.log(`Refreshed the index endpoint after file change`)
		} else if (relativePath === config.cssFilePath) {
			compileCSS()
			console.log(`Refreshed the css endpoint after file change`)
		} else if (relativePath.includes(config.frontendScriptsPath)) {
			compileScripts()
			console.log(`Refreshed the frontend js bundle endpoint after file change`)
		} else if (!routes[routesPaths[relativePath]]) {
			continue
		} else if (event.kind === "remove") {
			delete routes[routesPaths[relativePath]]
			delete headers[routesPaths[relativePath]]

			console.log(`Removed endpoint of deleted file ${relativePath}`)
		} else {
			registerRoute(routesPaths[relativePath], relativePath)
			console.log(`Refreshed ${relativePath} endpoint after file change`)
		}

		debouncer.push(relativePath)
		setTimeout(() => delete debouncer[debouncer.indexOf(relativePath)], 100)
	}
}