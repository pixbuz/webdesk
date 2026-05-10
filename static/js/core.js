// NOTE: Generator functions tho?
// NOTE: Observers tho?
// NOTE: "event" variable ???
// NOTE: One iframe with both content and titlebar?

// TODO: Come up with a more materials and you theme system
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
const offlineMessageElement = document.querySelector("#offline")
const customStyleSheet = new CSSStyleSheet()

export const openWindows = new Map()
export const WebdeskEvent = {}
export const WebdeskRequest = {}
export const ApplicationManifests = {}

let activeCustomName = localStorage.getItem("activeCustomization")
let activeBackgroundName = localStorage.getItem("activeBackground")
export let activeCustomData
export let activeBackgroundData

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
	static #responders = { }
	#name

	static #registerResponder(requestName, responder) {
		if (WebdeskInternalRequest.#responders[requestName]) console.log(`Overwritten ${requestName} with ${responder.name}`)
		WebdeskInternalRequest.#responders[requestName] = responder
	}

	async #emit(data) {
		const responder = WebdeskInternalRequest.#responders[this.#name]
		if (!responder || !(responder instanceof Function)) return
		
		return await responder(data)
	}

	constructor(name) {
		const result = this.#emit.bind(this)
		result.register = (responder) => WebdeskInternalRequest.#registerResponder(name, responder)
		this.#name = name
		WebdeskRequest[name] = result
	}
}

new WebdeskInternalRequest("CUSTOMIZATION_GET")
new WebdeskInternalRequest("CUSTOMIZATION_SET")
new WebdeskInternalRequest("CUSTOMIZATION_SAVE")
new WebdeskInternalRequest("CUSTOMIZATION_EXPORT")
new WebdeskInternalRequest("CUSTOMIZATION_REMOVE")
new WebdeskInternalRequest("CUSTOMIZATION_REINIT")

new WebdeskInternalRequest("BACKGROUND_GET")
new WebdeskInternalRequest("BACKGROUND_SET")
new WebdeskInternalRequest("BACKGROUND_SAVE")
new WebdeskInternalRequest("BACKGROUND_EXPORT")
new WebdeskInternalRequest("BACKGROUND_REMOVE")
new WebdeskInternalRequest("BACKGROUND_REINIT")


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

new WebdeskEventTemplate("CUSTOMIZATION_LOADED")

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
			.catch(error => console.log("Service Worker registration failed"))
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
	async #loadCustom(name, { css, palette }) {
		const paletteRules = []
		for (const [ color, value ] of Object.entries(palette)) paletteRules.push(`--${color}: ${value};`)
		const fullCSS = `:root { ${paletteRules.join("\n")} }\n${css}`
		customStyleSheet.replace(fullCSS)
		
		activeCustomName = name
		localStorage.setItem("activeCustomization", name)
		activeCustomData = { css, palette }
		WebdeskEvent.CUSTOMIZATION_LOADED.emit(activeCustomData)
	}

	async init() {
		const response = await fetch("/style")
		if (response.ok) {
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
			WebdeskDB.set("_customs", "Default Light", { css: (await css), palette: lightPalette })
			WebdeskDB.set("_customs", "Default Dark", { css: (await css), palette: darkPalette })
			CustomizationManager.#loadCustom("Default Dark", { css: (await css), palette: darkPalette })
			return true
		} else { /* Error stuff */ }
	}
	async getCustoms() {
		const savedCustoms = await WebdeskDB.getAll("_customs", true)
		return { active: activeCustomName, ...savedCustoms }
	}
	async uploadCustom({ name, custom }) {
		console.log(name, custom)
		const customizations = await WebdeskDB.getAll("_customs", true)
		const savedCustomsNames = Object.keys(customizations)
		
		if (savedCustomsNames.includes(name)) return false
		
		WebdeskDB.set("_customs", name, custom)
		return true
	}
	async loadRequest(customName) {
		const data = await WebdeskDB.get("_customs", customName)
		if (!data) return

		CustomizationManager.#loadCustom(customName, data)
	}
	async removeCustom(_data) {
		const customizations = await WebdeskDB.getAll("_customs", true)
		const nextCustom = Object.keys(customizations).filter(customName => customName != activeCustomName).sort().at(0)
		const removeCustom = activeCustomName

		if (!nextCustom) return false

		CustomizationManager.#loadCustom(nextCustom, customizations[nextCustom])
		WebdeskDB.delete("_customs", removeCustom)
		return true
	}
	exportCustom(_data) {
		return { [activeCustomName]: activeCustomData }
	}

	constructor () {
		WebdeskRequest.CUSTOMIZATION_GET.register(this.getCustoms)
		WebdeskRequest.CUSTOMIZATION_SET.register(this.loadRequest)
		WebdeskRequest.CUSTOMIZATION_SAVE.register(this.uploadCustom)
		WebdeskRequest.CUSTOMIZATION_EXPORT.register(this.exportCustom)
		WebdeskRequest.CUSTOMIZATION_REMOVE.register(this.removeCustom)
		WebdeskRequest.CUSTOMIZATION_REINIT.register(this.init)
	}
}
const BackgroundManager = new class {
	#backgroundWrapper = document.querySelector("body > .Background")
	
	#loadBackground(backgroundName, data) {
		localStorage.setItem("activeBackground", activeBackgroundName = backgroundName)
		this.#backgroundWrapper.innerHTML = activeBackgroundData = data
	}

	async init() {
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
				<rect width="100%" height="100%" fill="#000" />
				<rect width="100%" height="100%" filter="url(#grainy-texture)" />
			</svg>`
		await WebdeskDB.createTable("_backgrounds")
		WebdeskDB.set("_backgrounds", "Default Light", lightSVG)
		WebdeskDB.set("_backgrounds", "Default Dark", darkSVG)
		BackgroundManager.#loadBackground("Default Dark", darkSVG)
		return true
	}
	async getBackgrounds() {
		const savedBackgrounds = await WebdeskDB.getAll("_backgrounds", true)
		return { active: activeBackgroundName, ...savedBackgrounds }
	}
	async uploadBackground({ name, background }) {
		const backgrounds = await WebdeskDB.getAll("_backgrounds", true)
		const savedBackgroundsNames = Object.keys(backgrounds)
		
		if (savedBackgroundsNames.includes(name)) return false
		
		WebdeskDB.set("_backgrounds", name, background)
		return true
	}
	async loadRequest(backgroundName) {
		const data = await WebdeskDB.get("_backgrounds", backgroundName)
		if (!data) return false

		BackgroundManager.#loadBackground(backgroundName, data)
		return true
	}
	async removeBackground(_data) {
		const backgrounds = await WebdeskDB.getAll("_backgrounds", true)
		const nextBackground = Object.keys(backgrounds).filter(customName => customName != activeBackgroundName).sort().at(0)
		const removeBackground = activeBackgroundName

		if (!nextBackground) return false

		BackgroundManager.#loadBackground(nextBackground, backgrounds[nextBackground])
		WebdeskDB.delete("_backgrounds", removeBackground)
		return true
	}
	exportBackground(_data) {
		return { [activeBackgroundName]: activeBackgroundData }
	}

	constructor () {
		WebdeskRequest.BACKGROUND_GET.register(this.getBackgrounds)
		WebdeskRequest.BACKGROUND_SET.register(this.loadRequest)
		WebdeskRequest.BACKGROUND_SAVE.register(this.uploadBackground)
		WebdeskRequest.BACKGROUND_EXPORT.register(this.exportBackground)
		WebdeskRequest.BACKGROUND_REMOVE.register(this.removeBackground)
		WebdeskRequest.BACKGROUND_REINIT.register(this.init)
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

	if (newUser) setTimeout(() => WebdeskEvent.LAUNCHER_CLICK.emit({ app: "welcome", manifest: ApplicationManifests["welcome"] }), 500)
}).catch(error => console.log(error))

document.adoptedStyleSheets.push(customStyleSheet)

window.addEventListener("message", MessagingHub.reciver)

if (activeCustomName) CustomizationManager.loadRequest(activeCustomName)
else CustomizationManager.init()

if (activeBackgroundName) BackgroundManager.loadRequest(activeBackgroundName)
else BackgroundManager.init()