import * as resources from "./resourceMapper.ts"

class WebSocketManager {
	webSocketList: Record<string, WebSocket[]> = {}
	reverseSockets: WeakMap<WebSocket, string> = new WeakMap()

	public add(ip: string, webSocket: WebSocket) {
		webSocket.addEventListener("open", () => { sockets.register(ip, webSocket) })
		webSocket.addEventListener("close", () => { sockets.unregister(ip, webSocket) })
		webSocket.addEventListener("message", this.socketResponder.bind(this))
	}

	private register(ip: string, webSocket: WebSocket) {
		if (!this.webSocketList[ip]) this.webSocketList[ip] = []
		this.webSocketList[ip] = [ webSocket, ...this.webSocketList[ip] ]
		this.reverseSockets.set(webSocket, ip)
	}

	private unregister(ip: string, webSocket: WebSocket) {
		this.reverseSockets.delete(webSocket)
		delete this.webSocketList[ip]
	}

	private socketResponder(event: MessageEvent) {
		// Websocket messages handler function
		console.log(`Request from Client Websocket: "${ event.data }"`)
		// Command format: '[command type] [sub command] [target (if any)] [additional info (if any)]'
		const command = event.data.split(" ")

		switch (command[0]) {
			case "app": return this.socketAppHandle(command, event.target as WebSocket)
			case "settings": return this.socketSettingsHandle(command, event.target as WebSocket)

			default: return (event.target as WebSocket).send("bad request")
		}
	}

	private socketAppHandle(command: string[], socket: WebSocket) {
		// Websocket "app" command handler function
		switch(command[1]) {
			case "list": return socket.send(Object.keys(resources.installedApps).toString())
			case "desc": return socket.send(resources.installedApps[command[2]].desc)
		}
	}

	private socketSettingsHandle(command: string[], socket: WebSocket) {
		// Websocket "settings" command handler function
		switch(command[1]) {
			case "list": return socket.send("a")
		}
	}

}

export const sockets = new WebSocketManager()