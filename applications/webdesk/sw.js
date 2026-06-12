import { log, IndexDB } from "/srv/webdesk"

const settings = {
	logLevel: 0,
	cacheReply: false,
	cacheName: "webdesk",
	replayOnConnGain: {
		enabled: true,
		tableName: "requests",
	}
}

async function queueRequest(request) {
	await IndexDB.createTable(settings.replayOnConnGain.tableName)
	
	const serialized = {
		url: request.url,
		method: request.method,
		headers: Object.fromEntries(request.headers.entries()),
		body: request.method !== "GET" && request.method !== "HEAD" ? await request.clone().text() : null
	}
	
	const key = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
	await IndexDB.set(settings.replayOnConnGain.tableName, key, serialized)
	log.info(`Queued offline request: ${request.method} ${request.url}`)
}

async function replayRequests() {
	const requests = await IndexDB.getAll(settings.replayOnConnGain.tableName, true)
	if (!requests) return

	for (const [ key, req ] of Object.entries(requests)) {
		try {
			await fetch(req.url, {
				method: req.method,
				headers: req.headers,
				body: req.body
			})
			await IndexDB.delete(settings.replayOnConnGain.tableName, key)
			log.info(`Successfully replayed request to "${req.url}"`)
		} catch (err) { log.warn(`Failed to replay request "${req.url}"! Keeping it in queue`) }
	}
}

async function handleGet(request) {
	const cachedResponse = await caches.match(request)
	if (settings.cacheReply && cachedResponse) return cachedResponse
	
	try {
		let networkResponse = await fetch(request)
		if (networkResponse.ok) {
			const contentType = networkResponse.headers.get("content-type")
			
			if (request.url.includes("/app/") && contentType && contentType.includes("text/html")) {
				const headers = new Headers(networkResponse.headers)
				let html = await networkResponse.text()
				
				html = html.replace("<head>", `<head>${appImportMap}`)
				headers.delete("content-length")
				
				networkResponse = new Response(html, {
					status: networkResponse.status,
					statusText: networkResponse.statusText,
					headers: headers
				})
			}
			
			const cache = await caches.open(settings.cacheName)
			cache.put(request, networkResponse.clone())
		}
		return networkResponse
	} catch (err) {
		return new Response("Offline and page not cached", {
			status: 503,
			statusText: "Service Unavailable",
			headers: { "Content-Type": "text/plain" }
		})
	}
}

async function handleBodyRequest(request) {
	try { return await fetch(request) }
	catch (error) {
		if (self.registration.sync && settings.replayOnConnGain.enabled) {
			log.warn("Network failed. Queueing request for background sync...")
			await queueRequest(request)
			await self.registration.sync.register("retry-failed-requests")
			const body = JSON.stringify({ status: "queued", message: "Offline. Will retry when connected." })
			
			return new Response(body, { headers: { "Content-Type": "application/json" } })
		}
		return Promise.reject(error)
	}
}

async function init() {
	const response = await fetch("/importMap")
	if (response.ok) appImportMap = await response.text()
	else appImportMap = ""
}

let appImportMap

init()

IndexDB.createTable(settings.replayOnConnGain.tableName)

self.addEventListener("fetch", event => {
	if (event.request.method === "GET") event.respondWith(handleGet(event.request))
	else event.respondWith(handleBodyRequest(event.request))
})

self.addEventListener("install", event => self.skipWaiting())

self.addEventListener("activate", event => {
	event.waitUntil(async () => { for await (const key of caches.keys()) if (key !== settings.cacheName) return caches.delete(key) })
	self.clients.claim()
})

self.addEventListener("message", event => {
	if (event.data && event.data.action === "FLUSH_QUEUE") {
		log.info("Replaying saved offline requests")
		event.waitUntil(replayRequests())
	}
})