const cli = document.querySelector(`[name="cli"]`)
const output = document.querySelector(".output")
let port

window.addEventListener("message", (event) => { port = event.ports }, { once: true })

async function init() {
	commHistory = await webdeskDB.get("terminal", "history")

	if (commHistory == undefined) {
		await webdeskDB.createTable("terminal")
		await webdeskDB.set("terminal", "history", [])
		commHistory = []
	}

	pos = commHistory.length
}

function commandError(reason) {
	console.log(reason)
}

async function showCommandResult(response) {
	const line = document.createElement("p")
	output.append(line)

	response.text().then((text) => {
		line.innerHTML += `<span>>> ${cli.value}</span><br>${text}`
		cli.value = ""
	})
}

document.addEventListener("keydown", async (event) => {
	if (event.key == "Enter" && cli.value) {
		fetch(`/api/terminal/command?${cli.value}`)
			.then(showCommandResult)
			.catch(commandError)

		if (commHistory.at(pos) != cli.value) {
			commHistory.push(cli.value)
			pos = commHistory.length
			webdeskDB.set("terminal", "history", commHistory)
		}
	} else if (event.key == "ArrowUp") {
		pos -= (pos - 1) < 0 ? 0 : 1
		cli.value = commHistory.at(pos)
	} else if (event.key == "ArrowDown") {
		pos += (pos + 1) >= commHistory.length ? 0 : 1
		cli.value = commHistory.at(pos)
	} else if (document.activeElement != cli) {
		cli.focus()
	}
})

init()