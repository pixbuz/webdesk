import { config } from "../server.settings.ts"
import * as resources from "./resourceMapper.ts"

let websockets: WebSocket[] = []
const _server = Deno.serve({	// TODO: Add SSL/TLS
	port: config.port,
	hostname: config.hostname,
	handler: requestResponder
})

async function requestResponder(request: Request, _connInfo: object) {
	// Main function that replies to incoming browser requests
	await resources.ready
	const url = new URL(request.url)

	if (request.headers.get("upgrade") === "websocket") {
		// TODO: Make this more secure
		const upgrade = Deno.upgradeWebSocket(request)

		upgrade.socket.addEventListener("close", event => { delete websockets[websockets.indexOf(event.target as WebSocket)] })
		upgrade.socket.addEventListener("open", event => { websockets.push(event.target as WebSocket) })
		upgrade.socket.addEventListener("message", socketResponder)

		return upgrade.response
	}

	console.log(`Request from Client: "${ url.pathname }"`)
	if (resources.routes[url.pathname]) { return new Response(resources.routes[url.pathname], resources.headers[url.pathname]) }
	else return new Response("", { status: 400 })
}

function socketResponder(event: MessageEvent) {
	// Websocket messages handler function
	console.log(`Request from Client Websocket: "${ event.data }"`)
	// Command format: '[command type] [sub command] [target (if any)] [additional info (if any)]'
	const command = event.data.split(" ")

	switch (command[0]) {
		case "app": return socketAppHandle(command, event.target as WebSocket)

		default: return (event.target as WebSocket).send("bad request")
	}
}

function socketAppHandle(command: string[], socket: WebSocket) {
	// Websocket "app" command handler function
	switch(command[1]) {
		case "list": return socket.send(Object.keys(resources.installedApps).toString())
		case "desc": return socket.send(resources.installedApps[command[2]].desc)
	}
}