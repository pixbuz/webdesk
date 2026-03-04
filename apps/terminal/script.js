const cli = document.querySelector(`[name="cli"]`)
const commandSocket = new WebSocket("/api/terminal/socket")
const webdeskDB = window.parent.Utilities.webdeskDB
const output = document.querySelector(".output")
let commHistory

;(async () => {
	commHistory = await webdeskDB.get("terminal", "history")

	if (commHistory == undefined) {
		await webdeskDB.createTable("terminal")
		await webdeskDB.set("terminal", "history", [])
	}

	commHistory = []
})()

// TODO: Add histiory
// TODO: Fix command view order

document.addEventListener("keydown", (event) => {
	if (event.key == "Enter") {
		commandSocket.send(cli.value)
		commHistory.push(cli.value)
	} else if (document.activeElement != cli) {
		cli.focus()
	}
})

commandSocket.onmessage = (event) => {
	const line = document.createElement("p")
	webdeskDB.set("terminal", "history", commHistory)

	output.append(line)

	line.innerText = `${cli.value}\n${event.data}`
	cli.value = ""
}