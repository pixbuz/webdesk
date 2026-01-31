import * as resources from "./resourceMapper.ts"

class WebSocketManager {
	// Felt like making a class for this
	constructor() {
		resources.registerSocketCommand(["app"], this.socketAppHandle)
	}

	public upgrade(upgradeRequest: Request): Response {
		// Upgrade a client request to a Web Socket
		// TODO: Make this more secure

		const upgrade = Deno.upgradeWebSocket(upgradeRequest)
		upgrade.socket.addEventListener("message", this.socketResponder.bind(this))

		return upgrade.response
	}

	private socketResponder(event: MessageEvent): void {
		// Websocket messages Handler

		// Command format: '[target] [command] [additional info]'
		const command: string[] = event.data.split(" ")

		// Pointer used to browse the command tree
		let current = resources.socketCommands
		// For each part of the command:
		for (let i = 0; i < command.length; i++) {
			// If the current command part is a function in the tree, execute it
			if (current[command[i]] instanceof Function) { (current[command[i]] as Function)(event.target, command); break }
			// If the last command part is not a function, notify about the partial command
			else if (i == command.length - 1) { return console.log("Recived Partial Command:", command) }
			// If the current part of the function isn't in the command tree, notify about unknown command
			else if (current[command[i]] == undefined) { return console.log("Recived Unknown Command:", command) }
			// If the current part is indexable, move the pointer
			else { current = current[command[i] as string] as resources.SocketCommandTree }
		}
	}

	private socketAppHandle(socket: WebSocket, command: string[]) {
		// Web socket "app" command Handler
		switch(command[1]) {
			case "manifests": return socket.send(JSON.stringify(resources.appsManifests))

			default: return ""
		}
	}
}

export const sockets = new WebSocketManager()