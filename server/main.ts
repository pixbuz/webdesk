// TODO: App sub origins, so deprecate /apps/
// TODO: Improve logging to make it actually usefull

import { log } from "./log.ts"
import { config } from "../server.config.ts"
import { Route, WebdeskRoute } from "./newMapper.ts"

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
	onListen({ hostname, port }) {
		config.ssl ? log.info("Server using TSL/SSL") : log.warn("Server running unsecured")
		log.info(`Server listening on ${config.ssl ? "https:" : "http:"}//${hostname}:${port}`)
	}
})

for await (const app of Deno.readDir("apps")) { Route.create(app.name) }
let webdesk = WebdeskRoute.create()!

function requestHandler(browserRequest: Request, _connInfo: Deno.ServeHandlerInfo<Deno.NetAddr>): Response {
	const requestURL: URL = new URL(browserRequest.url)
	const subOriginName: string = requestURL.hostname.substring(0, requestURL.hostname.lastIndexOf("."))
	const subOrigin: Route | undefined = Route.registred[subOriginName]

	log.info(`${subOriginName !== "" ? `Suborigin "${subOriginName}" r`: "R"}ecived request for "${requestURL.pathname}"`)

	if (subOriginName === "") { return webdesk.respond(browserRequest) }
	else if (subOrigin) { return subOrigin.respond(browserRequest) }
	else { return new Response() }
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