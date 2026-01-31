import { config } from "../server.config.ts"
import { sockets } from "./webSocketer.ts"
import * as resources from "./resourceMapper.ts"

const _server = Deno.serve({
	// TODO: Add SSL/TLS
	port: config.port,
	hostname: config.hostname,
	handler: requestResponder
})

// Main function that replies to incoming browser requests
function requestResponder(request: Request, _connInfo: Deno.ServeHandlerInfo) {
	// Simplifies the logic
	const url = new URL(request.url)

	// Handles web socket's upgrade requests
	if (request.headers.get("upgrade") === "websocket") { return sockets.upgrade(request) }

	// Log a client request for debug
	console.log(`Request from Client: "${ url.pathname }"`)
	// If the requested endpoint is indexed, return it
	if (resources.routes[url.pathname]) { return new Response(resources.routes[url.pathname], resources.headers[url.pathname]) }
	else return new Response("", { status: 400 })
}