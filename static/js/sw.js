/// <reference lib="webworker" />

// TODO: Stuff in the front end for sw errors

const bannedCachingPathnames = [ "/api/appHashes" ]
const hostname = self.location.hostname
const verbose = false

class Cashier {
	static cashiers = { }
	static registred = [ ]

	#hash
	#cache
	#appName
	#ready

	async #init() {
		const cache = this.#cache = await caches.open(this.#appName)
		const oldHashObject = await cache.match("hash")
		const assets = await cache.keys()

		let oldHash

		log(`${this.#appName} cache opened, ${assets.length} assets inside`)

		if (oldHashObject instanceof Response) {
			oldHash = oldHashObject.headers.get("hash")
			log(`${this.#appName} has an old hash: ${oldHash}`)
		}
		if (oldHash && oldHash !== this.#hash) {
			log(`${this.#appName} old hash doesn't match current, emptying cache`)
			for (const name of assets) { this.#cache.delete(name) }
			log(`${this.#appName} cache emptied`)
		}

		cache.put("hash", new Response(null, { headers: { "hash": this.#hash }}))
	}
	async respond(request, pathname) {
		await this.#ready

		log(`${this.#appName} cache looking up ${pathname}`)
		const cacheLookup = await this.#cache.match(request)

		if (bannedCachingPathnames.includes(pathname)) { return await fetch(request) }
		else if (cacheLookup) {
			log(`${this.#appName} cache hit for ${pathname}`)
			return cacheLookup
		}

		log(`${this.#appName} cache miss for ${pathname}`)
		const serverFetch = await fetch(request)
		
		if(serverFetch.ok) { this.#cache.put(request, serverFetch.clone()) }

		return serverFetch
	}

	constructor(appName, hash) {
		this.#hash = hash
		this.#appName = appName

		this.#ready = this.#init()

		Cashier.registred.push(appName)
		Cashier.cashiers[appName] = this
	}
}

async function init() {
	const response = await fetch("/api/appHashes")
	const hashes = await response.json()
	
	for (const appName of Object.keys(hashes)) {
		new Cashier(appName, hashes[appName])
	}
}

/** @param {FetchEvent} event */
async function interceptor(event) {
	const requestURL = new URL(event.request.url)
	const origin = requestURL.hostname.toLocaleLowerCase()
	const subOrigin = origin.substring(0, origin.indexOf(hostname) - 1).toLocaleLowerCase()
	const preloadResponse = await event.preloadResponse

	if (preloadResponse) { return preloadResponse }
	else if (subOrigin === "") { return Cashier.cashiers["webdesk"].respond(event.request, requestURL.pathname) }
	else if (Cashier.registred.includes(subOrigin)) { return Cashier.cashiers[subOrigin].respond(event.request, requestURL.pathname) }
	else { return await fetch(event.request) }
}

/** @param {MessageEvent} event */
async function com(event) {
	if (event.data === "checkHashes") { await init() }
	else { log(`Unknown command ${event.data}`) }
}

function log(...stuff) {
	if (!verbose) { return }
	console.log(...stuff)
}

self.addEventListener("install", self.skipWaiting)
self.addEventListener("fetch", (event) => { event.respondWith(interceptor(event)) })
self.addEventListener("activate", (event) => { event.waitUntil((async () => {
	if (self.registration.navigationPreload) {
		await self.registration.navigationPreload.enable()
	}

	await init()
	await self.clients.claim()
})())})
self.addEventListener("message", com)