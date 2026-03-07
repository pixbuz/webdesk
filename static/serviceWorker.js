/// <reference lib="webworker" />
/** @type {ServiceWorkerGlobalScope} */

const TRIM = self.location.origin.length
const DONTINTERCEPT = true
const VERBOSE = false

const log = new class {
	colors = Object.freeze({
		TIME: "color: darkgray",
		DEBUG: "color: cyan",
		INFO: "color: lime",
		WARN: "color: yellow",
		ERROR: "color: red"
	})

	decorations = Object.freeze({
		DEBUG: "",
		INFO: "",
		WARN: "text-decoration: underline",
		ERROR: "font-weight: bold"
	})

	relTimeBase = performance.now()
	stdcaller = `${" ".repeat(TRIM)}Service Worker`

	getRelTime() {
		const now = performance.now()
		const passMills = now - this.relTimeBase

		const secs = (passMills / 1000) % 60
		const mins = Math.floor(passMills / (60 * 1000))
		const hour = Math.floor(passMills / (60 * 60 * 1000))
		const days = Math.floor(passMills / (24 * 60 * 60 * 1000))

		return `[${`${days}`.padStart(3, "0")}:${`${hour}`.padStart(2, "0")}:${`${mins}`.padStart(2, "0")}:${`${secs.toFixed(3)}`.padStart(6, "0")}]`
	}

	getAbsTime() {
		const now = new Date()

		return [
			`[${`${now.getDate()}`.padStart(2, "0")}/${`${now.getMonth() + 1}`.padStart(2, "0")}/${now.getFullYear()}]`,
			`[${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}:${`${now.getSeconds()}`.padStart(2, "0")}.${`${now.getMilliseconds()}`.padStart(3,"0")}]`,
		]
	}

	async debug(message, url = stdcaller) {
		if (!VERBOSE) { return }

		const absTime = this.getAbsTime(), relTime = this.getRelTime()
		const path = url.substring(TRIM)

		console.log(`%c●    %c${absTime.join("    ")}    ${relTime}    %c[${path}] ${message}`, this.colors.DEBUG, this.colors.TIME, `${this.colors.DEBUG};${this.decorations.DEBUG}`)
		await new Promise(res => res())
	}

	async info(message, url = stdcaller) {
		if (!VERBOSE) { return }

		const absTime = this.getAbsTime(), relTime = this.getRelTime()
		const path = url.substring(TRIM)

		console.log(`%c▲    %c${absTime.join("    ")}    ${relTime}    %c[${path}] ${message}`, this.colors.INFO, this.colors.TIME, `${this.colors.INFO};${this.decorations.INFO}`)
		await new Promise(res => res())
	}

	async warn(message, url = stdcaller) {
		if (!VERBOSE) { return }

		const absTime = this.getAbsTime(), relTime = this.getRelTime()
		const path = url.substring(TRIM)
	
		console.warn(`%c◼    %c${absTime.join("    ")}    ${relTime}    %c[${path}] ${message}`, this.colors.WARN, this.colors.TIME, `${this.colors.WARN};${this.decorations.WARN}`)
		await new Promise(res => res())
	}

	async error(message, url = stdcaller) {
		const absTime = this.getAbsTime(), relTime = this.getRelTime()
		const path = url.substring(TRIM)
	
		console.error(`%c⬟    ${absTime.join("    ")}    ${relTime}    %c[${path}] ${message}`, this.colors.ERROR, `${this.colors.ERROR};${this.decorations.ERROR}`)
		await new Promise(res => res())
	}
}

// Register and activate the service worker
function installCallback(event) {
	log.warn("Attempting to run the service worker")

	try {
		// Run the sw immediately
		self.skipWaiting()
		log.info("Service worker running successfully")
	} catch(error) {
		// Log the error
		// TODO: idk stuff in the front end
		log.error("Failed to run the service worker:")
		console.error(error)
	}
}

// Main request intercept logic
async function fetchCallback(event) {
	// Log the request
	log.info(`Recived request`, event.request.url)
	// If the request doesn"t use the GET method, ignore it
	if (event.request.method !== "GET") {
		console.log(`Ignoring, method is ${event.request.method}`, event.request.url)
		return
	}

	if (DONTINTERCEPT) {
		log.debug(`Don't intercept mode, returning the server response`, event.request.url)
		event.respondWith(fetch(event.request))
	} else {
		event.respondWith(
			// Search the caches to find the requested file
			caches.match(event.request, { ignoreSearch: true }).then(async (cachedResponse) => {
				// If the request was found in the cache, return the content
				if (cachedResponse) {
					log.debug(`Cache HIT!`, event.request.url)
					return cachedResponse
				}

				log.info(`Cache MISS, forwarding the request to the server`, event.request.url)
				// Ask the server the request url and return in to the client
				return (await askServer(event.request))
			})
		)
	}
}

// Fetches a request from the server, caching it in parallel
// IDEA: Use multiple caches for different things IF overlap problem emerges
async function askServer(request) {
	// Fall trought with the request to the server
	const serverResponse = await fetch(request)
	// Clone the respose to save it to cache
	const responseClone = serverResponse.clone()

	// Log the server response
	log.info(`Server responded with code ${serverResponse.status} (${serverResponse.statusText})`, request.url)

	// Save the response to the cache
	caches.open("webdesk").then((cache) => { cache.put(request, responseClone) })
	// Return the response
	return serverResponse
}

self.addEventListener("install", installCallback)
self.addEventListener("fetch", fetchCallback)