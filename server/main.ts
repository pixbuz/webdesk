import { log } from "./log.ts"
import { config } from "../server.config.ts"
import { resources } from "./resourceMapper.ts"

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

	if (requestTree[0] == "api") {
		log.info(`API request for app ${requestTree[1] === "_" ? "webdesk" : requestTree[1]}, with search "${requestURL.search}"`)
		return apiReplier(requestURL)
	}
	else {
		log.info(`Recived request for asset "${requestURL.pathname}"`)
		return assetsReplier(requestURL)
	}
}
// Returns the contents of an app's asset
function assetsReplier(request: URL): Response {
	// If the asset exists
	if (resources.assets[request.pathname]) {
		log.info(`Replying with asset of type ${resources.mime[request.pathname]}`)
		// Return the asset
		return new Response(resources.assets[request.pathname] as BodyInit, { status: 200, headers: { "content-type": `${resources.mime[request.pathname]}, charset=UTF-8` } })
	} else {
		log.info(`Asset doesn't exist!`)
		// Send an user error response
		return new ErrorResponse(`Recived asset request: ${request.pathname}\n${" ".repeat(23)}^isn't a valid asset`)
	}
}
// Runs and returns a server function
function apiReplier(request: URL): Response {
	// If the command requested doesn't exist
	if (resources.commands[request.pathname] instanceof Function) {
		// Sandbox the function, in case return the error
		try {
			// Run the function and save the result and mime
			const [result, mime] = (resources.commands[request.pathname] as (queries: string[]) => [unknown, string])(request.search.substring(1).split("&"))
			log.info(`Replying with asset of MIME "${mime}"`)
			// Return the result with the right mime
			return new Response(result as BodyInit, { status: 200, headers: { "content-type": mime } })
		}
		catch(error) {
			const errorStack = (error as Error).stack!.split("\n")
			log.warn(`Command function for "${request.pathname}" failed: ${errorStack[0]}`)
			errorStack.slice(1).forEach((line) => { log.warn(line.trim()) })
			// Send an server error response
			return new ErrorResponse((error as Error).stack, 500)
		}
	
	} else if (resources.commands[request.pathname]) {
		return new Response(resources.commands[request.pathname] as BodyInit, { status: 200 })
	} else {
		log.info(`Request is for a non existing command`)
		// Send an user error response
		return new ErrorResponse(`Recived api request: ${request.pathname}\n${" ".repeat(23)}^isn't a valid command`)
	}
}