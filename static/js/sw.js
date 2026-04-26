/// <reference lib="webworker" />

// TODO: Stuff in the front end for sw errors

const alwaysFetchList = [ "/api/appHashes" ]
const hostname = self.location.hostname
const verbose = false
let offline = false

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
			// this.prefetchSubOrigin()
		}

		cache.put("hash", new Response(null, { headers: { "hash": this.#hash }}))
	}
	async prefetchSubOrigin() {
		if (offline) { return }
		else if (this.#appName === "webdesk") { return }

		log(`${this.#appName} caching /`)
		await this.#cache.put("/", await fetch(`${self.location.protocol}//${this.#appName}.${hostname}/`))
		log(`${this.#appName} caching /icon`)
		await this.#cache.put("/icon", await fetch(`${self.location.protocol}//${this.#appName}.${hostname}/icon`))
		log(`${this.#appName} caching /style`)
		await this.#cache.put("/style", await fetch(`${self.location.protocol}//${this.#appName}.${hostname}/style`))
		log(`${this.#appName} caching /js`)
		await this.#cache.put("/js", await fetch(`${self.location.protocol}//${this.#appName}.${hostname}/js`))
	}
	async respond(request, pathname) {
		await this.#ready
		log(`${this.#appName} cache looking up ${pathname}`)
		const cacheLookup = await this.#cache.match(request)

		if (cacheLookup && !alwaysFetchList.includes(pathname)) {
			log(`${this.#appName} cache hit for ${pathname}`)
			return cacheLookup
		} else { log(`${this.#appName} cache miss for ${pathname}`) }

		const serverFetch = await fetch(request, { mode: "cors" })
		await this.#cache.put(request, serverFetch.clone())
		log(`${this.#appName} ${pathname} is now in cache`)
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
	try {
		const response = await fetch("/api/appHashes")
		const hashes = await response.json()

		for (const appName of Object.keys(hashes)) { new Cashier(appName, hashes[appName]) }
	} catch(error) {
		const clients = await self.clients.matchAll()
		for (const offlineClient of clients) {
			offlineClient.postMessage("offline")
		}
		offline = true
	}
}

/** @param {FetchEvent} event */
async function interceptor(event) {
	const requestURL = new URL(event.request.url)
	const origin = requestURL.hostname.toLocaleLowerCase()
	const subOrigin = origin.substring(0, origin.indexOf(hostname) - 1).toLocaleLowerCase()
	
	const cashierName = subOrigin === "" ? "webdesk" : subOrigin
	const cashier = Cashier.cashiers[cashierName]

	if (cashier) { return cashier.respond(event.request, requestURL.pathname) }
	else if (!offline) { return await fetch(event.request) }
	else { return new Response("System offline and app not cached", { status: 503 }) }
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
	await init()
	await self.clients.claim()
})())})
self.addEventListener("message", com)