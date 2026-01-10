import * as resources from "./resourceMapper.ts"

class WebSocketManager {
	public register(webSocket: WebSocket) {
		// Adds a Message Listener in a newly created Web Socket
		webSocket.addEventListener("message", (event) => { this.socketResponder(event.target as WebSocket, event.data) })
	}

	private socketResponder(socket: WebSocket, message: string) {
		// Websocket messages handler function
		// Command format: '[command category] [sub command] [info]'
		const command = message.split(" ")

		switch (command[0]) {
			case "app": socket.send(this.socketAppHandle(command)); break
		}
	}

	private socketAppHandle(command: string[]) {
		// Websocket "app" command handler function
		switch(command[1]) {
			case "manifests": return JSON.stringify(resources.appsManifests)

			default: return ""
		}
	}
}

export const sockets = new WebSocketManager()