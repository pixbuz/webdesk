import { log } from "./log.ts"
import { config } from "../server.config.ts"
import { resources } from "./resourceMapper.ts"
import { contentType, allExtensions, getCharset } from "@std/media-types"

class ErrorResponse extends Response {
	constructor(message: string | undefined, code: number = 400) {
		super(message, { status: code, headers: { "content-type": "text/plain" } })
	}
}

config.ssl ? log.info("Setting up SSL") : log.warn("Running the server unsecured")
const options = config.ssl ? {
	cert: config.cert,
	key: config.key,
	port: config.port,
	hostname: config.hostname,
	handler: requestHandler,
} : {
	port: config.port,
	hostname: config.hostname,
	handler: requestHandler,
}

const _server = Deno.serve({
	...options,
	onListen({hostname, port}) { log.info(`Server listening on ${config.ssl ? "https://" : "http://"}${hostname}:${port}`) }
})

// Responds to the incoming browser requests for webdesk
function requestHandler(browserRequest: Request, _connInfo: Deno.ServeHandlerInfo<Deno.NetAddr>): Response {
	const requestURL: URL = new URL(browserRequest.url)
	const requestTree: string[] = requestURL.pathname.substring(1).split("/")

	log.info(`Recived request for ${requestURL.pathname} (tree: "${requestTree.join(", ")}")`)

	switch(requestTree[0]) {
		case "apps": return appsAssetsReplier(requestURL)
		case "api": return apiReplier(requestURL)
		default: return webdeskReplier(requestURL)
	}
}
// Returns main webdesk html files
function webdeskReplier(request: URL) {
	switch(request.pathname) {
		// Return the main
		case "/": return new Response(resources.webdesk.index, { status: 200, headers: { "content-type": "text/html, charset=UTF-8" } })
		// Return the style
		case "/style": return new Response(resources.webdesk.css, { status: 200, headers: { "content-type": "text/css, charset=UTF-8" } })
		// Return the script
		case "/script": return new Response(resources.webdesk.script, { status: 200, headers: { "content-type": "text/javascript, charset=UTF-8" } })
		// Return the service worker
		case "/sw": return new Response(resources.webdesk.sw, { status: 200, headers: { "content-type": "text/javascript, charset=UTF-8" } })
		// Return the web app manifest
		case "/manifest": return new Response(resources.webdesk.manifest, { status: 200, headers: { "content-type": "application/json, charset=UTF-8" } })
		// Return an error if the requested file doesn't exist
		default: return new ErrorResponse(`Recived request: ${request}\n${" ".repeat(17)}^ isn't a valid webdesk file`)
	}
}
// Returns the contents of an app's asset
function appsAssetsReplier(request: URL): Response {
	// If the asset exists
	if (resources.assets[request.pathname]) {
		// Extract the mime from the asset path
		const mime = contentType(request.pathname.split(".").at(-1)!)
		log.info(`Replying with asset of type ${mime}`)
		// Return the asset
		return new Response(resources.assets[request.pathname], { status: 200, headers: { "content-type": `${mime}, charset=UTF-8` } })
	} else {
		log.info(`Request is for a non existing asset`)
		// Send an user error response
		return new ErrorResponse(`Recived asset request: ${request.pathname}\n${" ".repeat(23)}^isn't a valid asset`)
	}
}
// Runs and returns a server function
function apiReplier(request: URL): Response {
	// If the command requested doesn't exist
	if (resources.commands[request.pathname]) {
		// Sandbox the function, in case return the error
		try {
			// Run the function and save the result and mime
			const result: [computed: unknown, type: string] = resources.commands[request.pathname](request.search.substring(1).split("&"))
			log.info(`Replying with asset of type ${result[1]}`)
			// Return the result with the right mime
			return new Response(result[0] as BodyInit, { status: 200, headers: { "content-type": result[1] } })
		}
		catch(error) {
			const errorStack = (error as Error).stack!.split("\n")
			log.warn(`Command function for "${request.pathname}" failed: ${errorStack[0]}`)
			errorStack.slice(1).forEach((line) => { log.warn(line) })
			// Send an server error response
			return new ErrorResponse((error as Error).stack, 500)
		}
	} else {
		log.info(`Request is for a non existing command`)
		// Send an user error response
		return new ErrorResponse(`Recived api request: ${request.pathname}\n${" ".repeat(23)}^isn't a valid command`)
	}
}