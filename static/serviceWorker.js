/// <reference lib="webworker" />
/** @type {ServiceWorkerGlobalScope} */

// TODO: Stuff in the front end for sw errors

// IDEA: Use multiple caches for different things IF overlap problem emerges

let updateCacheFlag = false
let updated = new Set()
let cache

async function reactToAssetsChanges(response) {
	const currentAssetsHash = new Response(await response.text())
	const savedAssetsHash = await cache.match("hash")

	if (savedAssetsHash !== currentAssetsHash) {
		updateCacheFlag = true
		cache.put("hash", currentAssetsHash)
		console.log("Assets changed from last registration!")
	} else { console.log("Assets hash stayed the same") }
}

async function init() {
	cache = await caches.open("webdesk")

	fetch("/api/_/assetsHash")
		.then(reactToAssetsChanges)
		.catch((error) => { console.log(error) })
}

let initPromise = init()

async function interceptor(event) {
	await initPromise
	const cached = await cache.match(event.request, { ignoreSearch: true })

	if (event.request.method !== "GET") { return fetch(event.request) }
	else if ((updateCacheFlag && !updated.has(event.request.url)) || !cached) {
		const serverResponse = await fetch(event.request)

		if (serverResponse.ok) {
			cache.put(event.request, serverResponse.clone())
			updated.add(event.request.url)
		} else { /* Error */ }

		return serverResponse
	} else { return cached }
}

self.addEventListener("install", () => { self.skipWaiting() })
self.addEventListener("fetch", (event) => { event.respondWith(interceptor(event)) })