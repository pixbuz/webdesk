export function testFunction(webSocket: WebSocket, command: string) {
	console.log(command)
	webSocket.send("hello")
	console.log(Deno.cwd())
}