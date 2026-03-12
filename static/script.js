/// <reference lib="dom" />

// Window proprieties inside utilities replacing window boundry boxes and window dock icon map
// Customization for the Titlebar compiler's event listeners and callback functions

var newUser = false

// Custom webdesk event constructor
const WebdeskEvent = class {
	constructor(objectTemplate = {}) {
		this.name = Math.random().toString(36).substring(2)
		this.template = objectTemplate
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

const Utilities = new class {
	// App manifests
	manifests
	// Contains all the template objects for the events
	templates = {
		MANIFEST: {},
		LAUNCHER: {
			app: null,
		},
		READY: {
			app: null,
			target: null,
		},
		WINDOW: {
			id: null,
			app: null,
			target: null,
		},
		CLOCK: {
			target: [ ],
		},
		MOVE: {
			target: null,
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

		WINDOW_MOVE_START: new WebdeskEvent(this.templates.MOVE),
		WINDOW_MOVE: new WebdeskEvent(this.templates.MOVE),
		WINDOW_MOVE_END: new WebdeskEvent(this.templates.MOVE),

		WINDOW_OPEN: new WebdeskEvent(this.templates.WINDOW),
		WINDOW_CLOSE: new WebdeskEvent(this.templates.WINDOW),
		WINDOW_CLICK: new WebdeskEvent(this.templates.WINDOW),

		WINDOW_UPDATED_FOCUS: new WebdeskEvent(this.templates.WINDOW),
		
		WINDOW_MAXIMISE: new WebdeskEvent(this.templates.WINDOW),
		WINDOW_MAXIMISE_END: new WebdeskEvent(this.templates.WINDOW),

		WINDOW_MINIMISE: new WebdeskEvent(this.templates.WINDOW),
		WINDOW_MINIMISE_END: new WebdeskEvent(this.templates.WINDOW),

		WINDOW_RESIZE_START: new WebdeskEvent(this.templates.WINDOW),
		WINDOW_RESIZE: new WebdeskEvent(this.templates.WINDOW),
		WINDOW_RESIZE_END: new WebdeskEvent(this.templates.WINDOW),

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
		return { id: webdeskWindow.getAttribute("id"), target: webdeskWindow, app: webdeskWindow.getAttribute("app") }
	}

	constructor() {
		window.utilities = this

		for (const initFunction of Object.values(this.inits)) { initFunction.bind(this)() }
	}
}

const LauncherManager = new class {
	// Launchers space
	space = document.querySelector(".Launcher.Space")

	// Assembles and adds an app launcher to the desktop
	addLauncher(appName, manifest) {
		const launcher = document.createElement("button"),	// Create the new launcher element
			title = document.createElement("span"),	// Create the name element
			icon = document.createElement("img")	// Create the icon element

		icon.setAttribute("fetchpriority", "high")
		icon.setAttribute("alt", `Application "${appName}"'s icon`)

		// Set the app the launcher opens
		launcher.setAttribute("launcher", appName)
		// Set the hover description of the launcher
		launcher.setAttribute("title", manifest.description == "undefined" ? appName : manifest.description)
		// Assemble the launcher
		launcher.append(icon, title)

		// Set the launcher name
		title.classList.add("name")
		title.innerText = appName

		// Set the launcher icon
		icon.classList.add("icon")
		icon.src = `/apps/${appName}/${manifest.icon}`

		// Add the new launcher to the desktop
		this.space.appendChild(launcher)

		// Dispatch the event
		launcher.addEventListener("click", () => { WebdeskEvent.LAUNCHER_CLICK.emit({ app: appName }) })
	}
	// Adds every installed app launcher once the manifests load
	addLaunchers(details) {
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
	// Tracks the open windows
	open = [ ]

	// Assembles a webdesk window
	async skeletonizeWindow(details) {
		// Contains the application manifest
		const manifest = ApplicationManifests[details.app]

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

		// Set the app name
		windowSkeleton.setAttribute("app", details.app)
		windowSkeleton.classList.add("opening")

		// Nest the titlebar and content wrapper in the window
		windowSkeleton.append(titlebarWrapper, contentWrapper)

		// Add the window to the window space
		// IDEA: Make it so after the iframes loaded the window is added to the window space
		WMFactory.space.appendChild(windowSkeleton)

		// When the focus is shifted, update own z index
		WebdeskEvent.WINDOW_UPDATED_FOCUS.on((details) => { WMFocuser.updateZIndex(details, windowSkeleton) })

		// When a click happens inside a window, start resizing
		windowSkeleton.addEventListener("pointerdown", (event) => {
			windowSkeleton.setPointerCapture(event.pointerId)

			WebdeskEvent.WINDOW_RESIZE_START.emit({ target: windowSkeleton, x: event.x, y: event.y })
		})

		// Resize the window when the user moves the pointer
		windowSkeleton.addEventListener("pointermove", (event) => {
			if (WMResizer.inResize) {
				WebdeskEvent.WINDOW_RESIZE.emit({ target: windowSkeleton, x: event.x, y: event.y })
			}
		})

		// Stop the resizing when the user releases the pointer
		windowSkeleton.addEventListener("pointerup", (event) => {
			windowSkeleton.releasePointerCapture(event.pointerId)

			WebdeskEvent.WINDOW_RESIZE_END.emit({ target: windowSkeleton, x: event.x, y: event.y })
		})

		// When the viewport is resized, check if the window is clipping the viewport and move
		window.addEventListener("resize", () => { WMMover.updatePositionIfCollision({ target: windowSkeleton }) })

		// Add the window to the open windows
		WMFactory.open.push(windowSkeleton)

			// Dispatch the event
			// TODO: make sure it works for the intro window
			if (emit) { Utilities.events.WINDOW_OPEN.emit({ app: details.app, target: windowSkeleton }) }
			else { return windowSkeleton }
		},
		// Setup the titlebar
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

				windowSkeleton.classList.add("moving")
				iframeDocument.body.setPointerCapture(event.pointerId)

				// Emit the event
				Utilities.events.WINDOW_MOVE_START.emit({ x: event.screenX, y: event.screenY, target: windowSkeleton })
			})
			// Send an event when the user moves
			iframeDocument.body.addEventListener("pointermove", (event) => { Utilities.events.WINDOW_MOVE.emit({ x: event.screenX, y: event.screenY, target: windowSkeleton }) })
			// Send an event when releases the click in the titlebar
			iframeDocument.body.addEventListener("pointerup", (event) => {
				windowSkeleton.classList.remove("moving")
				iframeDocument.body.releasePointerCapture(event.pointerId)

				// Emit the event
				Utilities.events.WINDOW_MOVE_END.emit({ x: event.screenX, y: event.screenY, target: windowSkeleton })
			})
			// If the titlebar has a title, add the app name
			if (iframeDocument.querySelector(".title")) {
				iframeDocument.querySelector(".title").innerText = content.contentDocument.title
			}
			// If there is a close button, make it close the window
			if (iframeDocument.querySelector(".close")) {
				iframeDocument.querySelector(".close").addEventListener("click", () => { WindowManager.basic.closeWindow(windowSkeleton) })
			}
			// If there is a maximise button, make it maximise the window
			if (iframeDocument.querySelector(".maximise")) {
				iframeDocument.querySelector(".maximise").addEventListener("click", () => { WindowManager.basic.maximiseWindow(windowSkeleton) })
			}
			// If there is a minimise button, make it minimise the window
			if (iframeDocument.querySelector(".minimise")) {
				iframeDocument.querySelector(".minimise").addEventListener("click", () => { WindowManager.basic.minimiseWindow(windowSkeleton) })
			}
			if (manifest.titlebar.dynamic) {
				titlebar.addEventListener("load", () => { iframeDocument.querySelector(".title").innerText = content.contentDocument.title })
			}
		}
	}
	basic = {
		// Closes a window
		closeWindow(targetWindow) {
			// Stop tracking the window position
			WindowManager.boundryBoxes.delete(targetWindow)
			// Removes the window
			// setTimeout(() => { targetWindow.remove() }, 100)
			targetWindow.remove()
			// Send the close a event
			Utilities.events.WINDOW_CLOSE.emit(Utilities.getWindowInfo(targetWindow))
		},
		// Handles the maximising of windows
		maximiseWindow(targetWindow) {
			// If the window is maximised
			if (targetWindow.classList.contains("maximised")) {
				// Remove the maximised class and send the end maximised event
				targetWindow.classList.remove("maximised")
				Utilities.events.WINDOW_MAXIMISE_END.emit(Utilities.getWindowInfo(targetWindow))
			} else {
				// Add the maximised class and send the start maximised event
				targetWindow.classList.add("maximised")
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
			WebdeskEvent.WINDOW_UPDATED_FOCUS.emit({ old: WMFocuser.focusedWindow, new: targetWindow })
		}

		// Set the highest z-index window as the focused window
		// NOTE: Could be undefined
		WMFocuser.focusedWindow = targetWindow
	}

	constructor() {
		WebdeskEvent.WINDOW_CLOSE.on(this.shiftFocus)	// Move the focus when a window is closed

		WebdeskEvent.WINDOW_RESIZE_START.on(this.focusWindow)
		// IDEA: Quick window switching with WebdeskEvent.WINDOW_MOVE instead of WebdeskEvent.WINDOW_MOVE_START
		WebdeskEvent.WINDOW_MOVE_START.on(this.focusWindow)
		WebdeskEvent.WINDOW_OPEN.on(this.focusWindow)
	}
}

const WMMover = new class {
	// Saves the pointerdown coordinates
	anchor = { x: null, y: null }
	// Flags if a movement is happening
	inMove = false

	// Save the offsets and stuff
	init(details) {
		details.target.classList.add("moving")
		const box = details.target.getBoundingClientRect()

		WMMover.anchor = { x: details.x - box.left, y: details.y - box.top }
		WMMover.inMove = true
	}
	// Used to center a newly opened window
	centerWindow(details) {
		// Get the window bounding box
		const box = details.target.getBoundingClientRect()

		// Calculate and apply the offsets to center the window in the viewport
		details.target.style.transform = `translate(${(window.innerWidth - box.width) / 2}px,${(window.innerHeight - box.height) / 2}px)`
	}
	// Moves a window to the cursor
	followCursor(details) {
		const targetWindow = details.target

		// Update the position
		details.target.style.transform = `translate(${details.x - WMMover.anchor.x}px,${details.y - WMMover.anchor.y}px)`
	}
	// Ensures that a window is not clipped by the viewport
	updatePositionIfCollision(details) {
		// Get the target position
		const box = details.target.getBoundingClientRect()

		// If the window is beyond the right of the screen, move the window back to the edge
		if (box.right > window.innerWidth) { box.x = (window.innerWidth - box.width) }
		// If the window is beyond the left of the screen, move the window back to the edge
		else if (box.left < 0) { box.x = 0 }
		// If the window is beyond the bottom of the screen, move the window back to the edge
		if (box.bottom > window.innerHeight) { box.y = (window.innerHeight - box.height) }
		// If the window is beyond the top of the screen, move the window back to the edge
		else if (box.top < 0) { box.y = 0 }

		// Translate the window to a safe spot
		details.target.style.transform = `translate(${box.x}px,${box.y}px)`
	}
	// Handles the end of a window movement
	reset(details) {
		details.target.classList.remove("moving")
		WMMover.inMove = false
	}

	constructor() {
		// TODO: Make it toggle-able from settings
		WebdeskEvent.WINDOW_OPEN.on(this.centerWindow.bind(this))	// Center a window when a window is opened

		WebdeskEvent.WINDOW_MOVE_START.on(this.init)	// Save the offsets when the user clicks on a titlebar
		WebdeskEvent.WINDOW_MOVE.on(this.followCursor)	// Move a window when the user moves the pointer
		WebdeskEvent.WINDOW_MOVE_END.on(this.reset)	// Stop the movement when the user releases the pointer

		WebdeskEvent.WINDOW_RESIZE_END.on(this.updatePositionIfCollision)	// Make sure a window isn't clipping the viewport after a resize
		WebdeskEvent.WINDOW_MOVE_END.on(this.updatePositionIfCollision)	// Make sure a window isn't clipping the viewport after a movement
	}
}

// Contains methods called for a window interaction
const WMResizer = new class {
	box = null
	// Saves on which edge/s the user clicked
	edges = { }
	anchor = { x: null, y: null }
	// Margin on the edges of a window for triggering the resizing
	// TODO: Actually make this margin work and settable from settings
	resizeMargin = 12
	// Flags if a resize is happening
	inResize = false

	// Saves the interaction start
	init(details) {
		const box = WMResizer.box = details.target.getBoundingClientRect()
		WMResizer.inResize = true

		// Calculate the offsets of the window
		const offsets = {
			top: details.y - box.top,
			right: box.right - details.x,
			bottom: box.bottom - details.y,
			left: details.x - box.left,
		}

		// Update the window grab position
		const edges = WMResizer.edges = {
			top: offsets.top <= WMResizer.resizeMargin,
			right: offsets.right <= WMResizer.resizeMargin,
			bottom: offsets.bottom <= WMResizer.resizeMargin,
			left: offsets.left <= WMResizer.resizeMargin,
		}

		WMResizer.anchor.x = details.x
		WMResizer.anchor.y = details.y

		// If the user clicked on the top-right or the bottom-left corners
		if (edges.top && edges.right || edges.bottom && edges.left) { details.target.classList.add("resizeXY2", "resizing") }
		// If the user clicked on the top-left or the bottom-right corners
		else if (edges.top && edges.left || edges.bottom && edges.right) { details.target.classList.add("resizeXY1", "resizing") }
		// If the user clicked on the left or right edge
		else if (edges.left || edges.right) { details.target.classList.add("resizeX", "resizing") }
		// If the user clicked on the top or bottom edge
		else if (edges.top || edges.bottom) { details.target.classList.add("resizeY", "resizing") }
	}
	// Resizes a window following the pointer
	followCursor(details) {
		// Target the current resizing window
		const resizingWindow = WMFactory.space.querySelector(".resizing")
		// If none, ignore the movement
		if (!resizingWindow) { return }

		const { box, edges, anchor } = WMResizer
		let { top, left, width, height } = box

		const deltaX = anchor.x - details.x
		const deltaY = anchor.y - details.y

		if (WMResizer.edges.left) {
			width += deltaX
			left -= deltaX
		} else if (WMResizer.edges.right) { width -= deltaX }

		if (WMResizer.edges.top) {
			height += deltaY
			top -= deltaY
		} else if (WMResizer.edges.bottom) { height -= deltaY }

		resizingWindow.style.transform = `translate(${left}px,${top}px)`
		resizingWindow.style.width = `${width}px`
		resizingWindow.style.height = `${height}px`
	}
	// Handles the end of a window resizing
	reset(details) {
		WMResizer.inResize = false

		// Remove resize classes
		details.target.classList.remove("resizeX", "resizeY", "resizeXY1", "resizeXY2", "resizing")
	}

	constructor() {
		WebdeskEvent.WINDOW_RESIZE_START.on(this.init)	// Save the offsets when the user clicks on a window
		WebdeskEvent.WINDOW_RESIZE.on(this.followCursor)	// Resize a window when the user moves the pointer
		WebdeskEvent.WINDOW_RESIZE_END.on(this.reset)	// Stop the resizing when the user releases the pointer
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
		// Set the focus to this new icon
		icon.classList.add("focus")

		// Add it to the app dock
		AppDockManager.open.append(icon)

		// Add the necessary event listeners
		icon.addEventListener("click", (event) => { WebdeskEvent.ICON_CLICK.emit({ target: event.target.closest("[icon]") }) })
		// Set the values of the dock icon
		icon.setAttribute("icon", details.app)	// App name
		image.src = `apps/${details.app}/${manifest.icon}`	// App icon
		name.innerText = details.app
	}
	// Removes an icon when the connected window is closed
	updateClosedWindow(details) {
		const icon = AppDockManager.windowToIcon.get(details.closed)

		if (icon) {
			AppDockManager.windowToIcon.delete(details.closed)
			icon.remove()
		}
	}
	// Focuses the window connected to a dock icon
	// NOTE: iconToWindow is only used for this... Kinda wasteful but loops are sad
	focusLinkedWindow(details) {
		// Shifts the Focus on the Linked Window of a Dock Icon
		const window = AppDockManager.iconToWindow.get(details.target)

		// Removes the minimised class
		window.classList.remove("minimised")
	}
	// Updates the icon of the focused window
	focus(details) {
		const oldFocus = AppDockManager.windowToIcon.get(details.old)
		const newFocus = AppDockManager.windowToIcon.get(details.new)

		if (oldFocus) { oldFocus.classList.remove("focus") }
		if (newFocus) { newFocus.classList.add("focus") }
	}

	// Updates the clock (in the frontend)
	updateClockElement(details) {
		// When the clock is updated
		for (const piece of details.update) {
			switch(piece) {
				case "seconds":
				case "minutes":
				case "hours": AppDockManager.clock.querySelector(`.${piece}`).innerText = `${time.clock[piece]}`.padStart(2, 0); break

				case "day":
				case "month":
				case "year": AppDockManager.clock.querySelector(`.${piece}`).innerText = `${time.date[piece]}`.padStart(2, 0); break
			}
		}
	}
	// Initialize the clock element
	initClockElement() {
		this.clock.querySelector(".seconds").innerText = `${time.clock.seconds}`.padStart(2, 0)
		this.clock.querySelector(".minutes").innerText = `${time.clock.minutes}`.padStart(2, 0)
		this.clock.querySelector(".hours").innerText = `${time.clock.hours}`.padStart(2, 0)

		this.clock.querySelector(".day").innerText = `${time.date.day}`.padStart(2, 0)
		this.clock.querySelector(".month").innerText = `${time.date.month}`.padStart(2, 0)
		this.clock.querySelector(".year").innerText = `${time.date.year}`
	}

	constructor() {
		this.initClockElement()

		WebdeskEvent.ICON_CLICK.on(this.focusLinkedWindow)

		WebdeskEvent.CLOCK_UPDATE.on(this.updateClockElement)

		WebdeskEvent.WINDOW_OPEN.on(this.add)
		WebdeskEvent.WINDOW_CLOSE.on(this.updateClosedWindow)

		WebdeskEvent.WINDOW_MINIMISE.on(this.minimised.add)
		WebdeskEvent.WINDOW_MINIMISE_END.on(this.maximised.remove)

		Utilities.events.WINDOW_MAXIMISE.on([this.icons.maximised.add])
		Utilities.events.WINDOW_MAXIMISE_END.on([this.icons.maximised.remove])
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
	}
	appearance = {
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
	behavior = {
		moveSmoothing: false,
		resizeSmoothing: true,
		maximizeSmoothing: true,
		minimizeSmoothing: true,
		closeSmoothing: false,
	}
}

const defaultLaunchersCustomization = new class {
	color = {
		text: "#2E3440",
	}
	appearance = {
		text: true
	}
	behavior = {

	}
}

const defaultAppDockCustomization = new class {
	color = {
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
	}
	appearance = {
		border: {
			width: "none",
			style: "solid",
		}
	}
	behavior = {
		autoHide: {
			whenOverlapping: true,
			always: false,
			upTime: 5000,
			upDelay: 0,
			downDelay: 2000,
		},
		hideOnMaximisedWindow: {
			enabled: true,
			upTime: 5000,
			upDelay: 0,
			downDelay: 2000,
		},
		iconNames: false
	}
}

var UIManager = new class {
	backgroundElement = document.querySelector(".Background")
	currentCustomizationID = 0
	currentBackgroundID = 0

	// Sets up themes in the database
	async newUserCustomizationInit() {
		const theme = {
			windows: defaultWindowsCustomization,
			appdock: defaultAppDockCustomization,
			launchers: defaultLaunchersCustomization,
		}

		localStorage.setItem("customization-id", 0)
		await webdeskDB.createTable("_customizations")
		await webdeskDB.set("_customizations", 0, theme)
		await webdeskDB.set("_customizations", "last-ID", 0)
	}
	// Sets up backgrounds in the database
	async newUserBackgroundInit() {
		localStorage.setItem("backgrounds-id", 0)
		await webdeskDB.createTable("_backgrounds")
		await webdeskDB.set("_backgrounds", 0, `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="cool"><feTurbulence baseFrequency='0.01' numOctaves="1" result='noise' filterRes="1000"/><feDiffuseLighting in='noise' lighting-color='var(#D8DEE9)' surfaceScale='6'><feDistantLight azimuth='45' elevation='60' /></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#cool)" /></svg>`)
		await webdeskDB.set("_backgrounds", "last-ID", 0)
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
if (newUser) {
	WebdeskEvent.MANIFESTS_READY.on((details) => { WMFactory.skeletonizeWindow({ app: "intro" }) })
}