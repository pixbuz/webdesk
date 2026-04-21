// TODO: Improve logging to make it actually usefull

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

const _server = Deno.serve({
	...options,
	onListen({ hostname, port }) {
		config.ssl ? log.info("Server using TSL/SSL") : log.warn("Server running unsecured")
		log.info(`Server listening on ${config.ssl ? "https:" : "http:"}//${hostname}:${port}`)
	}
})

for await (const app of Deno.readDir("apps")) { AppRoute.create(app.name) }

function requestHandler(browserRequest: Request, _connInfo: Deno.ServeHandlerInfo<Deno.NetAddr>) {
	const requestURL = new URL(browserRequest.url)
	const subOriginName = requestURL.hostname.substring(0, requestURL.hostname.lastIndexOf("."))
	const subOriginRoute = AppRoute.registred[subOriginName]

	log.debug(`Recived request for "${browserRequest.url}"`)

	if (subOriginName === "") { return webdeskRoute.respond(browserRequest) }
	else if (subOriginRoute) { return subOriginRoute.respond(browserRequest) }
	else { return new Response() }
}