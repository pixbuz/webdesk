import { config } from "../server.settings.ts"
import * as resources from "./resourceMapper.ts"

let websockets: WebSocket[] = []
const _encoder: TextEncoder = new TextEncoder()
const _decoder: TextDecoder = new TextDecoder()
const _server = Deno.serve({
	port: config.port,
	hostname: config.hostname,
	handler: requestResponder
})

async function requestResponder(request: Request, _connInfo: object) {
	await resources.ready
	const url = new URL(request.url)

	if (request.headers.get("upgrade") === "websocket") {
		const upgrade = Deno.upgradeWebSocket(request)
		
		upgrade.socket.addEventListener("close", event => { websockets = websockets.filter(socket => socket === (event.target as WebSocket)) })
		upgrade.socket.addEventListener("open", event => { websockets.push(event.target as WebSocket) })
		upgrade.socket.addEventListener("message", socketResponder)

		return upgrade.response
	}

	console.log(`Request from Client: "${ url.pathname }"`)
	if (resources.routes[url.pathname]) {
		return new Response(await Deno.readFile(resources.routes[url.pathname]), resources.headers[url.pathname])
	} else return new Response("", { status: 400 })
}

function socketResponder(event: MessageEvent) {
	console.log(`Request from Client Websocket: "${ event.data }"`)
	const command = event.data.split(" ")

	switch (command[0]) {
		case "app": return socketAppHandle(command, event.target as WebSocket)

		default: return (event.target as WebSocket).send("what")
	}
}

function socketAppHandle(command: string[], socket: WebSocket) {
	switch(command[1]) {
		case "list": return socket.send(Object.keys(resources.appProprieties).toString())
		case "desc": return socket.send(resources.appProprieties[command[2]].desc)
	}
}