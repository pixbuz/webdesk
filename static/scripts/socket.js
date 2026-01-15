// Ask the Backend for a Web Socket Connection
const webdeskBackend = new WebSocket(`/`)

// In the future it's going to be more usefull
const connectionTimeout = setTimeout(connectionError, 10000)

function serverQuery(message) {
	// Sends a message to the backend and waits for a response, returns back the message contents
	// TODO: Make more robust using IDs, if necessary
	
	// Sends a message trough the websocket
	webdeskBackend.send(message)

	// Waits for a response
	// TODO: Add a timeout
	return new Promise((resolve) => {
		webdeskBackend.addEventListener("message", (response) => {
			resolve(response.data)
		}, { once: true })
	})
}

function connectionError() {
	// In the future it's going to be more usefull
	console.log("Unable to connect to Web Desk's Backend")
}

webdeskBackend.addEventListener("error", connectionError, { once: true })
webdeskBackend.addEventListener("open", async () => {
	// Clear the Timeout when Connected
	clearTimeout(connectionTimeout)

	// Ask the server for the Installed Apps Manifests
	const appsManifests = JSON.parse(await serverQuery("app manifests"))

	// Send the Manifests to the init functions
	loadIndexDBChecks(appsManifests)
	addLaunchers(appsManifests)
}, { once: true })