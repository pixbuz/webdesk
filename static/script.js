/// <reference lib="dom" />

// Window proprieties inside utilities replacing window boundry boxes and window dock icon map
// Customization for the Titlebar compiler's event listeners and callback functions

let newUser = false

// Custom webdesk event constructor
const WebdeskEvent = class {
	constructor(eventTemplate = {}) {
		this.name = Math.random()
				.toString(36)
				.substring(2)
		this.template = eventTemplate
	}
	// Used to trigger an event
	emit(data = {}) {
		// Merge the template with the passed data
		const details = { ...this.template, ...data }
		// Create the event
		const event = new CustomEvent(this.name, {
			detail: details,
			bubbles: true,
			composed: true
		})
		// Dispatch the event
		window.dispatchEvent(event)
	}
	// Binds multiple functions to a webdesk event
	on(callBackFunctions = [], oneTime = false) {
		// For every function passed
		callBackFunctions.map((callBackFunction) => {
			// Add an event listener for the event
			window.addEventListener(this.name, (event) => { callBackFunction(event.detail) }, { once: oneTime })
		})
	}
}

var Utilities = new class {
	// App manifests
	manifests
	// Contains all the template objects for the events
	templates = {
		MANIFEST: {},
		LAUNCHER: {
			app: null,
		},
		READY: {
			target: null,
			app: null,
		},
		WINDOW: {
			target: null,
			app: null,
		},
		CLOCK: {
			target: [ ],
		},
		INTERACTION: {
			target: null,
			pID: null,
			x: null,
			y: null,
		}
	}
	events = {
		MANIFESTS_READY: new WebdeskEvent(this.templates.MANIFEST),

		LAUNCHER_CLICK: new WebdeskEvent(this.templates.LAUNCHER),

		TITLEBAR_LOADED: new WebdeskEvent(this.templates.READY),
		TITLEBAR_READY: new WebdeskEvent(this.templates.READY),

		WINDOW_READY: new WebdeskEvent(this.templates.READY),

		WINDOW_CLICK: new WebdeskEvent(this.templates.INTERACTION),

		WINDOW_MOVE_START: new WebdeskEvent(this.templates.INTERACTION),
		WINDOW_MOVE: new WebdeskEvent(this.templates.INTERACTION),
		WINDOW_MOVE_END: new WebdeskEvent(this.templates.INTERACTION),

		WINDOW_RESIZE_START: new WebdeskEvent(this.templates.INTERACTION),
		WINDOW_RESIZE: new WebdeskEvent(this.templates.INTERACTION),
		WINDOW_RESIZE_END: new WebdeskEvent(this.templates.INTERACTION),

		WINDOW_OPEN: new WebdeskEvent(this.templates.WINDOW),
		WINDOW_CLOSE: new WebdeskEvent(this.templates.WINDOW),

		WINDOW_UPDATED_FOCUS: new WebdeskEvent(this.templates.WINDOW),
		
		WINDOW_MAXIMISE: new WebdeskEvent(this.templates.WINDOW),
		WINDOW_MAXIMISE_END: new WebdeskEvent(this.templates.WINDOW),

		WINDOW_MINIMISE: new WebdeskEvent(this.templates.WINDOW),
		WINDOW_MINIMISE_END: new WebdeskEvent(this.templates.WINDOW),

		CLOCK_UPDATE: new WebdeskEvent(this.templates.CLOCK),
	}
	// Time
	time = {
		// Get the client start time
		init: null,
		// Clock
		seconds: 0,
		minutes: 0,
		hours: 0,
		// Date
		day: 0,
		month: 0,
		year: 0,
		// Adds 1 second to the clock every second
		progress() {
			// Track what changed to smartly update the elements
			const changed = [ "seconds" ]
			// Add a second
			Utilities.time.seconds++

			// If the seconds hit 60
			if (Utilities.time.seconds >= 60) {
				// Set them to 0 and add a minute
				Utilities.time.seconds = 0
				Utilities.time.minutes++

				// Track the change for the event
				changed.push("minutes")
			}

			// If the minutes hit 60
			if (Utilities.time.minutes >= 60) {
				// Set them to 0 and add an hour
				Utilities.time.minutes = 0
				Utilities.time.hours++

				// Track the change for the event
				changed.push("hours")
			}

			// If the hours hit 24
			if (Utilities.time.hours >= 24) {
				// Set them to 0 and add a day
				Utilities.time.hours = 0
				Utilities.time.day++

				// Track the change for the event
				changed.push("day")
			}

			// Send the event
			Utilities.events.CLOCK_UPDATE.emit({ target: changed })
		}
	}
	// Simplifies IndexDB interactions
	// TODO: Remove blocking logic
	webdeskDB = {
		// Helper for the main functions for interacting with the database
		async _run(tableName, mode, callback) {
			// Wait for no operations on the Database
			await Utilities.webdeskDB.updateLock
		
			// Get the newest connection for the Database
			const database = await Utilities.webdeskDB.ready
		
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
		},
		// Get a key's value from a table
		get(table, key) {
			return Utilities.webdeskDB._run(table, 0, (store) => { return store.get(key) })
		},
		// Get all the values from all the keys of a table
		getAll(table) {
			return Utilities.webdeskDB._run(table, 0, (store) => { return store.getAll() })
		},
		// Set the value of a key inside a table
		set(table, key, value) {
			return Utilities.webdeskDB._run(table, 1, (store) => { return store.put(value, key) })
		},
		// Delete a key inside a table
		delete(table, key) {
			return Utilities.webdeskDB._run(table, 1, (store) => { return store.delete(key) })
		},
		async createTable(tableName) {
			// Adds new Tables into the Database
			// Wait for the old operation lock and set the new operation lock to:
			Utilities.webdeskDB.updateLock = Utilities.webdeskDB.updateLock.then(async () => {
				// Wait for the database
				const database = await Utilities.webdeskDB.ready
				
				// If table exists do nothing
				if (database.objectStoreNames.contains(tableName)) { return }
			
				// Close the Database
				database.close()
				console.log(`Closing Database to create table "${tableName}"`)
			
				// Block any Database operations now that it is closed
				let resolveNewDb
				Utilities.webdeskDB.ready = new Promise((resolve) => { resolveNewDb = resolve })
			
				return new Promise((resolve, reject) => {
					// Up the Database version
					const req = indexedDB.open("webdesk", ++Utilities.webdeskDB.version)
				
					// Before the Database Opens, add the new table
					req.onupgradeneeded = (event) => {
						const database = event.target.result
					
						if (!database.objectStoreNames.contains(tableName)) { database.createObjectStore(tableName) }
					}
				
					// When the Database Opens, resolve all Promises
					req.onsuccess = (event) => {
						const database = event.target.result
						database.onversionchange = () => { database.close() }
						
						localStorage.setItem("db-version", Utilities.webdeskDB.version)
					
						resolveNewDb(database)
						resolve()
					}
				
					req.onblocked = req.onerror = (event) => reject(event)
				})
			})
		
			return Utilities.webdeskDB.updateLock
		}
	}
	inits = {
		// Allows registering functions to multiple events
		monkeyPatch() {
			// Binds a function to multiple webdesk events
			Function.prototype.onEvent = function(...eventsList) {
				// For every event passed, register the function to it
				eventsList.map((event) => { event.on([this]) })

				return this
			}
		},
		// Initializes the time
		time() {
			// Save the start date object
			this.time.init = new Date()

			// Set the initial values for the clock
			this.time.seconds = this.time.init.getSeconds()
			this.time.minutes = this.time.init.getMinutes()
			this.time.hours = this.time.init.getHours()

			// Set the initial values for the date
			this.time.day = this.time.init.getDate()
			this.time.month = this.time.init.getMonth() + 1
			this.time.year = this.time.init.getFullYear()

			// "Nullify" the start time offset by updating the clock every 1.000s
			setTimeout(() => {
				// Progress the time by 1 second
				Utilities.time.progress()
				// Set an interval to progress the clock every second
				setInterval(Utilities.time.progress, 1000)
			}, 1000 - this.time.init.getMilliseconds())
		},
		// Initialize the IndexDB database
		webdeskDB() {
			// Get the last version of the database
			const dbVersion = localStorage.getItem("db-version")
			// If there is no item in local storage called "db-version", initialize
			if (dbVersion == undefined) {
				this.webdeskDB.version = 1
				localStorage.setItem("db-version", 1)
				newUser = true
			} else { this.webdeskDB.version = parseInt(dbVersion) }

			// Stops any db interaction in case of db updating
			this.webdeskDB.ready = new Promise((resolve, reject) => {
				// Send the db open request
				const req = indexedDB.open("webdesk", this.webdeskDB.version)
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
			this.webdeskDB.updateLock = Promise.resolve()
		},
		// Fetches all the application manifests
		// TODO: Auto cache manifests to service woerker level(?)
		apps() {
			fetch("/api/_/manifest").then(async (response) => {
				this.manifests = await response.json()
				Utilities.events.MANIFESTS_READY.emit(this.manifests)
			})
		}
	}
	// Utility method to get the information of a window
	getWindowInfo(webdeskWindow) {
		return { target: webdeskWindow, app: webdeskWindow.getAttribute("app") }
	}

	constructor() {
		for (const initFunction of Object.values(this.inits)) {
			initFunction.bind(this)()
		}
	}
}

const LauncherManager = new class {
	// Launchers space
	space = document.querySelector(".Launcher.Space")

	// Adds an app launcher to the desktop
	addLauncher(appName, manifest) {
		// Create the new launcher element
		const launcher = document.createElement("button")
		// Create the name element
		const title = document.createElement("span")
		// Create the icon element
		const icon = document.createElement("img")

		// Set the app the launcher opens
		launcher.setAttribute("launcher", appName)
		// Set the hover description of the launcher
		launcher.setAttribute("title", manifest.description == "undefined" ? appName : manifest.description)

		// Add the name element class
		title.classList.add("name")
		// Set the launcher name
		title.innerText = appName

		// Add the icon element class
		icon.classList.add("icon")
		// Set the launcher icon
		icon.src = `/apps/${appName}/${manifest.icon}`

		// Add the name and icon to the launcher
		launcher.append(icon, title)
		// Add the new launcher to the desktop
		this.space.appendChild(launcher)

		// When clicked, dispatch the LAUNCHER_CLICK event
		launcher.addEventListener("click", () => { Utilities.events.LAUNCHER_CLICK.emit({ app: appName }) })
	}
	// Adds every installed app launcher once the manifests load
	initLaunchers(details) {
		// Sort the keys to have the same app order every visit
		for (const appName of Object.keys(details).sort()) {
			LauncherManager.addLauncher(appName, details[appName])
		}
	}

	constructor() {
		Utilities.events.MANIFESTS_READY.on([this.initLaunchers])
	}
}

const WindowManager = new class {
	// Space for new windows
	space = document.querySelector(".Window.Space")
	create = {
		// Assembles a webdesk window
		async skeletonizeWindow(details, emit = true) {
			// Contains the application manifest
			const manifest = Utilities.manifests[details.app]

			const windowSkeleton = document.createElement("article"),	// Make the wrapping element for the window
				contentWrapper = document.createElement("section"),	// Make the iframe wrapper element
				titlebarWrapper = document.createElement("header"),	// Make the titlebar element
				content = document.createElement("iframe"),	// Make the app content iframe
				titlebar = document.createElement("iframe")	// 创建标题栏 iframe

			// Fix the aesthetic of the iframes
			content.setAttribute("frameborder", 0)
			titlebar.setAttribute("frameborder", 0)

			// Show the index page of the app
			content.src = `/apps/${details.app}/${manifest.index}`

			// If the app has no custom titlebar, set the default one
			if (manifest.titlebar.path != "") { titlebar.src = `/apps/${appName}/${manifest.titlebar.path}` }
			else { titlebar.src = `/api/_/titlebar` }

			// Setup the titlebar
			titlebar.addEventListener("load", WindowManager.create.setupTitlebar, { once: true })

			// Wrap the iframes
			contentWrapper.append(content)
			titlebarWrapper.append(titlebar)

			// Add the iframes classes
			content.classList.add("content")
			titlebar.classList.add("titlebar")

			// Nest the titlebar and content wrapper in the window
			windowSkeleton.append(titlebarWrapper, contentWrapper)

			// When the focus is shifted, update own z index
			Utilities.events.WINDOW_UPDATED_FOCUS.on([() => { WindowManager.basic.updateZIndex(windowSkeleton) }])

			// When a click happens inside a window, start resizing
			windowSkeleton.addEventListener("pointerdown", (event) => {
				windowSkeleton.setPointerCapture(event.pointerId)

				Utilities.events.WINDOW_RESIZE_START.emit({ target: windowSkeleton, x: event.x, y: event.y })
			})
			
			// Resize the window when the user moves the pointer
			windowSkeleton.addEventListener("pointermove", (event) => { Utilities.events.WINDOW_RESIZE.emit({ target: windowSkeleton, x: event.x, y: event.y }) })
			
			// Stop the resizing when the user releases the pointer
			windowSkeleton.addEventListener("pointerup", (event) => {
				windowSkeleton.releasePointerCapture(event.pointerId)

				Utilities.events.WINDOW_RESIZE_END.emit({ target: windowSkeleton, x: event.x, y: event.y })
			})
			// Set the app name
			windowSkeleton.setAttribute("app", details.app)

			// Add the window to the window space
			WindowManager.space.appendChild(windowSkeleton)

			// Dispatch the event
			// TODO: make sure it works for the intro window
			if (emit) { Utilities.events.WINDOW_OPEN.emit({ app: details.app, target: windowSkeleton }) }
			else { return windowSkeleton }
		},
		// Setup the titlebar
		// TODO: Perhaps make it so the favicon is the titlebar icon like the <title> is the title
		async setupTitlebar(event) {
			const titlebar = event.target
			const targetWindow = event.target.closest("[app]")
			const content = targetWindow.querySelector(".content")
			const appName = targetWindow.getAttribute("app")
			const manifest = Utilities.manifests[appName]
			const iframeDocument = titlebar.contentDocument

			// If the titlebar is the default one, add the icon
			if (manifest.titlebar.path == "") {
				if (iframeDocument.querySelector(".icon")) { iframeDocument.querySelector(".icon").src = `/apps/${appName}/${manifest.icon}` }
			}
			
			// Send an event when the user clicks in the titlebar
			iframeDocument.body.addEventListener("pointerdown", (event) => {
				// If the element clicked is a button, ignore the mousedown
				if (event.target.tagName === "BUTTON") { return }

				targetWindow.classList.add("moving")
				iframeDocument.body.setPointerCapture(event.pointerId)

				// Emit the event
				Utilities.events.WINDOW_MOVE_START.emit({ x: event.screenX, y: event.screenY, target: targetWindow, pID: event.pointerId })
			})
			
			// Send an event when the user moves
			iframeDocument.body.addEventListener("pointermove", (event) => { Utilities.events.WINDOW_MOVE.emit({ x: event.screenX, y: event.screenY, target: targetWindow, pID: event.pointerId }) })
			
			// Send an event when releases the click in the titlebar
			iframeDocument.body.addEventListener("pointerup", (event) => {
				targetWindow.classList.remove("moving")
				iframeDocument.body.releasePointerCapture(event.pointerId)

				// Emit the event
				Utilities.events.WINDOW_MOVE_END.emit({ x: event.screenX, y: event.screenY, target: targetWindow, pID: event.pointerId })
			})
			// If the titlebar has a title, add the app name
			if (iframeDocument.querySelector(".title")) {
				iframeDocument.querySelector(".title").innerText = content.contentDocument.title
			}
			// If there is a close button, make it close the window
			if (iframeDocument.querySelector(".close")) {
				iframeDocument.querySelector(".close").addEventListener("click", () => { WindowManager.basic.closeWindow(targetWindow) })
			}
			// If there is a maximise button, make it maximise the window
			if (iframeDocument.querySelector(".maximise")) {
				iframeDocument.querySelector(".maximise").addEventListener("click", () => { WindowManager.basic.maximiseWindow(targetWindow) })
			}
			// If there is a minimise button, make it minimise the window
			if (iframeDocument.querySelector(".minimise")) {
				iframeDocument.querySelector(".minimise").addEventListener("click", () => { WindowManager.basic.minimiseWindow(targetWindow) })
			}
			if (manifest.titlebar.dynamic) {
				titlebar.addEventListener("load", () => { iframeDocument.querySelector(".title").innerText = content.contentDocument.title })
			}
		}
	}
	basic = {
		maximisedPos: { x: null, y: null },
		// Closes a window
		closeWindow(targetWindow) {
			// Removes the window
			// setTimeout(() => { targetWindow.remove() }, 100)
			targetWindow.remove()
			// Send the close a event
			Utilities.events.WINDOW_CLOSE.emit(Utilities.getWindowInfo(targetWindow))
		},
		// Handles the maximising of windows
		// TODO: Understand why the translate goes to 0px when un maximising and fix
		maximiseWindow(targetWindow) {
			// If the window is maximised
			if (targetWindow.classList.contains("maximised")) {
				// Remove the maximised class and send the end maximised event
				targetWindow.classList.remove("maximised")
				targetWindow.style.transform = `translate(${WindowManager.basic.maximisedPos.x}px,${WindowManager.basic.maximisedPos.y}px)`
				Utilities.events.WINDOW_MAXIMISE_END.emit(Utilities.getWindowInfo(targetWindow))
			} else {
				// Add the maximised class and send the start maximised event
				targetWindow.classList.add("maximised")
				const pos = targetWindow.style.transform.slice(10, -3).replace("px", "").split(",")
				WindowManager.basic.maximisedPos = { x: pos[0], y: pos[1] }
				targetWindow.style.transform = ""

				Utilities.events.WINDOW_MAXIMISE.emit(Utilities.getWindowInfo(targetWindow))
			}
		},
		// Handles the minimising of windows
		minimiseWindow(targetWindow) {
			// Remove the maximised class
			targetWindow.classList.remove("maximised")
			// If the window is minimised
			if (targetWindow.classList.contains("minimized")) {
				// Remove the minimised class and send the end minimised event
				targetWindow.classList.remove("minimized")
				Utilities.events.WINDOW_MINIMISE_END.emit(Utilities.getWindowInfo(targetWindow))
			} else {
				// Add the minimised class and send the start minimised event
				targetWindow.classList.add("minimized")
				Utilities.events.WINDOW_MINIMISE.emit(Utilities.getWindowInfo(targetWindow))
			}
		},
		// Makes a window the "active" window
		focusWindow(details) {
			// Get the focused window
			const currentFocusedWindow = WindowManager.space.querySelector(".focus")
			// If the focused window isn't the target window, update the focus
			if (currentFocusedWindow != details.target) {
				// Hack when there is only one window open and it needs the focus
				(currentFocusedWindow || details.target).classList.remove("focus")
				// Add focus class
				details.target.classList.add("focus")
				// Emit focus update event
				Utilities.events.WINDOW_UPDATED_FOCUS.emit(details)
			}
		},
		// Updates a window z-index, runs everytime the focus shifts
		updateZIndex(targetWindow) {
			// Get the current z-index
			const zIndex = parseInt(targetWindow.style.zIndex)
			// If the window is in focus, max the z-index
			// If the z-index is greater that the min z-index, lower it
			if (targetWindow.classList.contains("focus")) { targetWindow.style.zIndex = 29 }
			else if (zIndex > 20) { targetWindow.style.zIndex = zIndex - 1 }
		},
		// When a window is closed, ensure there is one in focus
		shiftFocus(details) {
			// If there is a window in focus, ignore the event call
			if (WindowManager.space.querySelector(".focus")) { return }

			// Target the window with z-index to 28
			const targetWindow = WindowManager.space.querySelector(`[style*="z-index: 28"]`)

			// If there is a window, focus it
			if (targetWindow) {
				targetWindow.classList.add("focus")
				Utilities.events.WINDOW_UPDATED_FOCUS.emit(details)
			}
		}
	}
	move = {
		position: { x: null, y: null },
		// Save the offsets and stuff
		init(details) {
			const box = details.target.getBoundingClientRect()
			WindowManager.move.position = { x: details.x - box.left, y: details.y - box.top }
		},
		// Used to center a newly opened window
		centerWindow(details) {
			// Get the window bounding box
			const boundingBox = details.target.getBoundingClientRect()

			// Calculate and apply the offsets to center the window in the viewport
			details.target.style.transform = `translate(${(window.innerWidth - boundingBox.width) / 2}px,${(window.innerHeight - boundingBox.height) / 2}px)`
		},
		// Moves a window to the cursor
		followCursor(details) {
			const targetWindow = WindowManager.space.querySelector(".moving")
			if (!targetWindow) { return }

			// Update the position
			details.target.style.transform = `translate(${details.x - WindowManager.move.position.x}px,${details.y - WindowManager.move.position.y}px)`
		},
		// Ensures that a window is not clipped by the viewport
		updatePositionIfCollision(details) {
			// Get the target position
			const boundingBox = details.target.getBoundingClientRect()

			// If the window is beyond the right of the screen, move the window back to the edge
			if (boundingBox.right > window.innerWidth) { boundingBox.x = (window.innerWidth - boundingBox.width) }
			// If the window is beyond the left of the screen, move the window back to the edge
			else if (boundingBox.left < 0) { boundingBox.x = 0 }
			// If the window is beyond the bottom of the screen, move the window back to the edge
			if (boundingBox.bottom > window.innerHeight) { boundingBox.y = (window.innerHeight - boundingBox.height) }
			// If the window is beyond the top of the screen, move the window back to the edge
			else if (boundingBox.top < 0) { boundingBox.y = 0 }

			// Translate the window to a safe spot
			details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
		},
		// When the viewport gets resized, update all the collisions and window sizes
		checkAllViewportCollisions() {
			// For all open windows, update the position if clipping the resized viewport
			for (const openWindow of document.querySelectorAll("[app]")) { updatePositionIfCollision(openWindow) }
		},
		// Handles the end of a window movement
		reset(details) {
			details.target.classList.remove("moving")
		}
	}
	resize = {
		// Margin on the edges of a window for triggering the resizing
		resizeMargin: 12,
		// Saves on which edge/s the user clicked
		edges: {},
		offsets: {},
		position: {},
		box: null,
		// Saves the interaction start
		init(details) {
			const box = details.target.getBoundingClientRect()

			// Calculate the offsets of the window
			WindowManager.resize.offsets = {
				top: details.y - box.top,
				right: box.right - details.x,
				bottom: box.bottom - details.y,
				left: details.x - box.left,
			}

			// Update the window grab position
			WindowManager.resize.edges = {
				top: WindowManager.resize.offsets.top <= WindowManager.resize.resizeMargin,
				right: WindowManager.resize.offsets.right <= WindowManager.resize.resizeMargin,
				bottom: WindowManager.resize.offsets.bottom <= WindowManager.resize.resizeMargin,
				left: WindowManager.resize.offsets.left <= WindowManager.resize.resizeMargin,
			}

			// Calculate the window position
			WindowManager.resize.position = {
				top: box.top,
				right: box.right,
				bottom: box.bottom,
				left: box.left,
			}

			// If the user clicked on the top-right or the bottom-left corners
			if (edges.top && edges.right || edges.bottom && edges.left) { details.target.classList.add("resizeXY1", "resizing") }
			// If the user clicked on the top-left or the bottom-right corners
			else if (edges.top && edges.left || edges.bottom && edges.right) { details.target.classList.add("resizeXY2", "resizing") }
			// If the user clicked on the left or right edge
			else if (edges.left || edges.right) { details.target.classList.add("resizeX", "resizing") }
			// If the user clicked on the top or bottom edge
			else if (edges.top || edges.bottom) { details.target.classList.add("resizeY", "resizing") }
		},
		// Interprets where a user clicked and runs the appropriate rescaling of a window
		followCursor(event) {
			// Target the current resizing window
			const resizingWindow = WindowManager.space.querySelector(".resizing")
			// If none, ignore the movement
			if (!resizingWindow) { return }

			let newX = WindowManager.resize.position.left
			let newY = WindowManager.resize.position.top
			let newW = WindowManager.resize.position.right - WindowManager.resize.position.left
			let newH = WindowManager.resize.position.bottom - WindowManager.resize.position.top
		
			// If the user clicked on the top left corner
			if (WindowManager.resize.grabPosition[0] && WindowManager.resize.grabPosition[3]) {
				// Move the window to the bottom right
				resizingWindow.style.transform = `translate(${ WindowManager.resize.box.x + event.x - WindowManager.resize.x }px,${ WindowManager.resize.box.y + event.y - WindowManager.resize.y }px)`
				// Resize the window according to the user movement
				resizingWindow.style.height = `${WindowManager.resize.box.height - event.y + WindowManager.resize.y}px`
				resizingWindow.style.width = `${WindowManager.resize.box.width - event.x + WindowManager.resize.x}px`
				// Ignore the next checks
				return
			}
			
			// If the user clicked on the top edge
			if (WindowManager.resize.grabPosition[0]) {
				// Move the window to the bottom
				resizingWindow.style.transform = `translate(${ WindowManager.resize.box.x }px,${ WindowManager.resize.box.y + event.y - WindowManager.resize.y }px)`
				// Resize the window height
				resizingWindow.style.height = `${ WindowManager.resize.box.height - event.y + WindowManager.resize.y }px`
			}
			// If the user clicked on the bottom edge
			else if (WindowManager.resize.grabPosition[2]) {
				// Resize the window
				resizingWindow.style.height = `${ WindowManager.resize.box.height + event.y - WindowManager.resize.y }px`
			}

			// If the user clicked on the left edge
			if (WindowManager.resize.grabPosition[3]) {
				// Move the window to the left
				resizingWindow.style.transform = `translate(${ WindowManager.resize.box.x + event.x - WindowManager.resize.x }px,${ WindowManager.resize.box.y }px)`
				// Resize the window height
				resizingWindow.style.width = `${ WindowManager.resize.box.width - event.x + WindowManager.resize.x }px`
			}
			// If the user clicked on the right edge
			else if (WindowManager.resize.grabPosition[1]) {
				// Resize the window width
				resizingWindow.style.width = `${ WindowManager.resize.box.width + event.x - WindowManager.resize.x }px`
			}
		},
		// Handles the end of a window resizing
		reset(event) {
			// Target the resizing window
			const resizingWindow = WindowManager.space.querySelector(".resizing")
			// If no resizing window, ignore the mouse up event
			if (!resizingWindow) { return }

			// Remove resize classes
			resizingWindow.classList.remove("resizeX", "resizeY", "resizeXY1", "resizeXY2", "resizing")
		}
	}

	constructor() {
		Utilities.events.LAUNCHER_CLICK.on([this.create.skeletonizeWindow])	// Open a window when a launcher is clicked

		// TODO: Make it toggle-able from settings
		Utilities.events.WINDOW_OPEN.on([this.move.centerWindow.bind(this)])	// Center a window when a window is opened
		Utilities.events.WINDOW_CLOSE.on([this.basic.shiftFocus.bind(this)])	// Move the focus when a window is closed

		Utilities.events.WINDOW_MOVE_START.on([this.move.init])	// Save the offsets when the user clicks on a titlebar
		Utilities.events.WINDOW_MOVE.on([this.move.followCursor])	// Move a window when the user moves the pointer
		Utilities.events.WINDOW_MOVE_END.on([this.move.reset])	// Stop the movement when the user releases the pointer

		Utilities.events.WINDOW_RESIZE_START.on([this.resize.init])	// Save the offsets when the user clicks on a window
		Utilities.events.WINDOW_RESIZE.on([this.resize.followCursor])	// Resize a window when the user moves the pointer
		Utilities.events.WINDOW_RESIZE_END.on([this.resize.reset])	// Stop the resizing when the user releases the pointer

		Utilities.events.WINDOW_RESIZE_START.on([this.resize.init])	// Save the offsets when the user clicks on a window

		Utilities.events.WINDOW_CLICK.on([this.resize.init])	// Check how to resize the window

		this.move.updatePositionIfCollision.bind(this).onEvent(
			Utilities.events.WINDOW_RESIZE_END,	// Make sure a window isn't clipping the viewport after a resize
			Utilities.events.WINDOW_MOVE_END	// Make sure a window isn't clipping the viewport after a movement
		)

		// IDEA: Quick window switching with Utilities.events.WINDOW_MOVE instead of Utilities.events.WINDOW_MOVE_START
		this.basic.focusWindow.bind(this).onEvent(
			Utilities.events.WINDOW_RESIZE_START,	// Focus a window after a resize
			Utilities.events.WINDOW_MOVE_START,	// Focus a window after a movement
			Utilities.events.WINDOW_OPEN	// Focus a window after a window is opened
		)
	}
}

const AppDockManager = new class {
	// Get the App Dock Element
	element = document.querySelector(".AppDock")
	// Get the Clock of inside App Dock
	clock = this.element.querySelector(".Clock")
	// Get the Open Windows element inside App Dock
	open = this.element.querySelector(".Open")

	// Updates the clock (in the frontend)
	updateClockElement(details) {
		// When the clock is updated
		for (const piece of details.target) {
			// Update only the time elements that need updating
			AppDockManager.clock.querySelector(`.${piece}`).innerText = `${Utilities.time[piece]}`.padStart(2, 0)
		}
	}
	// Initialize the clock element
	initClockElement() {
		this.clock.querySelector(".seconds").innerText = `${Utilities.time.seconds}`.padStart(2, 0)
		this.clock.querySelector(".minutes").innerText = `${Utilities.time.minutes}`.padStart(2, 0)
		this.clock.querySelector(".hours").innerText = `${Utilities.time.hours}`.padStart(2, 0)

		this.clock.querySelector(".day").innerText = `${Utilities.time.day}`.padStart(2, 0)
		this.clock.querySelector(".month").innerText = `${Utilities.time.month}`.padStart(2, 0)
		this.clock.querySelector(".year").innerText = `${Utilities.time.year}`
	}
	// Contains all methods for icon managment
	icons = {
		// Add the maximised propriety to an icon
		maximised: {
			add(details) { AppDockManager.open.querySelector(`[icon=${details.app}]`).classList.add("maximised") },
			remove(details) { AppDockManager.open.querySelector(`[icon=${details.app}]`).classList.remove("maximised") }
		},
		// Add the minimised propriety to an icon
		minimised: {
			add(details) { AppDockManager.open.querySelector(`[icon=${details.app}]`).classList.add("minimised") },
			remove(details) { AppDockManager.open.querySelector(`[icon=${details.app}]`).classList.remove("minimised") }
		},
		// Create the icon for a newly opened window
		async add(details) {
			// Create the new icon for the window
			const icon = document.createElement("button")
			const image = document.createElement("img")
			const name = document.createElement("p")

			// Assemble the dock icon element
			icon.append(name, image)

			// Add it to the app dock
			AppDockManager.open.append(icon)

			// Add the necessary event listeners
			icon.addEventListener("click", AppDockManager.icons.focusLinkedWindow)
			// Set the values of the dock icon
			icon.setAttribute("icon", details.app)	// App name
			image.src = `apps/${details.app}/${(await Utilities.manifests)[details.app].icon}`	// App icon
			name.innerText = details.app
		},
		// Removes an icon when the connected window is closed
		updateClosedWindow(details) {
			// Delete the dock icon and remove it from the map
			AppDockManager.open.querySelector(`[icon=${details.app}]`).remove()
		},
		// Updates an icon when the connected window is maximised
		updateMinimisedWindow(details) {
			// Add the class
			AppDockManager.open.querySelector(`[icon=${details.app}]`).classList.add("mini")
		},
		// Focuses the window connected to a dock icon
		focusLinkedWindow(event) {
			// Shifts the Focus on the Linked Window of a Dock Icon
			const appName = event.target.closest(`[icon]`).getAttribute("icon")
			const window = WindowManager.space.querySelector(`[app="${appName}"]`)

			// Removes classes for some reason
			window.classList.remove("minimized")
			window.classList.remove("maximised")
		}
	}
	constructor() {
		this.initClockElement()
		Utilities.events.CLOCK_UPDATE.on([this.updateClockElement])

		Utilities.events.WINDOW_OPEN.on([this.icons.add])
		Utilities.events.WINDOW_CLOSE.on([this.icons.updateClosedWindow])

		// Utilities.events.WINDOW_MINIMISE.on([this.icons.minimised.add])
		// Utilities.events.WINDOW_MINIMISE_END.on([this.icons.maximised.remove])

		// Utilities.events.WINDOW_MAXIMISE.on([this.icons.maximised.add])
		// Utilities.events.WINDOW_MAXIMISE_END.on([this.icons.maximised.remove])
	}
}

const UIManager = new class {
	customID = 0
	backgroundID = 0
	backgroundWrapper = document.querySelector(".Background")

	behaviors = {
		windows: {
			moveSmoothing: null,
			resizeSmoothing: null,
			maximizeSmoothing: null,
			minimizeSmoothing: null,
			closeSmoothing: null,
		},
		launchers: { },
		appdock: {
			autoHide: {
				enabled: null,
				upTime: null,
				upDelay: null,
				downDelay: null,
			},

			hideOnMaximisedWindow: {
				enabled: null,
				upTime: null,
				upDelay: null,
				downDelay: null,
			}
		}
	}

	windows = {
		color: {
			background: "#D8DEE9",
			border: "#4C566A",
			title: "#2E3440",
			dots: "#2E3440",

			buttons: {
				"close": "#D08770",
				"maxi": "#EBCB8B",
				"mini": "#A3BE8C",
			},

			focus: {
				background: "#ECEFF4",
				border: "#2E3440",
				title: "#2E3440",
				dots: "#3B4252",

				buttons: {
					"close": "#D08770",
					"maxi": "#EBCB8B",
					"mini": "#A3BE8C",
				},
			},
		},
		appearance: {
			background: {
				width: null,
				height: null
			},
			titlebar: null,
			border: null,
			title: null,
			icon: null,
			dots: null,

			buttons: {
				close: null,
				maxi: null,
				mini: null,
			},
		}
	}

	launchers = {
		color: {
			text: "#2E3440",
		},
		appearance: {
			text: null
		}
	}

	appdock = {
		color: {
			background: "#4C566A",
			border: "#434C5E",
			text: "#D8DEE9",

			icons: {
				background: "transparent",
			
				focus: {
					background: "transparent",
				},
			
				mini: {
					background: "transparent",
				},
			
				maxi: {
					background: "transparent",
				},
			},
		},
		appearance: {
			border: {
				width: "none",
				style: "solid",
			}
		}
	}
	// Sets up themes in the database
	async firstTimeInit() {
		const theme = {
			windows: this.windows,
			appdock: this.appdock,
			launchers: this.launchers,
			behaviors: this.behaviors
		}

		localStorage.setItem("customization-id", 0)
		localStorage.setItem("backgrounds-id", 0)

		await Utilities.webdeskDB.createTable("_backgrounds")
		await Utilities.webdeskDB.set("_backgrounds", 0, `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="cool"><feTurbulence baseFrequency='0.01' numOctaves="1" result='noise' filterRes="1000"/><feDiffuseLighting in='noise' lighting-color='var(#D8DEE9)' surfaceScale='6'><feDistantLight azimuth='45' elevation='60' /></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#cool)" /></svg>`)

		await Utilities.webdeskDB.createTable("_customizations")
		await Utilities.webdeskDB.set("_customizations", 0, theme)
	}
	// Converts the color proprieties of a theme into css variables
	loadCssVars(root, prefix = "") {
		for (const key of Object.keys(root)) {
			if (root[key] instanceof Object) { this.loadCssVars(root[key], `${prefix ? prefix + "-" : ""}${key}`) }
			else { document.documentElement.style.setProperty(`--${prefix}-${key}`, root[key]) }
		}
	}

	constructor() { (async () => {
		this.customID = parseInt(localStorage.getItem("customization-id")) || 0
		let customization = await Utilities.webdeskDB.get("_customizations", this.customID)

		if (customization) {
			this.appdock = customization.appdock
			this.windows = customization.windows
			this.launchers = customization.launchers
			this.behaviors = customization.behaviors
		} else { await this.firstTimeInit() }

		this.loadCssVars(this.windows, "windows")
		this.loadCssVars(this.appdock, "appdock")
		this.loadCssVars(this.launchers, "launchers")

		this.backgroundID = parseInt(localStorage.getItem("background-id")) || 0
		const backgroundContents = await Utilities.webdeskDB.get("_backgrounds", this.backgroundID || 0)
		this.backgroundWrapper.innerHTML = backgroundContents
	})() }
}

// Manages the service worker
// TODO: Add a versioning system that empties the cache if any server asset is updated
const ServiceWorkerManager = new class {
	// Displays the size of the cache
	loadInformation() {
		navigator.storage.estimate().then(({ usage, quota }) => {
			const usedMB = (usage / 1024 ** 2).toFixed(2)
			const totalMB = (quota / 1024 ** 2).toFixed(2)
			const percentUsed = ((usage / quota) * 100).toFixed(2)

			console.log(`Using ${usedMB} MB out of ${totalMB} MB (${percentUsed}%)`)
		})
	}

	constructor() {
		// Log the service worker information
		this.loadInformation()
		// Register the sw script as the service worker
		navigator.serviceWorker.register("/sw")
			// .then((registration) => { console.log("Service Worker registered successfully!", registration) })
			.catch((error) => { console.error(error) })
	}
}

// Intros the user to webdesk
// TODO: move to titlebar fetching, just make it so the index is the api endpoint and delete the titlebar buttons
if (newUser) {
	const introWindow = WindowManager.basic.skeletonizeWindow({app: "intro"}, false)
	const closeButton = document.createElement("button")
	const buttonsContainer = document.createElement("div")
	const title = document.createElement("h5")

	title.innerText = "Welcome!"

	buttonsContainer.classList.add("buttons")
	buttonsContainer.append(closeButton)
	introWindow.querySelector(".titlebar").append(title, buttonsContainer)

	closeButton.classList.add("close")
	closeButton.addEventListener("click", WindowManager.basic.closeWindow)

	WindowManager.move.centerWindow({target: introWindow})
	WindowManager.basic.focusWindow({target: introWindow})
	introWindow.querySelector("iframe").src = "/api/_/intro"
}