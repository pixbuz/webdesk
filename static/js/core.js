// NOTE: Generator functions tho?

// TODO: Settings titlebar
// TODO: Make ApplicationManifests into a object/class?
// TODO: Messaging system between titlebar, content and front end script (triumvirate)

let newUser = false
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

/** @typedef {Object} EmptyData */

/** @typedef {Object} ClockData
 * @property {string[]} update */

/** @typedef {Object} LauncherData
 * @property {string} app */

/** @typedef {Object} TargetData
 * @property {HTMLElement} target */

/** @typedef {Object} FocusData
 * @property {HTMLElement} old
 * @property {HTMLElement} new */

/** @typedef {Object} OpenData
 * @property {HTMLElement} target
 * @property {string} app */

/** @typedef {Object} CloseData
 * @property {HTMLElement} closed
 * @property {HTMLElement[]} open */

/** @typedef {Object} ChangeData
 * @property {string} css
 * @property {string} value */

/** @typedef {Object} TitlebarData
 * @property {HTMLElement} titlebar
 * @property {any} app */

/** @typedef {Object} BackgroundData
 * @property {number} id
 * @property {string} background */

/** @typedef {Object} InteractionData
 * @property {HTMLElement} target
 * @property {number} x
 * @property {number} y
 * @property {boolean} force */

/** @typedef {Object} CustomizationData
 * @property {number} id
 * @property {string} css
 * @property {Object} object
 * @property {boolean} force */

/** @template T */
class WebdeskEventBase {
	/** @type {((data: T) => void)[]} */
	callbacks = [ ]

	/** @param {Partial<T>} data */
	emit(data = {}) { this.callbacks.forEach((callback) => { callback(data) }) }

	/** @param {...((data: T) => void)} newCallbacks */
	on(...newCallbacks) { this.callbacks.push(...newCallbacks) }

	/** @param {...((data: T) => void)} callback */
	off(callback) {
		this.callbacks = this.callbacks.filter(cb => cb !== callback)
	}

	constructor() { }
}

/** @extends {WebdeskEventBase<EmptyData>} */ class EmptyEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<LauncherData>} */ class LauncherEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<TitlebarData>} */ class TitlebarEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<InteractionData>} */ class InteractionEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<OpenData>} */ class OpenEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<CloseData>} */ class CloseEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<FocusData>} */ class FocusEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<TargetData>} */ class TargetEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<ClockData>} */ class ClockEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<CustomizationData>} */ class CustomizationEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<ChangeData>} */ class ChangeEvent extends WebdeskEventBase {}
/** @extends {WebdeskEventBase<BackgroundData>} */ class BackgroundEvent extends WebdeskEventBase {}

export class WebdeskEvent {
	static MANIFESTS_READY = new EmptyEvent()
	static LAUNCHER_CLICK = new LauncherEvent()
	static TITLEBAR_SETUP = new TitlebarEvent()
	
	static WINDOW_MOVE_START = new InteractionEvent()
	static WINDOW_MOVE = new InteractionEvent()
	static WINDOW_MOVE_END = new InteractionEvent()
	
	static WINDOW_RESIZE_START = new InteractionEvent()
	static WINDOW_RESIZE = new InteractionEvent()
	static WINDOW_RESIZE_END = new InteractionEvent()
	
	static WINDOW_OPEN = new OpenEvent()
	static WINDOW_CLOSE = new CloseEvent()
	static WINDOW_UPDATED_FOCUS = new FocusEvent()
	
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
}

export const time = new class {
	init = new Date()
	clock = {
		seconds: this.init.getSeconds(),
		minutes: this.init.getMinutes(),
		hours: this.init.getHours(),
	}
	date = {
		day: this.init.getDate(),
		month: this.init.getMonth() + 1,
		year: this.init.getFullYear(),
	}

	progress() {
		const changed = [ "seconds" ]
		time.clock.seconds++

		if (time.clock.seconds >= 60) {
			time.clock.seconds = 0
			time.clock.minutes++

			changed.push("minutes")
		}

		if (time.clock.minutes >= 60) {
			time.clock.minutes = 0
			time.clock.hours++

			changed.push("hours")
		}

		if (time.clock.hours >= 24) {
			time.clock.hours = 0
			time.date.day++

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

const SWManager = new class {
	loadInformation() {
		navigator.storage.estimate().then(({ usage, quota }) => {
			const usedMB = (usage / 1024 ** 2).toFixed(2)
			const totalMB = (quota / 1024 ** 2).toFixed(2)
			const percentUsed = ((usage / quota) * 100).toFixed(2)

			console.log(`Using ${usedMB} MB out of ${totalMB} MB (${percentUsed}%)`)
		})
	}

	constructor() {
		navigator.serviceWorker.register("/sw")
			.catch((error) => { console.error(error) })
	}
}

fetch("/api/_/getManifests").then(async (response) => {
	ApplicationManifests = await response.json()
	WebdeskEvent.MANIFESTS_READY.emit(ApplicationManifests)

	if (newUser) { setTimeout(() => { WebdeskEvent.LAUNCHER_CLICK.emit({ app: "intro" }) }, 50) }
})