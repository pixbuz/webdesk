// Utility Class to interact with IndexDB
// class WebdeskDatabase {
// 	constructor() {
// 		// Get the last Version of the Database
// 		const dbVersion = localStorage.getItem("db-version")

// 		if (dbVersion == undefined) {
// 			webdeskFirstTimeInit()
// 			this.version = 1
// 			localStorage.setItem("db-version", 1)
// 		} else { this.version = parseInt(dbVersion) }

// 		// Used to check if there is a connection to the Database
// 		this.ready = new Promise((resolve, reject) => {
// 			// Send the Open Request
// 			const req = indexedDB.open("webdesk", this.version)

// 			// If successfull, update the status of the Database connection
// 			req.onsuccess = () => {
// 				// When adding new tables, automatically close the Database
// 				req.result.onversionchange = () => { req.result.close() }
// 				resolve(req.result)
// 			}

// 			// On error, report it
// 			req.onblocked = req.onerror = (event) => reject(event)
// 		})

// 		// Used to not overlap operations to the Database
// 		this.updateLock = Promise.resolve()
// 	}

// 	async _run(tableName, mode, callback) {
// 		// Helper function
// 		// Wait for no operations on the Database
// 		await this.updateLock

// 		// Get the newest connection for the Database
// 		const database = await this.ready

// 		// Return undefined if trying to access a table that doesn't exist
// 		if (!database.objectStoreNames.contains(tableName)) { return undefined }

// 		return new Promise((resolve, reject) => {
// 			try {
// 				const tx = database.transaction(tableName, mode == 0 ? "readonly" : "readwrite")
// 				const store = tx.objectStore(tableName)
// 				const request = callback(store)

// 				request.onsuccess = () => resolve(request.result)
// 				request.onerror = () => reject(request.error)
// 			} catch (err) { reject(err) }
// 		})
// 	}

// 	get(table, key) {
// 		// Get a Key from a Table
// 		return this._run(table, 0, (store) => { return store.get(key) })
// 	}

// 	getAll(table) {
// 		// Get all Key's Values from a Table
// 		return this._run(table, 0, (store) => { return store.getAll() })
// 	}

// 	set(table, key, value) {
// 		// Set the Value of a Key inside a Table
// 		return this._run(table, 1, (store) => { return store.put(value, key) })
// 	}

// 	delete(table, key) {
// 		// Delete a Key inside a Table
// 		return this._run(table, 1, (store) => { return store.delete(key) })
// 	}


// 	async createTable(tableName) {
// 		// Adds new Tables into the Database
// 		// Wait for the old operation lock and set the new operation lock to:
// 		this.updateLock = this.updateLock.then(async () => {
// 			// Wait for the database
// 			const database = await this.ready
			
// 			// If table exists do nothing
// 			if (database.objectStoreNames.contains(tableName)) return

// 			// Close the Database
// 			database.close()
// 			console.log(`Closing Database to create table "${tableName}"`)

// 			// Block any Database operations now that it is closed
// 			let resolveNewDb
// 			this.ready = new Promise((resolve) => { resolveNewDb = resolve })

// 			return new Promise((resolve, reject) => {
// 				// Up the Database version
// 				const req = indexedDB.open("webdesk", ++this.version)

// 				// Before the Database Opens, add the new table
// 				req.onupgradeneeded = (event) => {
// 					const database = event.target.result

// 					if (!database.objectStoreNames.contains(tableName)) { database.createObjectStore(tableName) }
// 				}

// 				// When the Database Opens, resolve all Promises
// 				req.onsuccess = (event) => {
// 					const database = event.target.result
// 					database.onversionchange = () => { database.close() }
					
// 					localStorage.setItem("db-version", this.version)

// 					resolveNewDb(database)
// 					resolve()
// 				}

// 				req.onblocked = req.onerror = (event) => reject(event)
// 			})
// 		})

// 		return this.updateLock
// 	}
// }

// Utility Class to Dispatch and Listen for Custom OS Events
// class WebdeskOSEvent {
// 	constructor(eventName, objectTemplate = {}) {
// 		this.name = eventName
// 		this.template = objectTemplate
// 	}

// 	emit(data = {}) {
// 		// Used to trigger an Event
// 		// Merge the Template with the emit Data
// 		const details = { ...this.template, ...data }
// 		// Create the Event
// 		const event = new CustomEvent(this.name, {
// 			detail: details,
// 			bubbles: true,
// 			composed: true
// 		})

// 		// Dispatch the Custom Event
// 		window.dispatchEvent(event)
// 	}

// 	on(callBackFunctions = [], oneTime = false) {
// 		// Used to set callback Functions to an event in batch

// 		callBackFunctions.map((callBackFunction) => {
// 			// console.log(`Resistred the "${callBackFunction.name}" function to run on the "${this.name}" event`)
// 			window.addEventListener(this.name, (event) => { callBackFunction(event.detail) }, { once: oneTime })
// 		})
// 	}
// }

// function webdeskFirstTimeInit() {
// 	window.addEventListener("load", () => {
// 		firstTimeDatabaseInit()
// 		firstTimeUIInit()
// 	})
// }

// First time Initialization Function for the Database
// async function firstTimeDatabaseInit() {
// 	await WebdeskDB.createTable("settings")
// 	await WebdeskDB.set("settings", "dbclass", `return ${WebdeskDatabase.toString()}`)

// }

// Utility Function to extract all window information from a div
// function getWindowInfo(appWindow) {
// 	const windowID = appWindow.getAttribute("id")
// 	const appName = appWindow.getAttribute("app")
	
// 	return { id: windowID, target: appWindow, app: appName}
// }

// // Detail Object Template for WINDOW Events
// const WINDOW_EVENT_TEMPLATE = {
// 	id: null,
// 	app: "",
// 	target: null,
// }

// // Detail Object Template for TITLEBAR Events
// const TITLEBAR_EVENT_TEMPLATE = WINDOW_EVENT_TEMPLATE

// const WINDOW_OPEN = new WebdeskOSEvent("window-open", WINDOW_EVENT_TEMPLATE)
// const WINDOW_CLOSE = new WebdeskOSEvent("window-closed", WINDOW_EVENT_TEMPLATE)

// const WINDOW_MOVE = new WebdeskOSEvent("window-move_end", WINDOW_EVENT_TEMPLATE)
// const WINDOW_MOVE_END = new WebdeskOSEvent("window-move", WINDOW_EVENT_TEMPLATE)
// const WINDOW_RESIZE = new WebdeskOSEvent("window-resize_end", WINDOW_EVENT_TEMPLATE)
// const WINDOW_RESIZE_END = new WebdeskOSEvent("window-resize", WINDOW_EVENT_TEMPLATE)

// const WINDOW_MAXIMISE = new WebdeskOSEvent("window-maximised", WINDOW_EVENT_TEMPLATE)
// const WINDOW_MAXIMISE_END = new WebdeskOSEvent("window-maximised_end", WINDOW_EVENT_TEMPLATE)
// const WINDOW_MINIMISE = new WebdeskOSEvent("window-minimised", WINDOW_EVENT_TEMPLATE)
// const WINDOW_MINIMISE_END = new WebdeskOSEvent("window-minimised_end", WINDOW_EVENT_TEMPLATE)

// const WINDOW_CHANGED_FOCUS = new WebdeskOSEvent("window-changed_focus", WINDOW_EVENT_TEMPLATE)
// const WINDOW_CHECK_COLLISION = new WebdeskOSEvent("window-check_collision", WINDOW_EVENT_TEMPLATE)

// const TITLEBAR_MOUSEDOWN = new WebdeskOSEvent("titlebar-mousedown", TITLEBAR_EVENT_TEMPLATE)

// const WebdeskDB = new WebdeskDatabase()