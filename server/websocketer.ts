import * as resources from "./resourceMapper.ts"

class WebSocketManager {
	private webSocketRooms: Map<string, WebSocket[]> = new Map()

	public addSocket(webSocket: WebSocket, id: string) {
		if (!this.webSocketRooms.has(id)) this.webSocketRooms.set(id, [])
		webSocket.addEventListener("open", () => sockets.register(webSocket, id), { once: true })
	}

	private register(webSocket: WebSocket, id: string) {
		this.webSocketRooms.set(id, [webSocket, ...this.webSocketRooms.get(id)!])

		webSocket.addEventListener("message", (event) => { this.socketResponder(event.target as WebSocket, event.data, id) })
		webSocket.addEventListener("close", (event) => { sockets.unregister(event.target as WebSocket, id) }, { once: true })
	}

	private unregister(closedSocket: WebSocket, id: string) {
		const oldRoomSockets = this.webSocketRooms.get(id)!
		const newRoomSockets = oldRoomSockets.filter(socket => socket != closedSocket)
		this.webSocketRooms.set(id, newRoomSockets)
	}

	private socketResponder(socket: WebSocket, message: string, id: string) {
		// Websocket messages handler function
		// Command format: '[command category] [sub command] [info]'
		console.log(`Message in Room ${id}: "${message}"`)
		const command = message.split(" ")

		switch (command[0]) {
			case "app": socket.send(this.socketAppHandle(command)); break
			case "client": this.broadcastMessageInRoom(socket, command, id); break
		}
	}

	private broadcastMessageInRoom(sendingSocket: WebSocket, command: string[], id: string) {
		// Replays a message to all the open Web Sockets in a room
		// but the original Web Socket where the message originated
		for (const socket of this.webSocketRooms.get(id)!) {
			if (socket == sendingSocket) continue
			socket.send(command.join(" "))
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