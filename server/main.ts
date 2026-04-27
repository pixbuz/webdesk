import { log } from "./log.ts"
import { config } from "../server.config.ts"
import { AppRoute, webdeskRoute } from "./mapper-v3.ts"

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

log.debug(`Server is going to use ${config.ssl ? "https" : "http"}`)
log.verbose(`Full server options object: ${JSON.stringify(options)}`)

const _server = Deno.serve({
	...options,
	onListen({ hostname, port }) {
		log.info(`Server listening on ${config.ssl ? "https:" : "http:"}//${hostname}:${port}`)
	}
})

log.info("Registering application routes")
try {
	for await (const app of Deno.readDir("apps")) {
		log.verbose(`Mapping entry found: "${app.name}"`)
		AppRoute.create(app.name)
	}
} catch (error) { log.error(`Critical failure during app registration: ${(error as Error).message}`) }

function requestHandler(browserRequest: Request, _connInfo: Deno.ServeHandlerInfo<Deno.NetAddr>) {
	const requestURL = new URL(browserRequest.url)
	log.verbose(`New request received. URL: ${browserRequest.url}, Method: ${browserRequest.method}`)
	log.verbose(`Parsing hostname "${requestURL.hostname}" to find suborigin`)
	const subOriginName = requestURL.hostname.substring(0, requestURL.hostname.lastIndexOf("."))
	log.verbose(`Resulting sub-origin key: "${subOriginName}"`)

	const subOriginRoute = AppRoute.registred[subOriginName]

	if (subOriginName === "") {
		log.debug("Branch selected: Empty sub-origin detected. Routing to webdeskRoute.")
		return webdeskRoute.respond(browserRequest);
	}
	
	if (subOriginRoute) {
		log.debug(`Branch selected: Sub-origin "${subOriginName}" matched a registered route.`)
		return subOriginRoute.respond(browserRequest);
	}

	// If we reach here, no route was found
	log.warn(`Unexpected Request: No registered route found for sub-origin "${subOriginName}".`)
	log.debug("Branch selected: Defaulting to empty Response (404-like behavior).")
	return new Response(null, { status: 404 });
}