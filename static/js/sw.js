/// <reference lib="webworker" />
/** @type {ServiceWorkerGlobalScope} */

// TODO: Stuff in the front end for sw errors

let cache

async function init(event) {
	const currentAssetsHashRequest = await fetch("/api/_/assetsHash")
	const assetsHash = await currentAssetsHashRequest.text()

	cache = await caches.open(assetsHash)
	const cacheContents = await cache.keys()

	if (cacheContents.length === 0) { purgeOldCaches(assetsHash) }
}

async function purgeOldCaches(currentHash) {
	const oldCaches = await caches.keys()

	for (const name of oldCaches) {
		console.log(`Deleting ${name} cache`)
		if (name !== currentHash) { caches.delete(name) }
	}
}

async function interceptor(event) {
	const cached = await cache.match(event.request, { ignoreSearch: true })
	const requestURL = new URL(event.request.url)

	if (cached) { return cached }

	const serverResponse = await fetch(event.request)
	if (event.request.method === "GET" && requestURL.pathname !== "/api/_/assetsHash") {
		if (serverResponse.ok) {
			cache.put(event.request, serverResponse.clone())
		} else { /* Error */ }
	}

	return serverResponse
}

self.addEventListener("install", self.skipWaiting)
self.addEventListener("activate", (event) => { event.waitUntil(init()) })
self.addEventListener("fetch", (event) => { event.respondWith(interceptor(event)) })