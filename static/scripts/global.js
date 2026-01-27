// Utility Class 👍
const Utilities = new class UtilitiesClass {
	// Detail Object Template for WINDOW Events
	WINDOW_EVENT_TEMPLATE = {
		app: "",
		id: null,
		target: null,
	}

	// Detail Object Template for TITLEBAR Events
	TITLEBAR_EVENT_TEMPLATE = WINDOW_EVENT_TEMPLATE

	// // Detail Object Template for TITLEBAR Events
	// TITLEBAR_EVENT_TEMPLATE = WINDOW_EVENT_TEMPLATE

	// Utility Function to extract all window information from a div
	getWindowInfo(appWindow) {
		const windowID = appWindow.getAttribute("id")
		const appName = appWindow.getAttribute("app")
	
		return { id: windowID, target: appWindow, app: appName}
	}

	// Get the client start time
	initTime = new Date()

	// Initialize the Clock and Date Values
	clockTime = {
		"seconds": this.initTime.getSeconds(),
		"minutes": this.initTime.getMinutes(),
		"hours": this.initTime.getHours(),

		"day": this.initTime.getDate(),
		"month": this.initTime.getMonth() + 1,
		"year": this.initTime.getFullYear(),
	}

	webdeskDB = new class {
		constructor() {
			// Get the last Version of the Database
			const dbVersion = localStorage.getItem("db-version")

			if (dbVersion == undefined) {
				window.dispatchEvent(new Event("FirstTimeInit"))
				localStorage.setItem("db-version", 1)
				this.version = 1
			} else { this.version = parseInt(dbVersion) }

			// Used to check if there is a connection to the Database
			this.ready = new Promise((resolve, reject) => {
				// Send the Open Request
				const req = indexedDB.open("webdesk", this.version)

				// If successfull, update the status of the Database connection
				req.onsuccess = () => {
					// When adding new tables, automatically close the Database
					req.result.onversionchange = () => { req.result.close() }
					resolve(req.result)
				}

				// On error, report it
				req.onblocked = req.onerror = (event) => reject(event)
			})

			// Used to not overlap operations to the Database
			this.updateLock = Promise.resolve()
		}

		async _run(tableName, mode, callback) {
			// Helper function
			// Wait for no operations on the Database
			await this.updateLock

			// Get the newest connection for the Database
			const database = await this.ready

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

		get(table, key) {
			// Get a Key from a Table
			return this._run(table, 0, (store) => { return store.get(key) })
		}

		getAll(table) {
			// Get all Key's Values from a Table
			return this._run(table, 0, (store) => { return store.getAll() })
		}

		set(table, key, value) {
			// Set the Value of a Key inside a Table
			return this._run(table, 1, (store) => { return store.put(value, key) })
		}

		delete(table, key) {
			// Delete a Key inside a Table
			return this._run(table, 1, (store) => { return store.delete(key) })
		}

		_addTable(tableName) {
			return new Promise((resolve, reject) => {
				// Up the Database version
				const req = indexedDB.open("webdesk", ++this.version)

				// Before the Database Opens, add the new table
				req.onupgradeneeded = (event) => {
					const database = event.target.result
					database.createObjectStore(tableName)
				}

				// When the Database Opens, resolve all Promises
				req.onsuccess = (event) => {
					const database = event.target.result
					database.onversionchange = () => { database.close() }

					localStorage.setItem("db-version", this.version)

					resolveNewDb(database)
					resolve()
				}

				req.onblocked = req.onerror = (event) => reject(event)
			})
		}

		async createTable(tableName) {
			// Adds new Tables into the Database
			// Wait for the old operation lock and set the new operation lock to:
			this.updateLock = this.updateLock.then(async () => {
				// Wait for the database
				const database = await this.ready

				// If table exists do nothing
				if (database.objectStoreNames.contains(tableName)) return

				// Block any Database operations now that it is closed
				let resolveNewDb
				this.ready = new Promise((resolve) => { resolveNewDb = resolve })

				return _addTable(tableName)
			})

			return this.updateLock
		}
	}

	WebdeskOSEvents = class {
		constructor(eventName, objectTemplate = {}) {
			this.name = eventName
			this.template = objectTemplate
		}

		emit(data = {}) {
			// Used to trigger an Event
			// Merge the Template with the emit Data
			const details = { ...this.template, ...data }

			// Create the Event
			const event = new CustomEvent(this.name, {
				detail: details,
				bubbles: true,
				composed: true
			})

			// Dispatch the Custom Event
			window.dispatchEvent(event)
		}

		on(callBackFunctions = [], oneTime = false) {
			// Used to set callback Functions to an event in batch
			callBackFunctions.map((callBackFunction) => {
				// console.log(`Resistred the "${callBackFunction.name}" function to run on the "${this.name}" event`)
				window.addEventListener(this.name, (event) => { callBackFunction(event.detail) }, { once: oneTime })
			})
		}
	}

	updateClock() {
		// Runs every second, updating the Clock in the frontend
		// Add a second to the current time
		this.clockTime.seconds++

		// If the seconds hit 60
		if (this.clockTime.seconds >= 60) {
			// Set them to 0 and add a minute
			this.clockTime.seconds = 0
			this.clockTime.minutes++

			this.CLOCK_UPDATE_SECONDS.emit(this.clockTime)
			this.CLOCK_UPDATE_MINUTES.emit(this.clockTime)
		} else { this.CLOCK_UPDATE_SECONDS.emit(this.clockTime) }

		// If the minutes hit 60
		if (this.clockTime.minutes >= 60) {
			// Set them to 0 and add an hour
			this.clockTime.minutes = 0
			this.clockTime.hours++

			this.CLOCK_UPDATE_MINUTES.emit(this.clockTime)
			this.CLOCK_UPDATE_HOURS.emit(this.clockTime)
		} else { this.CLOCK_UPDATE_MINUTES.emit(this.clockTime) }

		// If the hours hit 24
		if (this.clockTime.hours >= 24) {
			// Set them to 0 and add a day
			this.clockTime.hours = 0
			this.clockTime.day++

			this.CLOCK_UPDATE_HOURS.emit(this.clockTime)
			this.CLOCK_UPDATE_DAY.emit(this.clockTime)
		} else { this.CLOCK_UPDATE_HOURS.emit(this.clockTime) }
	}

	constructor() {
		this.WINDOW_OPEN = new this.WebdeskOSEvents("window-open", WINDOW_EVENT_TEMPLATE)
		this.WINDOW_CLOSE = new this.WebdeskOSEvents("window-closed", WINDOW_EVENT_TEMPLATE)

		this.WINDOW_MOVE = new this.WebdeskOSEvents("window-move_end", WINDOW_EVENT_TEMPLATE)
		this.WINDOW_MOVE_END = new this.WebdeskOSEvents("window-move", WINDOW_EVENT_TEMPLATE)
		this.WINDOW_RESIZE = new this.WebdeskOSEvents("window-resize_end", WINDOW_EVENT_TEMPLATE)
		this.WINDOW_RESIZE_END = new this.WebdeskOSEvents("window-resize", WINDOW_EVENT_TEMPLATE)

		this.WINDOW_MAXIMISE = new this.WebdeskOSEvents("window-maximised", WINDOW_EVENT_TEMPLATE)
		this.WINDOW_MAXIMISE_END = new this.WebdeskOSEvents("window-maximised_end", WINDOW_EVENT_TEMPLATE)
		this.WINDOW_MINIMISE = new this.WebdeskOSEvents("window-minimised", WINDOW_EVENT_TEMPLATE)
		this.WINDOW_MINIMISE_END = new this.WebdeskOSEvents("window-minimised_end", WINDOW_EVENT_TEMPLATE)

		this.WINDOW_CHANGED_FOCUS = new this.WebdeskOSEvents("window-changed_focus", WINDOW_EVENT_TEMPLATE)
		this.WINDOW_CHECK_COLLISION = new this.WebdeskOSEvents("window-check_collision", WINDOW_EVENT_TEMPLATE)

		this.TITLEBAR_MOUSEDOWN = new this.WebdeskOSEvents("titlebar-mousedown", TITLEBAR_EVENT_TEMPLATE)

		this.CLOCK_UPDATE_SECONDS = new this.WebdeskOSEvents("clock-update-seconds", CLOCK_EVENT_TEMPLATE)
		this.CLOCK_UPDATE_MINUTES = new this.WebdeskOSEvents("clock-update-minutes", CLOCK_EVENT_TEMPLATE)
		this.CLOCK_UPDATE_HOURS = new this.WebdeskOSEvents("clock-update-hours", CLOCK_EVENT_TEMPLATE)

		this.CLOCK_UPDATE_DAY = new this.WebdeskOSEvents("clock-update-day", CLOCK_EVENT_TEMPLATE)
		this.CLOCK_UPDATE_MONTH = new this.WebdeskOSEvents("clock-update-month", CLOCK_EVENT_TEMPLATE)
		this.CLOCK_UPDATE_YEAR = new this.WebdeskOSEvents("clock-update-year", CLOCK_EVENT_TEMPLATE)

		// "Nullifies" the start time offset
		setTimeout(() => {
			// Sets up a function to update the clock every second
			updateClock()
			setInterval(updateClock, 1000)
		}, 1000 - initTime.getMilliseconds())

		window.utilities = {}
		window.utilities.saveBackground = async function(htmlObject) {
			const lastBackgroundID = localStorage.getItem("backgrounds-last-id")

			WebdeskDB.set("_backgrounds", lastBackgroundID + 1, htmlObject)
			loadBackground(lastBackgroundID + 1)

			localStorage.setItem("backgrounds-last-id", lastBackgroundID + 1)
		}

		window.utilities.webdeskDB = this.webdeskDB

		window.addEventListener("firstTimeInit", function() {
			window.addEventListener("load", async () => {
				// First time Initialization Function for the Database
				await WebdeskDB.createTable("settings")
				await WebdeskDB.set("settings", "dbclass", `return ${WebdeskDatabase.toString()}`)
			})
		})
	}
}

const AppDock = new class AppDockClass {
	// Get the App Dock Element
	appDock = document.querySelector(".AppDock")
	// Get the Clock of inside App Dock
	appDockClock = appDock.querySelector(".Clock")
	// Get the Open Windows element inside App Dock
	appDockOpenWindows = appDock.querySelector(".Open")
	// Template of the Open Window Icon Element
	assetsDockIcon = document.getElementsByName("DockIcon")[0]

	constructor() {
		// Set up the Clock Text Elements
		appDockClock.querySelector(".Seconds").innerText = `${Utilities.clockTime.seconds}`.padStart(2, 0)
		appDockClock.querySelector(".Minutes").innerText = `${Utilities.clockTime.minutes}`.padStart(2, 0)
		appDockClock.querySelector(".Hours").innerText = `${Utilities.clockTime.hours}`.padStart(2, 0)
	
		// Sets the up the Date Text Elements
		appDockClock.querySelector(".Day").innerText = `${Utilities.clockTime.day}`.padStart(2, 0)
		appDockClock.querySelector(".Month").innerText = `${Utilities.clockTime.month}`.padStart(2, 0)
		appDockClock.querySelector(".Year").innerText = Utilities.clockTime.year

		// Set up the Clock Text Elements
		Utilities.CLOCK_UPDATE_SECONDS.on((time) => { appDockClock.querySelector(".Seconds").innerText = `${time.seconds}`.padStart(2, 0) })
		Utilities.CLOCK_UPDATE_MINUTES.on((time) => { appDockClock.querySelector(".Minutes").innerText = `${time.minutes}`.padStart(2, 0) })
		Utilities.CLOCK_UPDATE_HOURS.on((time) => { appDockClock.querySelector(".Hours").innerText = `${time.hours}`.padStart(2, 0) })

		// Sets the up the Date Text Elements
		Utilities.CLOCK_UPDATE_DAY.on((time) => { appDockClock.querySelector(".Day").innerText = `${time.day}`.padStart(2, 0) })
		Utilities.CLOCK_UPDATE_MONTH.on((time) => { appDockClock.querySelector(".Month").innerText = `${time.month}`.padStart(2, 0) })
		Utilities.CLOCK_UPDATE_YEAR.on((time) => { appDockClock.querySelector(".Year").innerText = time.year })

		WINDOW_OPEN.on([this.icons.windowOpenendUpdate.bind(this)])
		WINDOW_CLOSE.on([this.icons.windowClosedUpdate.bind(this)])

		WINDOW_MINIMISE.on([this.icons.windowMinimisedUpdate.bind(this)])
		WINDOW_MINIMISE_END.on([this.icons.windowMinimisedUpdate.bind(this)])
	}

	icons = new class {
		// Map between a Windows and Icon Elements
		windowDockIconMap = new WeakMap()

		windowOpenendUpdate(details) {
			// Spawn a Newly Opened Window's Dock Icon
			const dockIcon = assetsDockIcon.cloneNode(true)
			const appName = details.target.getAttribute("app")
			appDockOpenWindows.append(dockIcon)

			// Add the necessary event listeners
			dockIcon.addEventListener("click", focusLinkedWindow)
	
			// Set the values of the Dock Icon
			dockIcon.setAttribute("app", appName)
			dockIcon.querySelector(".Icon").src = `apps/${appName}/icon`

			// Link the new Dock Icon to its Window
			windowDockIconMap.set(details.target, dockIcon)
		}

		windowClosedUpdate(details) {
			// Delete a Just Closed Window's Dock Icon
			const dockIcon = windowDockIconMap.get(details.target)

			// Delete the Dock Icon and remove it from the Map
			dockIcon.remove()
			windowDockIconMap.delete(details.target)
		}

		windowMinimisedUpdate(details) {
			// Update an Minimized Window Dock Icon
			const dockIcon = windowDockIconMap.get(details.target)

			// Add the class
			dockIcon.classList.add("mini")
		}

		// FAAHHH
		focusLinkedWindow(event) {
			// Shifts the Focus on the Linked Window of a Dock Icon
			const appName = event.target.closest(`[name="DockIcon"]`).getAttribute("app")
			const window = windowSpace.querySelector(`[app="${appName}"]`)

			// Removes classes for some reason
			window.classList.remove("minimized")
			window.classList.remove("maximised")
		}

		// Add maximised
	}
}

const Launchers = new class LaunchersClass {
	launcherSpace = document.querySelector(".Launcher.Space")
	assetsLauncher = document.getElementsByName("Launcher")[0]

	addLaunchers(appsManifests) {
		// Add the Launchers of all Installed Apps
		const appNames = Object.keys(appsManifests)
		
		// For every Installed App:
		appNames.sort().map((appName) => {
			// Add a Launcher to the Launcher Space
			const launcher = assetsLauncher.cloneNode(true)
			const description = appsManifests[appName].description
			launcherSpace.appendChild(launcher)

			// Add the Interaction Event Listener
			launcher.addEventListener("click", openWindow)

			// Set the appropriate Proprieties
			launcher.setAttribute("app", appName)
			launcher.setAttribute("title", description == "undefined" ? appName : description)
			launcher.querySelector(".Name").innerText = appName
			launcher.querySelector(".Icon").src = `apps/${appName}/icon`

			// !!! !!! !!!
			// DEBUG !!! !!! !!!
			if (appName == "settings") launcher.dispatchEvent(new Event("click"))
		})
	}

	constructor() {

	}
}

const Sockets = new class SocketsClass {
	// Websocket to the Backend
	webdeskBackend = new WebSocket(`/`)
	// In the future it's going to be more usefull
	connectionTimeout = setTimeout(connectionError, 10000)

	serverQuery(message) {
		// Sends a message to the backend and waits for a response, returns back the message contents
		// TODO: Make more robust using IDs, if necessary
		
		// Sends a message trough the websocket
		webdeskBackend.send(message)

		// Waits for a response
		// TODO: Add a timeout
		return new Promise((resolve) => {
			webdeskBackend.addEventListener("message", (response) => {
				resolve(response.data)
			}, { once: true })
		})
	}

	connectionError() {
		// In the future it's going to be more usefull
		console.log("Unable to connect to Web Desk's Backend")
	}

	constructor() {
		webdeskBackend.addEventListener("error", connectionError, { once: true })
		webdeskBackend.addEventListener("open", async () => {
			// Clear the Timeout when Connected
			clearTimeout(connectionTimeout)

			// Ask the server for the Installed Apps Manifests
			const appsManifests = JSON.parse(await serverQuery("app manifests"))

			// Send the Manifests to the init function
			Launchers.addLaunchers(appsManifests)
		}, { once: true })
	}
}

const UI = new class UIClass {
	windows = {
		"colors": {
			"background": "#D8DEE9",
			"border": "#4C566A",
			"title": "#2E3440",
			"dots": "#2E3440",

			"buttons": {
				"close": "#D08770",
				"maxi": "#EBCB8B",
				"mini": "#A3BE8C",
			},

			"focus": {
				"background": "#ECEFF4",
				"border": "#2E3440",
				"title": "#2E3440",
				"dots": "#3B4252",

				"buttons": {
					"close": "#D08770",
					"maxi": "#EBCB8B",
					"mini": "#A3BE8C",
				},
			},
		},
		"sizes": {
			"background": "",
			"titlebar": "",
			"border": "",
			"title": "",
			"icon": "",
			"dots": "",
			
			"buttons": {
				"close": "",
				"maxi": "",
				"mini": "",
			},
		},
		"behaviour": {
			"moveSmoothing": null,
			"resizeSmoothing": null,
			"maximizeSmoothing": null,
			"minimizeSmoothing": null,
			"closeSmoothing": null,
		},
	}

	launchers = {
		"colors": {
			"text": "#2E3440",
		},
		"sizes": {
			"text": ""
		},
		"behaviour": {}
	}

	appDock = {
		"colors": {
			"background": "#4C566A",
			"border": "#434C5E",
			"text": "#D8DEE9",

			"icons": {
				"background": "transparent",
			
				"focus": {
					"background": "transparent",
				},
			
				"mini": {
					"background": "transparent",
				},
			
				"maxi": {
					"background": "transparent",
				},
			},
		},
		"sizes": {
			"borderWidth": "none",
			"borderStyle": "solid",
		},
		"bahaviour": {
			"autoHide": {
				"enabled": null,
				"upTime": null,
				"upDelay": null,
				"downDelay": null,
			},
		
			"hideOnMaximisedWindow": {
				"enabled": null,
				"upTime": null,
				"upDelay": null,
				"downDelay": null,
			}
		}
	}

	customName = "nord"
	customType = 1
	background = 0

	async firstTimeInit() {
		localStorage.setItem("customization", JSON.stringify(CustomizationProprieties))
		localStorage.setItem("saved-customizations", JSON.stringify([CustomizationProprieties]))
		localStorage.setItem("backgrounds-last-id", 0)

		await WebdeskDB.createTable("_backgrounds")
		await WebdeskDB.set("_backgrounds", 0, `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="cool"><feTurbulence baseFrequency='0.01' numOctaves="1" result='noise' filterRes="1000"/><feDiffuseLighting in='noise' lighting-color='var(#D8DEE9)' surfaceScale='6'><feDistantLight azimuth='45' elevation='60' /></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#cool)" /></svg>`)
	}

	loadCssVar(root, prefix = "") {
		for (const key of Object.keys(root)) {
			if (root[key] instanceof Object) { loadCssVar(root[key], `${prefix ? prefix + "-" : ""}${key}`) }
			else { document.documentElement.style.setProperty(`--${prefix}-${key}`, root[key]) }
		}
	}

	async loadBackground(override) {
		const backgroundWrapper = document.querySelector(".Background")
		const backgroundID = JSON.parse(localStorage.getItem("customization") || JSON.stringify(CustomizationProprieties))["background"]

		const backgroundContents = await WebdeskDB.get("_backgrounds", override || backgroundID)
		backgroundWrapper.innerHTML = backgroundContents
	}

	constructor () { (async () => {
		// Loads the customization
		const themeObject = JSON.parse(localStorage.getItem("customization") || JSON.stringify(CustomizationProprieties))
		
		loadCssVar(themeObject["colors"], null)
		
		const backgroundWrapper = document.querySelector(".Background")
		const backgroundID = JSON.parse(localStorage.getItem("customization") || JSON.stringify(CustomizationProprieties))["background"]
		
		const backgroundContents = await WebdeskDB.get("_backgrounds", override || backgroundID)
		backgroundWrapper.innerHTML = backgroundContents
	})() }
}

const WindowManager = new class WindowManagerClass {
	// Contains the Assets Window to Clone when Opening a New Window
	assetsWindow = document.getElementsByName("Window")[0]
	// Contains the Space where to spawn Windows when Opening One
	windowSpace = document.querySelector(".Window.Space")
	// Public Channel where to send Commands to have the WM Act on
	windowCommandChannel = new BroadcastChannel("wm/commands")

	// Pairs a open window with its boundry box
	windowsBoundryBoxes = new WeakMap()

	// Used for interpreting mouse movements during a window resize
	grabPos = [ false, false, false, false ]

	resizingWindow = null
	movingWindow = null
	focusedWindow = null

	// Contains the offsets to remove from a mouse click during a window movement
	clickOffsets = []
	// Increasing counter to keep track of different windows
	windowID = 0

	openWindow(event) {
		// Spawns a window and sets all the appropriate proprieties also maps the newly opened window in 'windowsBoundryBoxes'
		const appWindow = assetsWindow.cloneNode(true)
		const appName = event.target.closest(`[name="Launcher"]`).getAttribute("app")

		// Add the Interaction Event Listeners for the different window Elements
		appWindow.addEventListener("mousedown", windowInteraction)
		appWindow.querySelector(".Titlebar").addEventListener("mousedown", enableMovement)
		appWindow.querySelector(".Close").addEventListener("click", (event) => { closeWindow(event.target.closest(`[name="Window"]`)) })
		appWindow.querySelector(".Minimize").addEventListener("click", (event) => { minimizeWindow(event.target.closest(`[name="Window"]`)) })
		appWindow.querySelector(".Maximise").addEventListener("click", (event) => { maximiseWindow(event.target.closest(`[name="Window"]`)) })

		// Set all the elements' values
		appWindow.setAttribute("app", appName)
		appWindow.setAttribute("id", windowID)

		appWindow.querySelector("iframe").src = `apps/${appName}/?${windowID}`
		appWindow.querySelector(".Icon").src = `apps/${appName}/icon`
		appWindow.querySelector(".Title").innerText = appName

		// Add the new window to the window space
		windowSpace.appendChild(appWindow)

		// Send the event
		windowID++
		Utilities.WINDOW_OPEN.emit(getWindowInfo(appWindow))

		// !!! !!! !!!
		// DEBUG !!! !!! !!!
		if (appName == "settings") appWindow.querySelector(".Maximise").dispatchEvent(new Event("click"))
	}

	closeWindow(appWindow) {
		// Closes an Open Window
		// Remove the Window from the Boundry Boxes Map
		windowsBoundryBoxes.delete(appWindow)

		// Remoes the Window
		setTimeout(() => { appWindow.remove() }, 100)

		// Send a Event
		Utilities.WINDOW_CLOSE.emit(getWindowInfo(appWindow))
	}

	maximiseWindow(appWindow) {
		// Handles the Maximising and un-Maximising of Windows
		if (!appWindow.classList.contains("maximised")) {
			appWindow.classList.add("maximised")
			WINDOW_MAXIMISE.emit(getWindowInfo(appWindow))
		} else {
			appWindow.classList.remove("maximised")
			WINDOW_MAXIMISE_END.emit(getWindowInfo(appWindow))
		}
	}

	minimizeWindow(appWindow) {
		// Handles the Minimising of Windows
		appWindow.classList.add("minimized")
		Utilities.WINDOW_MINIMISE.emit(getWindowInfo(appWindow))
	}

	centerNewWindow(details) {
		// Get the new window bounding box
		const boundingBox = details.target.getBoundingClientRect()
		windowsBoundryBoxes.set(details.target, boundingBox)

		// Calculate the exact center for the new window
		boundingBox.x = ( window.innerWidth - boundingBox.width ) / 2
		boundingBox.y = ( window.innerHeight - boundingBox.height ) / 2

		// Apply the transform
		details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
	}

	enableMovement(event) {
		// Register the window for movement
		const appWindow = event.target.closest(`[name="Window"]`)
		
		// If the click Landed on a Button, ignore it
		// If the user is trying to move a Maximised Window, ignore it
		if (event.target.tagName === "BUTTON") return
		else if (appWindow.classList.contains("maximised")) return

		// Set the target as the Moving Window
		movingWindow = appWindow

		// Save the click Offsets
		clickOffsets = [ event.x , event.y ]
		// Add the "moving" class to the target
		appWindow.classList.add("moving")

		// Emit the Window Move Event
		Utilities.WINDOW_MOVE.emit(getWindowInfo(appWindow))
	}

	moveWindow(moveEvent) {
		// Move the window applying the current mouse position - the click offset + the old position
		if (!movingWindow) return
		
		// Calculate the Translate values of the Move
		const xPos = moveEvent.x - clickOffsets[0] + windowsBoundryBoxes.get(movingWindow).x
		const yPos = moveEvent.y - clickOffsets[1] + windowsBoundryBoxes.get(movingWindow).y

		// Set the Translate values
		movingWindow.style.transform = `translate(${xPos}px,${yPos}px)`
	}

	updatePositionBasedOnViewportCollision(details) {
		// Checks if the current window is in a valid position inside webdesk and corrects it if needed
		const boundingBox = details.target.getBoundingClientRect()

		if (boundingBox.right > window.innerWidth) boundingBox.x = ( window.innerWidth - boundingBox.width ) // If the window is beyond the right of the screen, move the window back to the edge
		else if (boundingBox.left < 0) boundingBox.x = 0 // If the window is beyond the left of the screen, move the window back to the edge

		if (boundingBox.bottom > window.innerHeight) boundingBox.y = ( window.innerHeight - boundingBox.height ) // If the window is beyond the bottom of the screen, move the window back to the edge
		else if (boundingBox.top < 0) boundingBox.y = 0 // If the window is beyond the top of the screen, move the window back to the edge

		// Update the Window Translate values and Boundry Box
		details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
		windowsBoundryBoxes.set(details.target, boundingBox)
	}

	windowInteraction(event) {
		// Checks where the user clicked in a Window and enables resizing
		if (event.target.getAttribute("name") == "Window") {
			// Get the Window Bounding Box of the Clicked Window
			const boundingBox = windowsBoundryBoxes.get(event.target)
			// Save the click offsets
			clickOffsets = [ event.x, event.y ]

			// Calculate where Inside the Window the User Clicked
			const relClickX = clickOffsets[0] - boundingBox.x
			const relClickY = clickOffsets[1] - boundingBox.y

			// Update the Window Grab Position
			grabPos = [
				(relClickY <= 6), // Top
				(boundingBox.width - relClickX <= 6), // Left
				(boundingBox.height - relClickY <= 6), // Bottom
				(relClickX <= 6) // Right
			]

			// If the user Clicked on the Left or Right Edge
			if (grabPos[1] || grabPos[3]) { event.target.classList.add("resizeX") }
			// If the user Clicked on the Top or Bottom Edge
			if (grabPos[0] || grabPos[2]) { event.target.classList.add("resizeY") }

			// If the user clicked on the Top-Right or the Bottom-Left
			if (grabPos[0] && grabPos[3] || grabPos[1] && grabPos[2]) { event.target.classList.add("resizeXY1") }
			// If the user clicked on the Top-Left or the Bottom-Right
			else if (grabPos[0] && grabPos[1] || grabPos[2] && grabPos[3]) { event.target.classList.add("resizeXY2") }

			// Set the Resizing Target and emit the Event
			resizingWindow = event.target
			Utilities.WINDOW_RESIZE.emit(getWindowInfo(resizingWindow))
		}
	}

	resizeWindow(moveEvent) {
		// Interprets where a user clicked and runs the appropriate rescaling of a Window
		if (!resizingWindow) return

		// Get the Resizing Window Boundry Box
		const boundingBox = windowsBoundryBoxes.get(resizingWindow)

		if (grabPos[0] && grabPos[3]) { // Top Right corner special treatment
			resizingWindow.style.transform = `translate(${boundingBox.x + moveEvent.x - clickOffsets[0]}px,${boundingBox.y + moveEvent.y - clickOffsets[1]}px)`
			resizingWindow.style.height = `${boundingBox.height - moveEvent.y + clickOffsets[1]}px`
			resizingWindow.style.width = `${boundingBox.width - moveEvent.x + clickOffsets[0]}px`
			return
		}

		if (grabPos[0]) {
			resizingWindow.style.transform = `translate(${boundingBox.x}px,${boundingBox.y + moveEvent.y - clickOffsets[1]}px)`
			resizingWindow.style.height = `${boundingBox.height - moveEvent.y + clickOffsets[1]}px`
		} else if (grabPos[2]) { resizingWindow.style.height = `${boundingBox.height + moveEvent.y - clickOffsets[1]}px` }

		if (grabPos[3]) {
			resizingWindow.style.transform = `translate(${boundingBox.x + moveEvent.x - clickOffsets[0]}px,${boundingBox.y}px)`
			resizingWindow.style.width = `${boundingBox.width - moveEvent.x + clickOffsets[0]}px`
		} else if (grabPos[1]) { resizingWindow.style.width = `${boundingBox.width + moveEvent.x - clickOffsets[0]}px` }
	}

	focusWindow(details) {
		// Makes a window go in focus
		if (details.target != focusedWindow) {
			for (openAppWindow of document.getElementsByName("Window")) {
				openAppWindow.classList.remove("focus")
				const zIndex = parseInt(openAppWindow.style.zIndex)
				if (zIndex > 20) { openAppWindow.style.zIndex = zIndex - 1 }
			}

			focusedWindow = details.target
			focusedWindow.classList.add("focus")
			focusedWindow.style.zIndex = 29

			Utilities.WINDOW_CHANGED_FOCUS.emit(getWindowInfo(details.target))
		}
	}

	shiftWindowFocus(details) {
		for (openAppWindow of document.getElementsByName("Window")) {
			openAppWindow.classList.remove("focus")
			const zIndex = parseInt(openAppWindow.style.zIndex)
			if (zIndex < 29) { openAppWindow.style.zIndex = zIndex + 1 }
			if (zIndex == 28) { openAppWindow.classList.add("focus") }
		}
		}

	checkAllViewportCollisions() {
		// When the Viewport gets Resized, Update all the Collisions and window Sizes
		for (appWindow of document.getElementsByName("Window")) { updatePositionBasedOnViewportCollision(appWindow) }
	}

	appWindowMovementEnd() {
		// Handles the End of a Window Movement
		if (!movingWindow) return

		// Remove Classes
		movingWindow.classList.remove("moving")

		// Emit the Move End Event and remove the move Target
		Utilities.WINDOW_MOVE_END.emit(getWindowInfo(movingWindow))
		movingWindow = null
	}

	appWindowResizeEnd(event) {
		// Handles the End of a Window Resizing
		if (!resizingWindow) return

		// Reset User Grab Position
		grabPos = [ false, false, false, false ]

		// Remove Classes
		resizingWindow.classList.remove("resizeY")
		resizingWindow.classList.remove("resizeX")
		resizingWindow.classList.remove("resizeXY1")
		resizingWindow.classList.remove("resizeXY2")

		// Emit the Resize End Event and remove the resize Target
		WINDOW_RESIZE_END.emit(getWindowInfo(resizingWindow))
		resizingWindow = null
	}

	windowCommandChannelHandler(event) {
		// Handles the commands coming from the windows
		const command = event.data.split(" ")
		switch(command[0]) {
			case "close":
				const appWindow = windowSpace.querySelector(`div[id="${command[1]}"]`)
				return closeWindow(appWindow)
		}
	}

	constructor() {
		Utilities.WINDOW_OPEN.on([centerNewWindow, focusWindow])
		Utilities.WINDOW_CLOSE.on([shiftWindowFocus])

		Utilities.WINDOW_MOVE.on([focusWindow])
		Utilities.WINDOW_MOVE_END.on([updatePositionBasedOnViewportCollision])

		Utilities.WINDOW_RESIZE.on([focusWindow])
		Utilities.WINDOW_RESIZE_END.on([updatePositionBasedOnViewportCollision])

		windowCommandChannel.addEventListener("message", windowCommandChannelHandler)

		document.addEventListener("mousemove", moveWindow)
		document.addEventListener("mousemove", resizeWindow)

		document.addEventListener("mouseup", appWindowMovementEnd)
		document.addEventListener("mouseup", appWindowResizeEnd)

		window.addEventListener("resize", checkAllViewportCollisions)
	}
}

const Animations = new class AnimationClass {
	removeClassTimeout = undefined

	windows = {
		openAnimation: (details) => {
			// Window Open Animation Function
			// Add the animation class
			details.target.classList.add("opening")

			// Remove the animation class
			setTimeout(() => details.target.classList.remove("opening"), 100)
		},

		toMaximisedAnimation: (details) => {
			// Window Maximising Animation Function
			// Add the animation class
			details.target.classList.add("to-maximised")

			// Remove the animation class
			setTimeout(() => { details.target.classList.remove("to-maximised") }, 100)
		},

		fromMaximisedAnimation: (details) => {
			// Window From Maximised Animation Function
			// Add the animation class
			details.target.classList.add("from-maximised")

			// Remove the animation class
			setTimeout(() => { details.target.classList.remove("from-maximised") }, 100)
		},

		toMinimisedAnimation: (details) => {
			// Window Minimising Animation Function
			// Add the animation class
			details.target.classList.add("to-minimised")

			// Remove the animation class
			setTimeout(() => { details.target.classList.remove("to-maximised") }, 100)
		},

		fromMinimisedAnimation: (details) => {
			// Window From Minimised Animation Function
			// Add the animation class
			details.target.classList.add("from-minimised")

			// Remove the animation class
			setTimeout(() => { details.target.classList.remove("from-minimised") }, 100)
		},

		closeAnimation: (details) => {
			// Window Closing Animation Function
			details.target.classList.add("closing")
		},
	}

	appdock = {
		windowMaximisedAnimation: () => {
			// Animation assist class for the appDock when there is a maximised window
			showAppDockAnimation()
			clearTimeout(removeClassTimeout)
			if (!appDock.matches(":hover")) removeClassTimeout = setTimeout(hideappDock, 2500)
		},

		hideAnimation: () => {
			// Handles the hiding of the App Dock
			appDock.classList.remove("up")
		},

		showAnimation: () => {
			// Handles the showing of the App Dock
			appDock.classList.add("up")
		},

		icons: {
			openAnimation: (details) => {
				// Adding a Dock Icon Animation Function
			},

			closeAnimation: (details) => {
				// Removing a Dock Icon Animation Function
			},

			focusAnimation: (details) => {
				// Focus Changed Dock Icon Animation Function
			},
		},
	}

	constructor() {
		Utilities.WINDOW_OPEN.on([this.windows.openAnimation, this.appdock.icons.openAnimation])
		Utilities.WINDOW_CLOSE.on([this.windows.closeAnimation, this.appdock.icons.closeAnimation])

		Utilities.WINDOW_CHANGED_FOCUS.on([this.appdock.icons.focusAnimation])

		Utilities.WINDOW_MAXIMISE.on([this.windows.toMaximisedAnimation, this.appdock.hideAnimation])
		Utilities.WINDOW_MAXIMISE_END.on([this.windows.fromMaximisedAnimation, this.appdock.showAnimation])

		Utilities.WINDOW_MINIMISE.on([this.windows.toMinimisedAnimation])
		Utilities.WINDOW_MINIMISE_END.on([this.windows.fromMinimisedAnimation])
	}
}