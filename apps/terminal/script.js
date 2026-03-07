// TODO: Message bridge to access IndexDB and Localstorage from windows
// const webdeskDB = window.parent.webdeskDB
const cli = document.querySelector(`[name="cli"]`)
const output = document.querySelector(".output")
let commHistory, pos

;(async () => {
	commHistory = await webdeskDB.get("terminal", "history")

	if (commHistory == undefined) {
		await webdeskDB.createTable("terminal")
		await webdeskDB.set("terminal", "history", [])
		commHistory = []
	}

	pos = commHistory.length
})()

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