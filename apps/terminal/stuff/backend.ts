export function socket(request: Request) {
	const { socket, response } = Deno.upgradeWebSocket(request)

	socket.addEventListener("message", commandInterpreter)

	return response
}

function commandInterpreter(event: MessageEvent) {
	const commandTree: string[] = event.data.split(" ")
	const socket: WebSocket = event.target as WebSocket
	switch(commandTree[0]) {
		case "echo": socket.send(commandTree.slice(1).join(" "))
		default: 
	}
}