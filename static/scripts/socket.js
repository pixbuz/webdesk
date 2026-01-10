/*
 * The functions that make the
 * Web Socket Bus System work
*/

if (null === localStorage.getItem("session")) {
	localStorage.setItem("session", crypto.randomUUID())
}

const roomID = localStorage.getItem("session")
const roomSocket = new WebSocket(`/${roomID}`)
const errorTimeout = setTimeout(() => { console.log("Unable to connect to Web Socket") }, 10000)

function serverQuery(message) {
	// Sends a message to the backend and waits for a response,
	// returns back the message contents
	// TODO: Make more robust using IDs, if necessary
	roomSocket.send(message)

	return new Promise(resolve =>
		roomSocket.addEventListener("message",
			response => resolve(response.data), { once: true }
		)
	)
}

roomSocket.addEventListener("open", async () => {
	clearTimeout(errorTimeout)

	const apps = (await serverQuery("app manifests"))
	const appsJSON = JSON.parse(apps)
	
	for (appName of Object.keys(appsJSON)) {
		addLauncher(appName, appsJSON[appName].desc)
	}
})

roomSocket.addEventListener("message", socketRoomListener)

function socketRoomListener(event) {
	console.log(`Recived "${event.data}" from Room`)
	const command = event.data.split(" ")

	switch(command[0]) {
		case "client": event.target.send(socketClientCommandHandler(command))
	}
}

function socketClientCommandHandler(command) {
	switch(command[1]) {
		case "get": return socketClientGetCommandHandler(command)
	}
}

function socketClientGetCommandHandler(command) {
	switch(command[2]) {
		case "settings": return "client settings {stuff: {stuff: []}}"
	}
}