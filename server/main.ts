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
	onListen({hostname, port}) { log.info(`Server listening on ${config.ssl ? "https:" : "http:"}//${hostname}:${port}`) }
})

// Responds to the incoming browser requests for webdesk
function requestHandler(browserRequest: Request, _connInfo: Deno.ServeHandlerInfo<Deno.NetAddr>): Response {
	const requestURL: URL = new URL(browserRequest.url)
	const requestTree: string[] = requestURL.pathname.substring(1).split("/")

	if (requestTree[0] == "api") {
		log.info(`API request for app ${requestTree[1] === "_" ? "webdesk" : requestTree[1]}, on "${requestURL.pathname}"`)
		return apiReplier(browserRequest)
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
		log.info(`Replying with asset of type "${resources.mime[request.pathname]}"`)
		// Return the asset
		return new Response(resources.assets[request.pathname] as BodyInit, { status: 200, headers: { "content-type": `${resources.mime[request.pathname]}, charset=UTF-8` } })
	} else {
		log.info(`Asset doesn't exist!`)
		// Send an user error response
		return new ErrorResponse(`Recived asset request: ${request.pathname}\n${" ".repeat(23)}^isn't a valid asset`)
	}
}
// Runs and returns a server function
function apiReplier(browserRequest: Request): Response {
	const requestURL: URL = new URL(browserRequest.url)
	const apiAppName: string = requestURL.pathname.split("/")[2]
	// If the command requested doesn't exist
	if (resources.commands[requestURL.pathname] instanceof Function) {
		// Sandbox the function, in case it errors
		try {
			// Run the function and save the result
			const result = (resources.commands[requestURL.pathname] as (request: Request) => unknown)(browserRequest)
			// Log the successful execution
			log.debug(`${apiAppName}'s command "${(resources.commands[requestURL.pathname] as Function).name}" executed without errors`)
			// If a response is produced, return the result
			if (result instanceof Response) { return result }
			else { return new Response(result as BodyInit, { status: 200 }) }
		}
		catch(error) {
			const errorStack = (error as Error).stack!.split("\n")
			log.warn(`${apiAppName}'s command "${requestURL.pathname}" failed: ${errorStack[0]}`)
			errorStack.slice(1).forEach((line) => { log.warn(line.trim()) })
			// Send an server error response
			return new ErrorResponse((error as Error).stack, 500)
		}

	} else if (resources.commands[requestURL.pathname]) {
		return new Response(resources.commands[requestURL.pathname] as BodyInit, { status: 200 })
	} else {
		log.info(`Request is for a non existing command`)
		// Send an user error response
		return new ErrorResponse(`Recived api request: ${requestURL.pathname}\n${" ".repeat(23)}^isn't a valid command`)
	}
}