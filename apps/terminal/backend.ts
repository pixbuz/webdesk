export function socket(request: Request) {
	const { socket, response } = Deno.upgradeWebSocket(request)

	socket.addEventListener("message", commandInterpreter)

	return response
}

function commandInterpreter(event: MessageEvent) {
	const commandTree: string[] = event.data.split(" ")
	switch(commandTree[0]) {
		case "help": break
		case "echo": (event.target as WebSocket).send(commandTree.slice(1).join(" "))
		default: break
	}
}