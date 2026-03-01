const cli = document.querySelector(`[name="cli"]`)
const commandSocket = new WebSocket("/api/terminal/socket")

document.addEventListener("keydown", (event) => {
	if (event.key == "Enter") {
		commandSocket.send(cli.value)
		cli.value = ""
	} else if (document.activeElement != cli) {
		cli.focus()
	}
})

commandSocket.onmessage = (event) => {
	console.log(event.data)
}