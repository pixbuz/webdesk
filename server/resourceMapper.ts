import { contentType, getCharset } from "@std/media-types";
import { config } from "../server.settings.ts"

interface WebdeskApplication {
	commands: Record<string, string>
	routes: Record<string, string>
	commandsFile: string
	ignore: string[]
	index: string
	desc: string
	icon: string
}

export type SocketCommandTree = {
	[name: string]: SocketCommandTree | Function
}

// Used to dynamically update the endpoints
const routesPaths: Record<string, string> = {}
// Used to filter multiple file events when updating a file
const debouncer: string[] = []
// Contains the endpoints' headers
export const headers: Record<string, object> = {}
// Contains all the successfully installed apps and associated manifest
export const appsManifests: Record<string, WebdeskApplication> = {}
// Contains the endpoints of the server, and the answare associated
export const routes: Record<string, Uint8Array<ArrayBuffer> | string> = {}
// Contains all the commands that can be sent from a endpoint
export const socketCommands: SocketCommandTree = {}

// Used by importing files to know when everything has been indexed
export const ready: Promise<void> = init()

export function registerSocketCommand(command: string[], func: Function) {
	let current = socketCommands
	if (!current) { current = {} }

	for (let i = 0; i < command.length; i++) {
		const part = command[i]

		if (i === command.length - 1) { current[part] = func }
		else { if (!current[part]) { current[part] = {} } }

		current = current[part] as SocketCommandTree
	}
}

async function init() {
	// Function used to signal when all the routes and headers have been indexed (aka when the server is ready)
	const dependencies: (Promise<void> | void)[] = [
		addAppsToRoutes(),
		compileScripts(),
		compileIndex(),
		compileCSS(),
	]

	await Promise.all(dependencies)

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

	// For every App Folder...
	const processingQueue = applicationNames.map(async appName => {
		let textManifest: string

		// Try to read the manifest
		try { textManifest = await Deno.readTextFile(`app/${appName}/manifest.json`) }
		catch(err) { console.error(`Failed to load app ${appName}'s manifest:`, err); return }

		// Translate the text manifest to an object
		const manifestJSON: WebdeskApplication = JSON.parse(textManifest)
		// Add to the App Manifest to the Record for bookkeeping
		appsManifests[appName] = manifestJSON

		// If the manifest contains a custom commands file:
		if (manifestJSON.commandsFile) {
			// Get the Custom Commands File from the app manifest
			const customCommandsFileModule = await import(`../app/${appName}/${manifestJSON.commandsFile}`)
			// Register the correct Function with the appropriate Command
			for (const commandString of Object.keys(manifestJSON.commands)) {
				const command = [appName, ...commandString.split(" ")]
				registerSocketCommand(command, customCommandsFileModule[manifestJSON.commands[commandString]])
			}
		}

		// Get the list of files not to index
		const ignoredFiles: string[] = manifestJSON.ignore ? manifestJSON.ignore : []
		// Remove from indexing the index, icon, custom commands file and all the files with custom routes
		ignoredFiles.push("manifest.json", manifestJSON.commandsFile, manifestJSON.index, manifestJSON.icon, ...Object.keys(manifestJSON.routes))
		// Index every file inside the App Folder, minding the ignored ones
		asyncFolderIndexer(appName, "/", ignoredFiles)

		// Register every custom route
		for (const customRoute of Object.keys(manifestJSON.routes)) {
			registerRoute(`/apps/${appName}/${customRoute}`, `app/${appName}/${manifestJSON.routes[customRoute]}`)
			registerHeaders(`/apps/${appName}/${customRoute}`, manifestJSON.routes[customRoute])
		}

		// Register the index and the icon
		registerRoute(`/apps/${appName}/`, `app/${appName}/${manifestJSON.index}`)
		registerHeaders(`/apps/${appName}/`, manifestJSON.index)

		registerRoute(`/apps/${appName}/icon`, `app/${appName}/${manifestJSON.icon}`)
		registerHeaders(`/apps/${appName}/icon`, manifestJSON.icon)
	})

	await Promise.all(processingQueue)
}

async function asyncFolderIndexer(appName: string, path: string, ignore: string[]) {
	// Recursive Function Used to index all the "wanted" app files

	// Read all the files in the current folder
	for await (const entry of Deno.readDir(`app/${appName}${path}`)) {
		// If the ignore list contains the relative path of an entry, skip indexing
		if (ignore.indexOf(`${path.slice(1) == "" ? "" : `${path.slice(1)}/`}${entry.name}`) > -1) continue
		// If the entry is another folder, wait for it to index itself and its sub folders
		else if (entry.isDirectory) await asyncFolderIndexer(appName, `${path}/${entry.name}`, ignore)
		// If the entry is a file, index its full path at the app's endpoint
		else if (entry.isFile) {
			registerRoute(`/apps/${appName}${path.slice(1)}/${entry.name}`, `app/${appName}${path.slice(1)}/${entry.name}`)
			registerHeaders(`/apps/${appName}${path.slice(1)}/${entry.name}`, entry.name)
		}
	}
}

async function compileIndex() {
	// Adds all the components in the index page
	// TODO: Discontinue it(?)
	const componentNames: string[] = []
	// Split the base index html file into 2 parts
	const webdeskSplitIndex: string[] = (await Deno.readTextFile(config.indexFilePath)).split("<!--Assets-->")

	// Read all the files inside the components folder
	for await (const component of Deno.readDir(config.componentsPath)) {
		if (component.isFile) componentNames.push(component.name)
	}

	// For each component that is a file, read the file contents
	const processingQueue = componentNames.map(async (componentName) => {
		return await Deno.readTextFile(`${config.componentsPath}/${componentName}`)
	})

	// Set the / to the index, as a text file, joining the first base part, all the components and the second base part
	routes["/"] = [webdeskSplitIndex[0], (await Promise.all(processingQueue)).join("\n"), webdeskSplitIndex[1]].join("\n")
	registerHeaders("/", "html")
}

async function compileScripts() {
	// Bundles all the JS frontend scripts into one
	const scriptNames: Set<string> = new Set(["util.js"])

	// Read all the files inside the front end scripts folder
	for await (const script of Deno.readDir(config.frontendScriptsPath)) {
		if (script.name === "animations.js") { continue }
		else if (script.isFile) { scriptNames.add(script.name) }
	}

	scriptNames.add("animations.js")

	// For all the scripts that are files, read the file contents and add a comment for debug
	const processingQueue = [...scriptNames].map((scriptName) => {
		return `\n\n//./ ${scriptName}\n\n${ Deno.readTextFileSync(`${config.frontendScriptsPath}/${scriptName}`) }`
	})

	// Set the /script.js endpoint to all the joined scripts as text
	routes["/script.js"] = processingQueue.join("\n")
	registerHeaders("/script.js", "js")
}

async function compileCSS() {
	// Not really compiling anything maybe in the future
	const cssNames: Set<string> = new Set(["animations.css", "customization.css"])

	// Add all CSS Files to the processing Queue
	for await (const css of Deno.readDir(config.cssStylesPath)) {
		if (css.isFile) cssNames.add(css.name)
	}

	const processingQueue = [...cssNames].map((cssName) => {
		return Deno.readTextFileSync(`${config.cssStylesPath}/${cssName}`)
	})

	routes["/style.css"] = processingQueue.toReversed().join("\n")
	registerHeaders("/style.css", "css")
}

async function resourceRefresher() {
	// Used to dynamically update an endpoint after it's file contents changed

	// Listen for file changes inside the "app" or "static" folders
	for await (const event of Deno.watchFs(["app", "static"])) {
		// Used to not refresh an endpoint too many times in the same moment, corrupting it
		if (debouncer.indexOf(event.paths[0]) > -1) { continue }
		// else {
		// 	// Add the file change path to the debouncer
		// 	debouncer.push(event.paths[0])
		// 	// Add a timeout to remove it from the debouncer
		// 	setTimeout(() => delete debouncer[debouncer.indexOf(relativePath)], 100)
		// }

		// Extracting the relative path
		const relativePath = event.paths[0].slice(Deno.cwd().length + 1)

		if (relativePath === config.indexFilePath) { // If the index was updated send a message
			compileIndex()
			console.log(`Refreshed the index endpoint after file change`)
		} else if (relativePath.includes(config.cssStylesPath)) { // If the css was updated send a message
			compileCSS()
			console.log(`Refreshed the css endpoint after file change`)
		} else if (relativePath.includes(config.frontendScriptsPath)) { // If one of the scripts was updated send a message
			compileScripts()
			console.log(`Refreshed the frontend js bundle endpoint after file change`)
		} else if (!routes[routesPaths[relativePath]]) { // If the file was indexed skip the event
			continue
		} else if (event.kind === "remove") { // If the file was deleted remove it from the routes
			delete routes[routesPaths[relativePath]]
			delete headers[routesPaths[relativePath]]

			console.log(`Removed endpoint of deleted file ${relativePath}`)
		} else { // Otherwise just refresh the endpoint
			registerRoute(routesPaths[relativePath], relativePath)
			console.log(`Refreshed ${relativePath} endpoint after file change`)
		}
	}
}