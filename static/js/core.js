// NOTE: Generator functions tho?

// TODO: Settings titlebar
// TODO: Error handling for database things
// TODO: Make ApplicationManifests into a object/class?

/** @typedef {Object} EmptyData */
/** @typedef {Object} ClockData
 * @property {string[]} update */
/** @typedef {Object} LauncherData
 * @property {string} app */
/** @typedef {Object} TargetData
 * @property {HTMLElement} target
 * @property {string} app */
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

fetch("/api/getManifests").then(async (response) => {
	ApplicationManifests = await response.json()
	WebdeskEvent.MANIFESTS_READY.emit({ data: ApplicationManifests })

	if (newUser) { setTimeout(() => { WebdeskEvent.LAUNCHER_CLICK.emit({ app: "intro" }) }, 25) }
}).catch((error) => { console.log(error) })

let newUser = false
const offlineMessageElement = document.querySelector("#offline")
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
export const webdeskDB = new class {
	version = 1
	// Helper for the main functions for interacting with the database
	async _run(tableName, mode, callback) {
		// Get the newest connection for the Database
		const database = await webdeskDB.ready

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
	// Get a key's value from a table
	get(table, key) {
		return webdeskDB._run(table, 0, (store) => store.get(key))
	}
	// Get all the values from all the keys of a table
	getAll(table) {
		return webdeskDB._run(table, 0, (store) => store.getAll())
	}
	// Set the value of a key inside a table
	set(table, key, value) {
		return webdeskDB._run(table, 1, (store) => store.put(value, key))
	}
	// Delete a key inside a table
	delete(table, key) {
		return webdeskDB._run(table, 1, (store) => store.delete(key))
	}
	// Adds new tables into the database
	async createTable(tableName) {
		// Wait for the database
		const database = await webdeskDB.ready

		// If table exists do nothing
		if (database.objectStoreNames.contains(tableName)) { return }

		// Close the Database
		database.close()
		console.log(`Closing Database to create table "${tableName}"`)

		return new Promise((resolve, reject) => {
			// Up the Database version
			const req = indexedDB.open("webdesk", ++webdeskDB.version)

			// Before the Database Opens, add the new table
			req.onupgradeneeded = (event) => {
				const db = event.target.result
				if (!db.objectStoreNames.contains(tableName)) { db.createObjectStore(tableName) }
			}

			// When the Database Opens, resolve all Promises
			req.onsuccess = (event) => {
				const db = event.target.result
				db.onversionchange = () => { db.close() }

				localStorage.setItem("db-version", webdeskDB.version)

				// Update the global ready reference instantly without queueing
				webdeskDB.ready = Promise.resolve(db)
				resolve()
			}

			req.onblocked = req.onerror = (event) => reject(event)
		})
	}
	constructor() {
		// Get the last version of the database
		const dbVersion = localStorage.getItem("db-version")
		// If there is no item in local storage called "db-version", initialize
		if (dbVersion == undefined) {
			localStorage.setItem("db-version", 1)
			newUser = true
		} else { this.version = parseInt(dbVersion) }

		// Stops any db interaction in case of db updating
		this.ready = new Promise((resolve, reject) => {
			// Send the db open request
			const req = indexedDB.open("webdesk", this.version)
			// If successfull, update the status of the database connection
			req.onsuccess = () => {
				// When adding new tables, automatically close the database
				req.result.onversionchange = () => { req.result.close() }
				resolve(req.result)
			}
			// On error, report it
			req.onblocked = req.onerror = (event) => reject(event)
		})

		// Used to not overlap operations to the Database
		this.updateLock = Promise.resolve()
	}
}
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

	static ICON_CLICK = new TargetEvent()
	static CLOCK_UPDATE = new ClockEvent()

	static CUSTOMIZATION_LOAD = new CustomizationEvent()
	static CUSTOMIZATION_LOADED = new CustomizationEvent()

	static CUSTOMIZATION_CHANGE = new ChangeEvent()
	static CUSTOMIZATION_CHANGE_SAVE = new ChangeEvent()
	static CUSTOMIZATION_CHANGE_SAVED = new CustomizationEvent()

	static BACKGROUND_LOAD = new BackgroundEvent()
	static BACKGROUND_LOADED = new BackgroundEvent()
	static BACKGROUND_REMOVE_ALL = new EmptyEvent()

	static BACKGROUND_UPLOAD = new EmptyEvent()
	static BACKGROUND_UPLOADED = new BackgroundEvent()
	
	static emitToIframes(thisArg, data) {
		const names = Object.keys(WebdeskEvent)
		const types = Object.values(WebdeskEvent)

		const nameIndex = types.indexOf(thisArg)

		MessagingHub.propagateEvent(names[nameIndex], data)
	}
}
export const time = new class {
	init = new Date()
	seconds = this.init.getSeconds()
	minutes = this.init.getMinutes()
	hours = this.init.getHours()
	day = this.init.getDate()
	month = this.init.getMonth() + 1
	year = this.init.getFullYear()

	progress() {
		const changed = [ "seconds" ]
		time.seconds++

		if (time.seconds >= 60) {
			time.seconds = 0
			time.minutes++

			changed.push("minutes")
		}

		if (time.minutes >= 60) {
			time.minutes = 0
			time.hours++

			changed.push("hours")
		}

		if (time.hours >= 24) {
			time.hours = 0
			time.day++

			changed.push("day")
		}

		WebdeskEvent.CLOCK_UPDATE.emit({ update: changed })
	}

	constructor() {
		setTimeout(() => {
			time.progress()
			setInterval(time.progress, 1000)
		}, 1000 - this.init.getMilliseconds())
	}
}
export const StyleSheets = {
	launchers: new CSSStyleSheet(),
	windows: new CSSStyleSheet(),
	dock: new CSSStyleSheet()
}
export const MessagingHub = new class {
	/** @type {Map<HTMLElement, object>} */
	windowToChannels = new Map()

	async #commandResponder({ data: { command, data } }, { content: contentChannel, titlebar: titlebarChannel }) {
		switch(command) {
			case "emit.event": {
				WebdeskEvent[data.type].emit(data.payload)

				return
			}
			case "get.localstorage": {
				const { key } = data
				const value = localStorage.getItem(key)

				contentChannel.port1.postMessage({ command, data: { value } })

				return
			}
			case "get.db": {
				const { table, key } = data
				const value = await webdeskDB.get(table, key)

				contentChannel.port1.postMessage({ command, data: { value } })

				return
			}
			case "getAll.db": {
				const { table } = data
				const value = await webdeskDB.getAll(table)

				contentChannel.port1.postMessage({ command, data: { value } })

				return
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

				contentChannel.port1.postMessage({ command, data: { style } })

				return
			}
			default: { contentChannel.port1.postMessage({ command, data: { } }) }
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
			link.content.port1.postMessage({ command: "event", data: { type: name, data: sendData }})
			link.titlebar.port1.postMessage({ command: "event", data: { type: name, data: sendData }})
		})
	}

	constructor() {
		WebdeskEvent.WINDOW_OPENING.on(this.#addLink)
		WebdeskEvent.WINDOW_CLOSING.on(this.#removeLink)

		WebdeskEvent.CONTENT_READY.on(this.#sendContentPorts)
		WebdeskEvent.TITLEBAR_READY.on(this.#sendTitlebarPorts)
	}
}

document.adoptedStyleSheets = Object.values(StyleSheets)