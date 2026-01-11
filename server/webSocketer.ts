import * as resources from "./resourceMapper.ts"

class WebSocketManager {
	constructor() {
		resources.registerSocketCommand(["app"], this.socketAppHandle)
	}

	public register(webSocket: WebSocket) {
		// Adds a Message Listener in a newly created Web Socket
		webSocket.addEventListener("message", this.socketResponder.bind(this))
	}

	private socketResponder(event: MessageEvent) {
		// Websocket messages handler function
		// Command format: '[target] [command] [additional info]'
		const command = event.data.split(" ")
		
		let current = resources.socketCommands
		for (let i = 0; i < command.length; i++) {
			const part = command[i]

			if (current[part] instanceof Function) { return current[part](event.target, command) }
			else if (i == command.length - 1) { return console.log("Recived Partial Command:", command) }
			else if (current[part] == undefined) { return console.log("Recived Unknown Command:", command) }
			else { current = current[part] as resources.SocketCommandTree }
		}
	}

	private socketAppHandle(socket: WebSocket, command: string[]) {
		// Websocket "app" command handler function
		switch(command[1]) {
			case "manifests": return socket.send(JSON.stringify(resources.appsManifests))

			default: return ""
		}
	}
}

export const sockets = new WebSocketManager()