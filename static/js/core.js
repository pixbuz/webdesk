// NOTE: Generator functions tho?
// NOTE: Observers tho?

// TODO: Settings titlebar
// TODO: Error handling for database things
// TODO: Deprecate ApplicationManifests?
// TODO: Windows having a symbol as identifier

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
/** @typedef {Object} OpeningData
 * @property {HTMLElement} titlebar
 * @property {HTMLElement} window
 * @property {any} app */
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
const offlineMessageElement = document.querySelector("#offline")
const customStyleSheet = new CSSStyleSheet()

function removeHTMLElements(leaf) {
	if (!leaf) { return }
	const serialized = { }
	for (const [ key, value ] of Object.entries(leaf)) {
		if (Array.isArray(value)) { serialized[key] = value.map((element) => { if (element instanceof HTMLElement) { return "HTMLElement" } else { return element } })}
		else if (Object.prototype.toString.call(value) === "[object Object]") { serialized[key] = removeHTMLElements(serialized[key]) }
		else if (value instanceof HTMLElement) { serialized[key] = "HTMLElement" }
		else { serialized[key] = value }
	}
	return serialized
}
function loadCSS(css, blocking = false) {
	if (blocking) await customStyleSheet.replace(css)
	else customStyleSheet.replace(css)
	WebdeskEvent.CUSTOMIZATION_LOADED.emit({ css })
}

class WebdeskEventTemplate {
	/** @type {((data: T) => void)[]} */
	#callbacks = [ ]
	#name = ""

	/** @param {Partial<T>} data */
	emit(data = {}) {
		WebdeskEvent.emitToIframes(this, data)
		this.#callbacks.forEach((callback) => { callback(data) })
		MessagingHub.propagateEvent(this.#name, data)
	}

	/** @param {...((data: T) => void)} newCallbacks */
	on(...newCallbacks) { this.#callbacks.push(...newCallbacks) }

	/** @param {...((data: T) => void)} callback */
	off(callback) { this.#callbacks = this.#callbacks.filter((registredCallback) => { registredCallback !== callback }) }

	constructor(name) { WebdeskEvent[this.name = name] = this }
}

new WebdeskEventTemplate("MANIFESTS_READY")
new WebdeskEventTemplate("LAUNCHER_CLICK")
new WebdeskEventTemplate("TITLEBAR_READY")
new WebdeskEventTemplate("CONTENT_READY")
new WebdeskEventTemplate("WINDOW_MOVE_START")
new WebdeskEventTemplate("WINDOW_MOVE")
new WebdeskEventTemplate("WINDOW_MOVE_END")
new WebdeskEventTemplate("WINDOW_RESIZE_START")
new WebdeskEventTemplate("WINDOW_RESIZE")
new WebdeskEventTemplate("WINDOW_RESIZE_END")
new WebdeskEventTemplate("WINDOW_UPDATED_FOCUS")
new WebdeskEventTemplate("WINDOW_OPENING")
new WebdeskEventTemplate("WINDOW_OPEN")
new WebdeskEventTemplate("WINDOW_CLOSING")
new WebdeskEventTemplate("WINDOW_CLOSE")
new WebdeskEventTemplate("WINDOW_MAXIMISE")
new WebdeskEventTemplate("WINDOW_MAXIMISE_END")
new WebdeskEventTemplate("WINDOW_MINIMISE")
new WebdeskEventTemplate("WINDOW_MINIMISE_END")
new WebdeskEventTemplate("DOCK_HOVER")
new WebdeskEventTemplate("DOCK_HOVER_END")
new WebdeskEventTemplate("ICON_CLICK")
new WebdeskEventTemplate("CLOCK_UPDATE")
new WebdeskEventTemplate("CUSTOMIZATION_LOAD_REQUEST")
new WebdeskEventTemplate("CUSTOMIZATION_LOADED")
new WebdeskEventTemplate("CUSTOMIZATION_PREVIEW")
new WebdeskEventTemplate("CUSTOMIZATION_PREVIEW_SAVE_REQUEST")
new WebdeskEventTemplate("CUSTOMIZATION_PREVIEW_SAVED")
new WebdeskEventTemplate("BACKGROUND_LOAD_REQUEST")
new WebdeskEventTemplate("BACKGROUND_LOADED")
new WebdeskEventTemplate("BACKGROUND_REMOVE_ALL") // ???
new WebdeskEventTemplate("BACKGROUND_UPLOAD_REQUEST")
new WebdeskEventTemplate("BACKGROUND_UPLOADED")

export let ApplicationManifests
export const WebdeskEvent
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
	async UI() {
		localStorage.setItem("activeCustomization", "Default")
		const response = await fetch("/style")
		if (response.ok) {
			const css = await response.text()
			await WebdeskDB.set("_customs", "Default", css)
			await customStyleSheet.replace(css)
		} else { /* Error stuff */ }
	}
	async total() {
		localStorage.setItem("user", true)
		await WebdeskDB.createTable("_customs")
		await WebdeskDB.createTable("_backgrounds")
		inits.UI()
	}
}
export const WebdeskDB = new class {
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
	get(table, key) { return WebdeskDB.#run(table, 0, (store) => store.get(key)) }
	getAll(table) { return WebdeskDB.#run(table, 0, (store) => store.getAll()) }
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
export const Time = new class {
	init = new Date()
	seconds = this.init.getSeconds()
	minutes = this.init.getMinutes()
	hours = this.init.getHours()
	day = this.init.getDate()
	month = this.init.getMonth() + 1
	year = this.init.getFullYear()

	progress() {
		const changed = [ "seconds" ]
		Time.seconds++

		if (Time.seconds >= 60) {
			Time.seconds = 0
			Time.minutes++

			changed.push("minutes")
		}

		if (Time.minutes >= 60) {
			Time.minutes = 0
			Time.hours++

			changed.push("hours")
		}

		if (Time.hours >= 24) {
			Time.hours = 0
			Time.day++

			changed.push("day")
		}

		WebdeskEvent.CLOCK_UPDATE.emit({ update: changed })
	}

	constructor() {
		setTimeout(() => {
			Time.progress()
			setInterval(Time.progress, 1000)
		}, 1000 - this.init.getMilliseconds())
	}
}
export const MessagingHub = new class {
	/** @type {Map<HTMLElement, object>} */
	windowToChannels = new Map()

	async #commandResponder({ data: { command, data } }, { content: contentChannel, titlebar: titlebarChannel }) {
		switch(command) {
			case "emit.event": {
				WebdeskEvent[data.type].emit(data.payload)

				return contentChannel.port1.postMessage({ command, payload: { } })
			}
			case "get.localstorage": {
				const { key } = data
				const value = localStorage.getItem(key)

				return contentChannel.port1.postMessage({ command, payload: { value } })
			}
			case "get.db": {
				const { table, key } = data
				const value = await WebdeskDB.get(table, key)

				return contentChannel.port1.postMessage({ command, payload: { value } })
			}
			case "getAll.db": {
				const { table } = data
				const value = await WebdeskDB.getAll(table)

				return contentChannel.port1.postMessage({ command, payload: { value } })
			}
			case "get.style": {
				const { target } = data
				let style = null

				switch(target) {
					case "launchers": { style = StyleSheets.launchers.cssRules[0].cssText; break }
					case "windows": { style = StyleSheets.windows.cssRules[0].cssText; break }
					case "dock": { style = StyleSheets.dock.cssRules[0].cssText; break }
					case "all": { style = { launchers: StyleSheets.launchers.cssRules[0].cssText, windows: StyleSheets.windows.cssRules[0].cssText, dock: StyleSheets.dock.cssRules[0].cssText }; break }
				}

				return contentChannel.port1.postMessage({ command, payload: { style } })
			}
			default: { return contentChannel.port1.postMessage({ command, payload: { } }) }
		}
	}
	/** @param {CloseData} closeData */
	#removeLink({ closed }) { MessagingHub.windowToChannels.delete(closed) }

	generatePorts(identifier) {
		const titlebarChannel = new MessageChannel(),
		contentChannel = new MessageChannel(),
		privateChannel = new MessageChannel()

		const newLink = { content: contentChannel, titlebar: titlebarChannel, private: privateChannel }
		MessagingHub.windowToChannels.set(identifier, newLink)

		newLink.content.port1.addEventListener("message", (event) => { MessagingHub.#commandResponder(event, newLink) })

		newLink.titlebar.port1.start()
		newLink.content.port1.start()
	}
	sendContentPorts(identifier, iframe, message = "ports") {
		const link = MessagingHub.windowToChannels.get(identifier),
		{ port2: contentPort } = link.content,
		{ port1: privatePort } = link.private

		iframe.contentWindow.postMessage(message, "*", [ contentPort, privatePort ])
		return link.content.port1
	}
	sendTitlebarPorts(identifier, iframe, message = "ports") {
		const link = MessagingHub.windowToChannels.get(identifier),
		{ port2: titlebarPort } = link.titlebar,
		{ port2: privatePort } = link.private

		iframe.contentWindow.postMessage(message, "*", [ titlebarPort, privatePort ])
		return link.titlebar.port1
	}
	propagateEvent(name, data) {
		const sendData = removeHTMLElements(data)
		MessagingHub.windowToChannels.forEach((link) => {
			link.content.port1.postMessage({ command: "event", payload: { event: name, data: sendData }})
			link.titlebar.port1.postMessage({ command: "event", payload: { event: name, data: sendData }})
		})
	}

	constructor() {
		WebdeskEvent.WINDOW_CLOSE.on(this.#removeLink)
	}
}

fetch("/api/getManifests").then(async (response) => {
	ApplicationManifests = await response.json()
	WebdeskEvent.MANIFESTS_READY.emit(ApplicationManifests)

	if (newUser) setTimeout(() => WebdeskEvent.LAUNCHER_CLICK.emit({ app: "intro" }), 1000)
}).catch((error) => { console.log(error) })

document.adoptedStyleSheets.push(customStyleSheet)

if (newUser) inits.total()

// if (activeCustomName) WebdeskDB.get("_customs", activeCustomName).then((css) => customStyleSheet.replace(css))
// else inits.UI()

inits.UI()