// NOTE: Generator functions tho?
// NOTE: Observers tho?

// TODO: Settings titlebar
// TODO: Error handling for database things
// TODO: Deprecate ApplicationManifests?

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
function loadCSS(css) {
	for (const [ selector, rules ] of Object.entries(css)) {
		console.log(`${selector} { ${rules} }`)
		customStyleSheet.insertRule(`${selector} { ${rules} }`)
	}
	WebdeskEvent.CUSTOMIZATION_LOADED.emit({ css })
}
function cssToJson(cssString) {
	const cssStyleSheet = {}
	const pureCss = cssString
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/[\n\r\t]/g, " ") 
		.replace(/\s+/g, " ")
		.trim()

	let i = 0
	while (i < pureCss.length) {
		let openBrace = pureCss.indexOf('{', i)
		if (openBrace === -1) break

		const selector = pureCss.substring(i, openBrace).trim()

		let depth = 0
		let closeBrace = -1

		for (let j = openBrace; j < pureCss.length; j++) {
			if (pureCss[j] === '{') depth++
			if (pureCss[j] === '}') depth--

			if (depth === 0) {
				closeBrace = j
				break
			}
		}

		if (closeBrace !== -1) {
			const rules = pureCss.substring(openBrace + 1, closeBrace).trim()
			cssStyleSheet[selector] = rules
			
			i = closeBrace + 1
		} else break
	}

	return cssStyleSheet
}

/** @template T */
class WebdeskEventBase {
	/** @type {((data: T) => void)[]} */
	#callbacks = [ ]

	/** @param {Partial<T>} data */
	emit(data = {}) {
		WebdeskEvent.emitToIframes(this, data)
		this.#callbacks.forEach((callback) => { callback(data) })
	}

	/** @param {...((data: T) => void)} newCallbacks */
	on(...newCallbacks) { this.#callbacks.push(...newCallbacks) }

	/** @param {...((data: T) => void)} callback */
	off(callback) { this.#callbacks = this.#callbacks.filter((registredCallback) => { registredCallback !== callback }) }

	constructor() { }
}

/** @extends {WebdeskEventBase<EmptyData>} */ class EmptyEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<LauncherData>} */ class LauncherEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<OpeningData>} */ class OpeningEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<InteractionData>} */ class InteractionEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<CloseData>} */ class CloseEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<FocusData>} */ class FocusEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<TargetData>} */ class TargetEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<ClockData>} */ class ClockEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<CustomizationData>} */ class CustomizationEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<ChangeData>} */ class ChangeEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<BackgroundData>} */ class BackgroundEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<ReadyData>} */ class ReadyEvent extends WebdeskEventBase {}

export let ApplicationManifests
export class WebdeskEvent {
	static MANIFESTS_READY = new ReadyEvent()
	static LAUNCHER_CLICK = new LauncherEvent()
	static TITLEBAR_READY = new ReadyEvent()

	static CONTENT_READY = new ReadyEvent()

	static WINDOW_MOVE_START = new InteractionEvent()
	static WINDOW_MOVE = new InteractionEvent()
	static WINDOW_MOVE_END = new InteractionEvent()

	static WINDOW_RESIZE_START = new InteractionEvent()
	static WINDOW_RESIZE = new InteractionEvent()
	static WINDOW_RESIZE_END = new InteractionEvent()

	static WINDOW_UPDATED_FOCUS = new FocusEvent()
	static WINDOW_OPENING = new OpeningEvent()
	static WINDOW_OPEN = new TargetEvent()
	
	static WINDOW_CLOSING = new CloseEvent()
	static WINDOW_CLOSE = new TargetEvent()

	static WINDOW_MAXIMISE = new TargetEvent()
	static WINDOW_MAXIMISE_END = new TargetEvent()

	static WINDOW_MINIMISE = new TargetEvent()
	static WINDOW_MINIMISE_END = new TargetEvent()

	static DOCK_HOVER = new EmptyEvent()
	static DOCK_HOVER_END = new EmptyEvent()
	static ICON_CLICK = new TargetEvent()
	static CLOCK_UPDATE = new ClockEvent()

	static CUSTOMIZATION_LOAD_REQUEST = new CustomizationEvent()
	static CUSTOMIZATION_LOADED = new CustomizationEvent()

	static CUSTOMIZATION_PREVIEW = new ChangeEvent()
	static CUSTOMIZATION_PREVIEW_SAVE_REQUEST = new ChangeEvent()
	static CUSTOMIZATION_PREVIEW_SAVED = new CustomizationEvent()

	static BACKGROUND_LOAD_REQUEST = new BackgroundEvent()
	static BACKGROUND_LOADED = new BackgroundEvent()
	static BACKGROUND_REMOVE_ALL = new EmptyEvent()
	// ^^^ ?????

	static BACKGROUND_UPLOAD_REQUEST = new EmptyEvent()
	static BACKGROUND_UPLOADED = new BackgroundEvent()
	
	static emitToIframes(thisArg, data) {
		const names = Object.keys(WebdeskEvent)
		const types = Object.values(WebdeskEvent)

		const nameIndex = types.indexOf(thisArg)

		MessagingHub.propagateEvent(names[nameIndex], data)
	}
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
			.then((registration) => {
				if (registration.active) { registration.active.postMessage("checkHashes") }
			})
			.catch((error) => { console.error(error) })
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
	/** @param {OpeningData} openingData */
	#addLink({ window: appWindow, titlebar, app }) {
		const titlebarChannel = new MessageChannel(),
		contentChannel = new MessageChannel(),
		privateChannel = new MessageChannel()

		const newLink = { content: contentChannel, titlebar: titlebarChannel, private: privateChannel }
		MessagingHub.windowToChannels.set(appWindow, newLink)

		newLink.content.port1.addEventListener("message", (event) => { MessagingHub.#commandResponder(event, newLink) })

		newLink.titlebar.port1.start()
		newLink.content.port1.start()
	}
	/** @param {CloseData} closeData */
	#removeLink({ closed }) { MessagingHub.windowToChannels.delete(closed) }
	/** @param {ReadyData} readyData */
	#sendContentPorts({ data: iframe, message }) {
		const appWindow = iframe.closest("[app]"),
		target = iframe.contentWindow,
		link = MessagingHub.windowToChannels.get(appWindow),
		{ port2: contentPort } = link.content,
		{ port1: privatePort } = link.private

		target.postMessage(message, "*", [ contentPort, privatePort ])
	}
	/** @param {ReadyData} readyData */
	#sendTitlebarPorts({ data: iframe, message }) {
		const appWindow = iframe.closest("[app]"),
		target = iframe.contentWindow,
		link = MessagingHub.windowToChannels.get(appWindow),
		{ port2: titlebarPort } = link.titlebar,
		{ port2: privatePort } = link.private

		target.postMessage(message, "*", [ titlebarPort, privatePort ])
	}

	propagateEvent(name, data) {
		const sendData = removeHTMLElements(data)
		MessagingHub.windowToChannels.forEach((link) => {
			link.content.port1.postMessage({ command: "event", payload: { event: name, data: sendData }})
			link.titlebar.port1.postMessage({ command: "event", payload: { event: name, data: sendData }})
		})
	}

	constructor() {
		WebdeskEvent.WINDOW_OPENING.on(this.#addLink)
		WebdeskEvent.WINDOW_CLOSING.on(this.#removeLink)

		WebdeskEvent.CONTENT_READY.on(this.#sendContentPorts)
		WebdeskEvent.TITLEBAR_READY.on(this.#sendTitlebarPorts)
	}
}

fetch("/api/getManifests").then(async (response) => {
	ApplicationManifests = await response.json()
	WebdeskEvent.MANIFESTS_READY.emit(ApplicationManifests)

	if (newUser) { setTimeout(() => { WebdeskEvent.LAUNCHER_CLICK.emit({ app: "intro" }) }, 1000) }
}).catch((error) => { console.log(error) })

document.adoptedStyleSheets.push(customStyleSheet)

if (newUser) inits.total()

if (activeCustomName) WebdeskDB.get("_customs", activeCustomName).then((css) => customStyleSheet.replace(css))
else inits.UI()