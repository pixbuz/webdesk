// NOTE: Generator functions tho?
// NOTE: Observers tho?
// NOTE: "event" variable ???

// TODO: Error handling for database things
// TODO: Make iframe message types
// TODO: Inject a styling hook into apps
// TODO: Webdesk events and webdesk (internal) requests

/** @typedef {Object} EmptyData */
/** @typedef {Object} ClockData
 * @property {string[]} update */
/** @typedef {Object} LauncherData
 * @property {Object} manifest
 * @property {string} app */
/** @typedef {Object} TargetData
 * @property {HTMLElement} target */
/** @typedef {Object} ReadyData
 * @property {object} message
 * @property {any} data */
/** @typedef {Object} FocusData
 * @property {HTMLElement} lost
 * @property {HTMLElement} gain */
/** @typedef {Object} CloseData
 * @property {HTMLElement} closed
 * @property {HTMLElement[]} open */
/** @typedef {Object} ChangeData
 * @property {string} css
 * @property {string} value */
/** @typedef {Object} OpenData
 * @property {HTMLElement} element
 * @property {Symbol} id */
/** @typedef {Object} BackgroundData
 * @property {number} id
 * @property {boolean} force
 * @property {string} background */
/** @typedef {Object} InteractionData
 * @property {HTMLElement} target
 * @property {number} x
 * @property {number} y */
/** @typedef {Object} CustomizationData
 * @property {number} id
 * @property {string} css
 * @property {Object} object
 * @property {boolean} force */

const newUser = localStorage.getItem("user") ? false : true
const activeCustomName = localStorage.getItem("activeCustomization")
const activeBackgroundName = localStorage.getItem("activeBackground")
const offlineMessageElement = document.querySelector("#offline")
const backgroundWrapper = document.querySelector("body > .Background")
const customStyleSheet = new CSSStyleSheet()

export const openWindows = new Map()
export const WebdeskEvent = {}
export const WebdeskRequest = {}
export const ApplicationManifests = {}

export let activeCustomObject

class WebdeskEventTemplate {
	/** @type {((data: T) => void)[]} */
	#callbacks = [ ]
	#name = ""

	/** @param {Partial<T>} data */
	emit(data = {}) { this.#callbacks.forEach(callback => callback(data)) }

	/** @param {...((data: T) => void)} newCallbacks */
	on(...newCallbacks) { this.#callbacks.push(...newCallbacks) }

	/** @param {...((data: T) => void)} callback */
	off(callback) { this.#callbacks = this.#callbacks.filter(registredCallback => registredCallback !== callback) }

	constructor(name) { WebdeskEvent[this.#name = name] = this }
}

class WebdeskInternalRequest {
	#name

	static #requestsHandler(name, data) {
		switch (name) {
			case "CUSTOMIZATION_GET": { return WebdeskDB.getAll("_customs", true) }
		}
	}

	#emit(data) {
		return WebdeskInternalRequest.#requestsHandler(this.#name, data)
	}

	constructor(name) {
		const result = this.#emit.bind(this)
		this.#name = name
		return WebdeskRequest[name] = result
	}
}

new WebdeskInternalRequest("CUSTOMIZATION_GET")
new WebdeskInternalRequest("CUSTOMIZATION_SET")
new WebdeskInternalRequest("CUSTOMIZATION_SAVE")

new WebdeskInternalRequest("BACKGROUND_GET")
new WebdeskInternalRequest("BACKGROUND_SET")
new WebdeskInternalRequest("BACKGROUND_SAVE")

new WebdeskInternalRequest("TITLEBAR_CHANNEL")
new WebdeskInternalRequest("CONTENT_CHANNEL")


new WebdeskEventTemplate("MANIFESTS_READY")
new WebdeskEventTemplate("LAUNCHER_CLICK")

new WebdeskEventTemplate("WINDOW_MOVE_START")
new WebdeskEventTemplate("WINDOW_MOVE")
new WebdeskEventTemplate("WINDOW_MOVE_END")

new WebdeskEventTemplate("WINDOW_RESIZE_START")
new WebdeskEventTemplate("WINDOW_RESIZE")
new WebdeskEventTemplate("WINDOW_RESIZE_END")

new WebdeskEventTemplate("WINDOW_UPDATED_FOCUS")
new WebdeskEventTemplate("WINDOW_OPEN")
new WebdeskEventTemplate("WINDOW_CLOSE")

new WebdeskEventTemplate("WINDOW_MAXIMISE")
new WebdeskEventTemplate("WINDOW_MAXIMISE_END")

new WebdeskEventTemplate("WINDOW_MINIMISE")
new WebdeskEventTemplate("WINDOW_MINIMISE_END")

new WebdeskEventTemplate("TITLEBAR_MESSAGE")
new WebdeskEventTemplate("CONTENT_MESSAGE")
new WebdeskEventTemplate("MESSAGE")

new WebdeskEventTemplate("DOCK_HOVER")
new WebdeskEventTemplate("DOCK_HOVER_END")

new WebdeskEventTemplate("ICON_CLICK")

new WebdeskEventTemplate("CLOCK_UPDATE")

new WebdeskEventTemplate("CUSTOMIZATION_LOAD_REQUEST")
new WebdeskEventTemplate("CUSTOMIZATION_LOADED")
new WebdeskEventTemplate("CUSTOMIZATION_SAVE_REQUEST")

new WebdeskEventTemplate("BACKGROUND_LOAD_REQUEST")
new WebdeskEventTemplate("BACKGROUND_LOADED")
new WebdeskEventTemplate("BACKGROUND_SAVE_REQUEST")

function filterHTMLElements(leaf) {
	if (!leaf) { return }
	const serialized = { }
	for (const [ key, value ] of Object.entries(leaf)) {
		if (Array.isArray(value)) { serialized[key] = value.map((element) => { if (element instanceof HTMLElement) { return "HTMLElement" } else { return element } })}
		else if (Object.prototype.toString.call(value) === "[object Object]") { serialized[key] = filterHTMLElements(serialized[key]) }
		else if (value instanceof HTMLElement) { serialized[key] = "HTMLElement" }
		else { serialized[key] = value }
	}
	return serialized
}

function loadBackground(background) {
	backgroundWrapper.innerHTML = background
}

const SWManager = new class {
	loadInformation() {
		navigator.storage.estimate().then(({ usage, quota }) => {
			const usedMB = (usage / 1024 ** 2).toFixed(2)
			const totalMB = (quota / 1024 ** 2).toFixed(2)
			const percentUsed = ((usage / quota) * 100).toFixed(2)

			console.log(`Using ${usedMB} MB out of ${totalMB} MB (${percentUsed}%)`)
		})
	}

	com(event) {
		if (event.data === "offline") { offlineMessageElement.classList.add("visible") }
	}

	constructor() {
		navigator.serviceWorker.addEventListener("message", this.com)
		navigator.serviceWorker.register("/sw")
			.then(registration => registration.active.postMessage("checkHashes"))
			.catch(error => console.error(error))
	}
}
const inits = new class {
	async background() {
		localStorage.setItem("activeBackground", "Default-Dark")
		const lightSVG = `
			<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
				<filter id="cool">
					<feTurbulence baseFrequency="0.01" numOctaves="1" result="noise"/>
					<feDiffuseLighting in="noise" lighting-color="#FFF" surfaceScale="2">
						<feDistantLight azimuth="45" elevation="30" />
					</feDiffuseLighting>
				</filter>
				<rect width="100%" height="100%" filter="url(#cool)" />
			</svg>`
		const darkSVG = `
			<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
				<filter id="grainy-texture" x="0" y="0" width="100%" height="100%">
					<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" result="rawNoise" />

					<feColorMatrix in="rawNoise" type="matrix"
						values="0.007 0.007 0.007 0 0
							0.007 0.007 0.007 0 0
							0.007 0.007 0.007 0 0
							0 0 0 1 0" result="neutralBase" />

					<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" stitchTiles="stitch" result="highlightNoise" />
					<feDisplacementMap in="highlightNoise" in2="rawNoise" scale="10" xChannelSelector="R" yChannelSelector="G" result="distortedHighlights" />
					<feColorMatrix in="distortedHighlights" type="matrix"
						values="10 -5 -5 0 0
							-5 10 -5 0 0
							-5 -5 10 0 0
							0 0 0 1 0" result="vibrantHighlights" />

					<feColorMatrix in="vibrantHighlights" type="matrix"
						values="1 0 0 0 0
							0 1 0 0 0
							0 0 1 0 0
							1 1 1 50 -42" result="finalGlints" />

					<feMerge>
						<feMergeNode in="neutralBase" />
						<feMergeNode in="finalGlints" />
					</feMerge>
				</filter>
				<rect width="100%" height="100%" filter="url(#grainy-texture)" />
			</svg>`
		await WebdeskDB.createTable("_backgrounds")
		WebdeskDB.set("_backgrounds", "Default-Light", lightSVG)
		WebdeskDB.set("_backgrounds", "Default-Dark", darkSVG)
		loadBackground(darkSVG)
	}
	async total() {
		localStorage.setItem("user", true)
		inits.background()
	}
}
const WebdeskDB = new class {
	version = 1
	// Helper for the main functions for interacting with the database
	async #run(tableName, mode, callback) {
		// Get the newest connection for the Database
		const database = await WebdeskDB.ready
		// Return undefined if trying to access a table that doesn't exist
		if (!database.objectStoreNames.contains(tableName)) { return undefined }

		return new Promise((resolve, reject) => {
			try {
				const tx = database.transaction(tableName, mode == 0 ? "readonly" : "readwrite")
				const store = tx.objectStore(tableName)
				const request = callback(store)

				request.onsuccess = () => resolve(request.result)
				request.onerror = () => reject(request.error)
			} catch (err) { reject(err) }
		})
	}
	async getAll(table, asObject = false) {
		if (!asObject) return this.#run(table, 0, (store) => store.getAll())

		// If asObject is true, we need to fetch both keys and values
		const database = await WebdeskDB.ready

		return new Promise((resolve, reject) => {
			const tx = database.transaction(table, "readonly")
			const store = tx.objectStore(table)

			const keysReq = store.getAllKeys()
			const valsReq = store.getAll()

			tx.oncomplete = () => {
				const keys = keysReq.result
				const vals = valsReq.result

				// "Zip" the two arrays into one object
				const result = {}
				keys.forEach((key, index) => result[key] = vals[index])

				resolve(result)
			}

			tx.onerror = reject
		})
	}
	get(table, key) { return WebdeskDB.#run(table, 0, (store) => store.get(key)) }
	set(table, key, value) { return WebdeskDB.#run(table, 1, (store) => store.put(value, key)) }
	delete(table, key) { return WebdeskDB.#run(table, 1, (store) => store.delete(key)) }
	// Adds new tables into the database
	async createTable(tableName) {
		const database = await WebdeskDB.ready
		// If table exists do nothing
		if (database.objectStoreNames.contains(tableName)) { return }

		database.close()
		console.log(`Closing Database to create table "${tableName}"`)

		return new Promise((resolve, reject) => {
			// Up the Database version
			const req = indexedDB.open("webdesk", ++WebdeskDB.version)

			// Before the Database Opens, add the new table
			req.onupgradeneeded = (event) => {
				const db = event.target.result
				if (!db.objectStoreNames.contains(tableName)) { db.createObjectStore(tableName) }
			}
			// When the Database Opens, resolve the ready promise
			req.onsuccess = (event) => {
				const db = event.target.result
				db.onversionchange = () => { db.close() }

				localStorage.setItem("db-version", WebdeskDB.version)

				// Update the global ready reference instantly without queueing
				WebdeskDB.ready = Promise.resolve(db)
				resolve()
			}

			req.onblocked = req.onerror = (event) => reject(event)
		})
	}
	constructor() {
		const dbVersion = localStorage.getItem("db-version")
		if (dbVersion == undefined) { localStorage.setItem("db-version", 1) }
		else { this.version = parseInt(dbVersion) }

		this.ready = new Promise((resolve, reject) => {
			const req = indexedDB.open("webdesk", this.version)
			req.onsuccess = () => {
				req.result.onversionchange = () => { req.result.close() }
				resolve(req.result)
			}
			// On error, report it
			req.onblocked = req.onerror = (event) => reject(event)
		})

		this.updateLock = Promise.resolve()
	}
}
const CustomizationManager = new class {
	async #loadCustom({ css, palette }) {
		const paletteRules = []
		for (const [ color, value ] of Object.entries(palette)) paletteRules.push(`--${color}: ${value};`)
		const fullCSS = `:root { ${paletteRules.join("\n")} }\n${css}`
		customStyleSheet.replace(fullCSS)
		
		activeCustomObject = { css, palette }
		WebdeskEvent.CUSTOMIZATION_LOADED.emit(activeCustomObject)
	}

	async init() {
		const response = await fetch("/style")
		if (response.ok) {
			localStorage.setItem("activeCustomization", "Default-Dark")
			const css = response.text()
			const lightPalette = {
				"accent": "rgb(64, 96, 248)",
				"success": "rgb(64, 248, 96)",
				"error": "rgb(248, 96, 64)",
				"canvas": "rgb(248, 248, 255)",
				"content": "rgb(26, 26, 46)",
				"contrast": "-1",
			}
			const darkPalette = {
				"accent": "rgb(64, 96, 248)",
				"success": "rgb(64, 248, 96)",
				"error": "rgb(248, 96, 64)",
				"canvas": "rgb(14, 14, 18)",
				"content": "rgb(248, 248, 255)",
				"contrast": "+1",
			}
			await WebdeskDB.createTable("_customs")
			WebdeskDB.set("_customs", "Default-Light", { css: (await css), palette: lightPalette })
			WebdeskDB.set("_customs", "Default-Dark", { css: (await css), palette: darkPalette })
			this.#loadCustom({ css: (await css), palette: darkPalette })
		} else { /* Error stuff */ }
	}
	async uploadCss({ name, custom }) {
		const customizations = await WebdeskDB.getAll("_customs", true)
		const savedCustomsNames = Object.keys(customizations)
		
		if (savedCustomsNames.includes(name)) return
		
		WebdeskDB.set("_customs", name, custom)
	}
	async loadRequest(customName) {
		const data = await WebdeskDB.get("_customs", customName)
		if (!data) return

		localStorage.setItem("activeCustomization", customName)
		CustomizationManager.#loadCustom(data)
	}

	constructor () {
		WebdeskEvent.CUSTOMIZATION_SAVE_REQUEST.on(this.uploadCss)
		WebdeskEvent.CUSTOMIZATION_LOAD_REQUEST.on(this.loadRequest)
	}
}
export const Time = new class {
	init() {
		setTimeout(() => {
			this.progress()
			setInterval(this.progress, 1000)
		}, 1000 - this.mills)
		setInterval(this.sync, 5 * 60 * 1000)
	}

	sync() {
		const now = new Date()
		this.mills = now.getMilliseconds()
		this.seconds = now.getSeconds()
		this.minutes = now.getMinutes()
		this.hours = now.getHours()
		this.day = now.getDate()
		this.month = now.getMonth() + 1
		this.year = now.getFullYear()
	}

	progress() {
		const update = [ "seconds" ]
		Time.seconds++

		if (Time.seconds >= 60) {
			Time.seconds = 0
			Time.minutes++

			update.push("minutes")
		}

		if (Time.minutes >= 60) {
			Time.minutes = 0
			Time.hours++

			update.push("hours")
		}

		if (Time.hours >= 24) {
			Time.hours = 0
			Time.day++

			update.push("day")
		}

		WebdeskEvent.CLOCK_UPDATE.emit({ update })
	}

	constructor() {
		this.sync()
		this.init()
	}
}
export const MessagingHub = new class {
	getChannels(appWindow) {
		const titlebar = appWindow.querySelector(".titlebar").contentWindow
		const content = appWindow.querySelector(".titlebar").contentWindow
		return { titlebar, content }
	}

	/** @param {MessageEvent} data */
	reciver({ origin, source, data }) {
		const iframe = Array.from(document.querySelectorAll("iframe")).find(iframe => iframe.contentWindow === event.source)
		
		if (!iframe) WebdeskEvent.MESSAGE.emit(data)

		const appWindow = iframe.closest("[window]")
		if (iframe.classList.contains("titlebar")) WebdeskEvent.TITLEBAR_MESSAGE.emit({ data, appWindow })
		else if (iframe.classList.contains("content")) WebdeskEvent.CONTENT_MESSAGE.emit({ data, appWindow })
	}

	constructor() { }
}

fetch("/api/getManifests").then(async (response) => {
	Object.assign(ApplicationManifests, await response.json())
	WebdeskEvent.MANIFESTS_READY.emit(ApplicationManifests)

	if (newUser) WebdeskEvent.LAUNCHER_CLICK.emit({ app: "welcome", manifest: ApplicationManifests["welcome"] })
}).catch(error => console.log(error))

document.adoptedStyleSheets.push(customStyleSheet)

window.addEventListener("message", MessagingHub.reciver)

if (newUser) inits.total()

if (activeCustomName) CustomizationManager.loadRequest(activeCustomName)
else CustomizationManager.init()

if (activeBackgroundName) WebdeskDB.get("_backgrounds", activeBackgroundName).then(loadBackground)
else inits.background()