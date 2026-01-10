/*
 * Browers root document Web Socket manager
*/

const webdeskBackend = new WebSocket(`/`)
const connectionTimeout = setTimeout(connectionError, 10000)

let socketReadyResolve
const socketReady = new Promise((resolve) => { socketReadyResolve = resolve })

function serverQuery(message) {
	// Sends a message to the backend and waits for a response,
	// returns back the message contents
	// TODO: Make more robust using IDs, if necessary
	webdeskBackend.send(message)

	return new Promise((resolve) => {
		webdeskBackend.addEventListener("message", (response) => {
			resolve(response.data)
		}, { once: true })
	})
}

function connectionError() {
	console.log("Unable to connect to Web Desk's Backend")
}

function socketListener(event) {
	console.log(event)
}

webdeskBackend.addEventListener("error", connectionError, { once: true })
webdeskBackend.addEventListener("open", async () => {
	socketReadyResolve()
	clearTimeout(connectionTimeout)

	const appsManifests = JSON.parse(await serverQuery("app manifests"))

	loadIndexDBChecks(appsManifests)
	addLaunchers(appsManifests)

	webdeskBackend.addEventListener("message", socketListener)
}, { once: true })