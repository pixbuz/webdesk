/// <reference lib="webworker" />
/** @type {ServiceWorkerGlobalScope} */

// TODO: Stuff in the front end for sw errors

let cache

const initialized = init()

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

	let serverResponse
	try { serverResponse = await fetch(event.request) }
	catch (error) { serverResponse = new Response(`${requestURL.pathname}: ${error.stack}`, { status: 500 }) }

	if (requestURL.pathname === "/api/_/assetsHash") { return serverResponse }
	else if (event.request.method === "GET" && serverResponse.ok) { cache.put(event.request, serverResponse.clone()) }

	return serverResponse
}

self.addEventListener("install", self.skipWaiting)
self.addEventListener("activate", (event) => { event.waitUntil(initialized) })
self.addEventListener("fetch", (event) => { event.respondWith(interceptor(event)) })