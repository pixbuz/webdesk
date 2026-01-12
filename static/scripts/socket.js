// Ask the Backend for a Web Socket
const webdeskBackend = new WebSocket(`/`)
// In the future it's going to be more usefull
const connectionTimeout = setTimeout(connectionError, 10000)

let socketReadyResolve
const socketReady = new Promise((resolve) => { socketReadyResolve = resolve })

function serverQuery(message) {
	// Sends a message to the backend and waits for a response, returns back the message contents
	// TODO: Make more robust using IDs, if necessary
	
	// Sends a message trough the websocket
	webdeskBackend.send(message)

	// Awaits for a response
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
	socketReadyResolve()
	clearTimeout(connectionTimeout)

	const appsManifests = JSON.parse(await serverQuery("app manifests"))

	loadIndexDBChecks(appsManifests)
	addLaunchers(appsManifests)

	// webdeskBackend.addEventListener("message", socketListener)
}, { once: true })