// TODO: Sub origins... fun

import { log } from "./log.ts"
import { config } from "../server.config.ts"
import { resources } from "./resourceMapper.ts"

class ErrorResponse extends Response {
	static notValidResponse(requestURL: string, type: string) {
		log.info(`"${requestURL}" isn't a valid ${type}`)
		return new ErrorResponse(`Recived ${type} request: ${requestURL}\n${" ".repeat(17 + type.length)}^ isn't a valid ${type}`)
	}

	static commandExeption(error: unknown) {
		log.printStack((error as Error).stack)
		return new ErrorResponse((error as Error).stack, 500)
	}

	constructor(message: string | undefined, code: number = 400) {
		super(message, { status: code, headers: { "content-type": "text/plain" } })
	}
}

class WebdeskResponse extends Response {
	constructor(body: any, mime: string = "text/plain") {
		super(body as BodyInit, { status: 200, headers: { "content-type": `${mime}, charset=UTF-8` } })
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

function requestHandler(browserRequest: Request, _connInfo: Deno.ServeHandlerInfo<Deno.NetAddr>): Response {
	const requestURL: URL = new URL(browserRequest.url)
	const requestTree: string[] = requestURL.pathname.substring(1).split("/")

	log.debug(`Recived request for "${requestURL.pathname}"`)

	if (requestTree[0] == "api") { return apiReplier(browserRequest) }
	else { return assetsReplier(requestURL) }
}

function assetsReplier(request: URL): Response {
	if (resources.assets[request.pathname]) {
		log.info(`Replying with asset of type "${resources.mime[request.pathname]}"`)
		return new WebdeskResponse(resources.assets[request.pathname], resources.mime[request.pathname])
	} else { return ErrorResponse.notValidResponse(request.pathname, "asset") }
}

function apiReplier(browserRequest: Request): Response {
	type commandFunction = (request: Request) => [ unknown, string? ]

	const requestURL: URL = new URL(browserRequest.url)
	const apiAppName: string = requestURL.pathname.split("/")[2]
	const command: commandFunction | unknown = resources.commands[requestURL.pathname]

	if (command instanceof Function) {
		const commandName = command.name

		try {
			const output: [ unknown, string? ] | unknown = (command)(browserRequest)
			let data: unknown, mime: string

			if (Array.isArray(output)) { [ data, mime ] = output }
			else { data = output }

			log.debug(`${apiAppName === "_" ? "webdesk" : apiAppName}'s command "${commandName}" executed without errors`)

			if (data instanceof Response) { return data }
			else { return new WebdeskResponse(data, mime) }
		}
		catch(error) {
			log.warn(`${apiAppName === "_" ? "webdesk" : apiAppName}'s command "${requestURL.pathname}" failed: ${(error as Error).message}`)
			return ErrorResponse.commandExeption(error)
		}
	} else if (Array.isArray(command)) {
		log.debug(`Returned the static value of ${apiAppName === "_" ? "webdesk" : apiAppName} of type ${command[1]}`)
		return new WebdeskResponse(command[0], command[1])
	} else if (command) {
		log.debug(`Returned the static value of ${apiAppName === "_" ? "webdesk" : apiAppName}`)
		return new WebdeskResponse(command, "text/plain")
	} else { return ErrorResponse.notValidResponse(requestURL.pathname, "command") }
}