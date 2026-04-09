// TODO: Improve logging to make it actually usefull

import { log } from "./log.ts"
import { config } from "../server.config.ts"
import { AppRoute } from "./newnewMapper.ts"

// const webdesk = WebdeskRoute.create()!

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

function requestHandler(browserRequest: Request, _connInfo: Deno.ServeHandlerInfo<Deno.NetAddr>): Response {
	const requestURL: URL = new URL(browserRequest.url)
	const subOriginName: string = requestURL.hostname.substring(0, requestURL.hostname.lastIndexOf("."))
	const subOrigin: Route | undefined = AppRoute.registred[subOriginName]

	log.info(`${subOriginName !== "" ? `Suborigin "${subOriginName}" r`: "R"}ecived request for "${requestURL.pathname}"`)

	if (subOriginName === "") { /* return webdesk.respond(browserRequest) */ }
	else if (subOrigin) { return subOrigin.respond(browserRequest) }
	else { return new Response() }
}