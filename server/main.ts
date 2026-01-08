import { config } from "../server.settings.ts"
import { sockets } from "./websocketer.ts"
import * as resources from "./resourceMapper.ts"

const _server = Deno.serve({	// TODO: Add SSL/TLS
	port: config.port,
	hostname: config.hostname,
	handler: requestResponder
})

async function requestResponder(request: Request, connInfo: Deno.ServeHandlerInfo) {
	// Main function that replies to incoming browser requests
	await resources.ready
	const url = new URL(request.url)

	if (request.headers.get("upgrade") === "websocket") {
		// TODO: Make this more secure
		const upgrade = Deno.upgradeWebSocket(request)

		sockets.add((connInfo.remoteAddr as Deno.NetAddr).hostname, upgrade.socket)
		return upgrade.response
	}

	console.log(`Request from Client: "${ url.pathname }"`)
	if (resources.routes[url.pathname]) { return new Response(resources.routes[url.pathname], resources.headers[url.pathname]) }
	else return new Response("", { status: 400 })
}