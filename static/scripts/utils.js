/*
 * Contains miscellaneous functions that
 * aid the execution of other functions
*/

const socket = new WebSocket("http://localhost:3720")

function serverQuery(message) {
	// Sends a message to the backend and waits for a response,
	// returns back the message contents
	// TODO: Make more robust using IDs, if necessary
	socket.send(message)

	return new Promise(resolve =>
		socket.addEventListener("message",
			response => resolve(response.data), { once: true }
		)
	)
}

socket.addEventListener("open", async () => {
	const apps = (await serverQuery("app list"))
		.split(",")
		.sort()

	for (appName of apps) await addLauncher(appName)
})