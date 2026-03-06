/// <reference lib="dom" />

// TODO: Sounds crazy, but splitting the monolithic classes
//	into more managable clusters will make for cleaner, more maintainable and understandable code
//	unlike before tho, keep everything in the same script file

// TODO: Animations

let newUser = false

// Simplifies IndexDB interactions
var webdeskDB = new class {
	version = 1
	updateLock = null
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

// Custom webdesk event constructor
const WebdeskEvent = class {
	constructor(eventTemplate = {}) {
		this.name = Math.random().toString(36)
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
	on(...callBackFunctions) {
		// For every function passed
		callBackFunctions.map((callBackFunction) => {
			// Add an event listener for the event
			window.addEventListener(this.name, (event) => { callBackFunction(event.detail) })
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
			x: null,
			y: null,
		}
	}
	// Contains all webdesk custom events
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

	constructor() {
		// Allows registering functions to multiple events
		Function.prototype.onEvent = function(...eventsList) {
			// For every event passed, register the function to it
			eventsList.map((event) => { event.on(this) })

			return this
		}

		// Fetches all the application manifests
		fetch("/api/_/manifest").then(async (response) => {
			this.manifests = await response.json()
			Utilities.events.MANIFESTS_READY.emit(this.manifests)
		})
	}
}

// Time tracking
const time = new class {
	// Get the client start time
	init = new Date()
	// Clock
	clock = {
		seconds: this.init.getSeconds(),
		minutes: this.init.getMinutes(),
		hours: this.init.getHours(),
	}
	// Date
	date = {
		day: this.init.getDate(),
		month: this.init.getMonth() + 1,
		year: this.init.getFullYear(),
	}

	// Adds 1 second to the clock every second
	progress() {
		// Track what changed to smartly update the elements
		const changed = [ "seconds" ]
		// Add a second
		time.clock.seconds++

		// If the seconds hit 60
		if (time.clock.seconds >= 60) {
			// Set them to 0 and add a minute
			time.clock.seconds = 0
			time.clock.minutes++

			// Track the change for the event
			changed.push("minutes")
		}

		// If the minutes hit 60
		if (time.clock.minutes >= 60) {
			// Set them to 0 and add an hour
			time.clock.minutes = 0
			time.clock.hours++

			// Track the change for the event
			changed.push("hours")
		}

		// If the hours hit 24
		if (time.clock.hours >= 24) {
			// Set them to 0 and add a day
			time.clock.hours = 0
			time.date.day++

			// Track the change for the event
			changed.push("day")
		}

		// Send the event
		Utilities.events.CLOCK_UPDATE.emit({ target: changed })
	}

	constructor() {
		// "Nullify" the start time offset by updating the clock every 1.000s
		setTimeout(() => {
			// Progress the time by 1 second
			this.progress()
			// Set an interval to progress the clock every second
			setInterval(this.progress, 1000)
		}, 1000 - this.init.getMilliseconds())
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
			if (details[appName].dni) { continue }
			LauncherManager.addLauncher(appName, details[appName])
		}
	}

	constructor() {
		Utilities.events.MANIFESTS_READY.on(this.initLaunchers)
	}
}

const WindowManager = new class {
	// Space for new windows
	space = document.querySelector(".Window.Space")
	// Contains the methods called when opening a window
	create = {
		// Assembles a webdesk window
		async skeletonizeWindow(details) {
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
			Utilities.events.WINDOW_UPDATED_FOCUS.on(() => { WindowManager.basic.updateZIndex(windowSkeleton) })

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
			Utilities.events.WINDOW_OPEN.emit({ app: details.app, target: windowSkeleton })
		},
		// Setup the titlebar
		async setupTitlebar(event) {
			const titlebar = event.target
			const targetWindow = event.target.closest("[app]")
			const content = targetWindow.querySelector(".content")
			const appName = targetWindow.getAttribute("app")
			const manifest = Utilities.manifests[appName]
			const titlebarDocument = titlebar.contentDocument
			const contentDocument = content.contentDocument
			const titleElement = titlebarDocument.querySelector(".title")

			// If the titlebar is the default one, add the icon
			if (manifest.dni) { titlebarDocument.querySelector(".icon").remove() }
			else if (manifest.titlebar.path == "") { titlebarDocument.querySelector(".icon").src = `/apps/${appName}/${manifest.icon}` }

			// Listen for page changes
			content.addEventListener("load", () => {
				if (contentDocument.title) { titleElement.innerText = contentDocument.title }
				else if (manifest.name) { titleElement.innerText = appName }
			})

			// Check if the content already loaded
			if (contentDocument.readyState === "complete") {
				if (contentDocument && contentDocument.title) { titleElement.innerText = contentDocument.title }
				else if (manifest.name) { titleElement.innerText = appName }
			}

			// Send an event when the user clicks in the titlebar
			// IDEA: using right mouse click doesn't update the window focus
			titlebarDocument.body.addEventListener("pointerdown", (event) => {
				// If the element clicked is a button, ignore the event
				if (event.target.tagName === "BUTTON") { return }
				else if (targetWindow.classList.contains("maximised")) { return }

				targetWindow.classList.add("moving")
				titlebarDocument.body.setPointerCapture(event.pointerId)

				// Emit the event
				Utilities.events.WINDOW_MOVE_START.emit({ x: event.screenX, y: event.screenY, target: targetWindow })
			})

			// Send an event when the user moves
			titlebarDocument.body.addEventListener("pointermove", (event) => { Utilities.events.WINDOW_MOVE.emit({ x: event.screenX, y: event.screenY, target: targetWindow }) })

			// Send an event when releases the click in the titlebar
			titlebarDocument.body.addEventListener("pointerup", (event) => {
				// If the element clicked is a button, ignore the event
				if (event.target.tagName === "BUTTON") { return }
				else if (targetWindow.classList.contains("maximised")) { return }

				targetWindow.classList.remove("moving")
				titlebarDocument.body.releasePointerCapture(event.pointerId)

				// Emit the event
				Utilities.events.WINDOW_MOVE_END.emit({ x: event.screenX, y: event.screenY, target: targetWindow })
			})

			// If there is a close button, make it close the window
			if (titlebarDocument.querySelector(".close")) {
				titlebarDocument.querySelector(".close").addEventListener("click", () => {
					targetWindow.remove()
					Utilities.events.WINDOW_CLOSE.emit({ target: targetWindow, app: appName })
				})
			}
			// If there is a maximise button, make it maximise the window
			if (titlebarDocument.querySelector(".maximise")) {
				titlebarDocument.querySelector(".maximise").addEventListener("click", () => {
					if (targetWindow.classList.contains("maximised")) {
						targetWindow.classList.remove("maximised")
						Utilities.events.WINDOW_MAXIMISE_END.emit({ target: targetWindow, app: appName })
					} else {
						targetWindow.classList.add("maximised")
						Utilities.events.WINDOW_MAXIMISE.emit({ target: targetWindow, app: appName })
					}
				})
			}
			// If there is a minimise button, make it minimise the window
			if (titlebarDocument.querySelector(".minimise")) {
				titlebarDocument.querySelector(".minimise").addEventListener("click", () => {
					// Remove the maximised class
					targetWindow.classList.remove("maximised")

					if (targetWindow.classList.contains("minimised")) {
						targetWindow.classList.remove("minimised")
						Utilities.events.WINDOW_MINIMISE_END.emit({ target: targetWindow, app: appName })
					} else {
						targetWindow.classList.add("minimised")
						Utilities.events.WINDOW_MINIMISE.emit({ target: targetWindow, app: appName })
					}
				})
			}
		}
	}
	// Contains methods called for a window interaction
	basic = {
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
	// Contains the methods needed for the window moving logic
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
			const box = details.target.getBoundingClientRect()

			// Calculate and apply the offsets to center the window in the viewport
			details.target.style.transform = `translate(${(window.innerWidth - box.width) / 2}px,${(window.innerHeight - box.height) / 2}px)`
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
		},
		// When the viewport gets resized, update all the collisions and window sizes
		checkAllViewportCollisions(event) {
			// For all open windows, update the position if clipping the resized viewport
			for (const openWindow of document.querySelectorAll("[app]")) { WindowManager.move.updatePositionIfCollision({ target: openWindow, app: openWindow.getAttribute("app") }) }
		},
		// Handles the end of a window movement
		reset(details) {
			details.target.classList.remove("moving")
		}
	}
	// Contains the methods needed for the window resizing logic
	resize = {
		// Saves on which edge/s the user clicked
		edges: { },
		anchor: { },
		box: null,
		// Saves the interaction start
		init(details) {
			const box = WindowManager.resize.box = details.target.getBoundingClientRect()
			// Margin on the edges of a window for triggering the resizing
			const resizeMargin = 12

			// Calculate the offsets of the window
			const offsets = {
				top: details.y - box.top,
				right: box.right - details.x,
				bottom: box.bottom - details.y,
				left: details.x - box.left,
			}

			// Update the window grab position
			const edges = WindowManager.resize.edges = {
				top: offsets.top <= resizeMargin,
				right: offsets.right <= resizeMargin,
				bottom: offsets.bottom <= resizeMargin,
				left: offsets.left <= resizeMargin,
			}

			WindowManager.resize.anchor.x = details.x
			WindowManager.resize.anchor.y = details.y

			// If the user clicked on the top-right or the bottom-left corners
			if (edges.top && edges.right || edges.bottom && edges.left) { details.target.classList.add("resizeXY2", "resizing") }
			// If the user clicked on the top-left or the bottom-right corners
			else if (edges.top && edges.left || edges.bottom && edges.right) { details.target.classList.add("resizeXY1", "resizing") }
			// If the user clicked on the left or right edge
			else if (edges.left || edges.right) { details.target.classList.add("resizeX", "resizing") }
			// If the user clicked on the top or bottom edge
			else if (edges.top || edges.bottom) { details.target.classList.add("resizeY", "resizing") }
		},
		// Interprets where a user clicked and runs the appropriate rescaling of a window
		followCursor(details) {
			// Target the current resizing window
			const resizingWindow = WindowManager.space.querySelector(".resizing")
			// If none, ignore the movement
			if (!resizingWindow) { return }

			const { box, edges, anchor } = WindowManager.resize
			let { top, left, width, height } = box

			const deltaX = anchor.x - details.x
			const deltaY = anchor.y - details.y

			if (WindowManager.resize.edges.left) {
				width += deltaX
				left -= deltaX
			} else if (WindowManager.resize.edges.right) { width -= deltaX }

			if (WindowManager.resize.edges.top) {
				height += deltaY
				top -= deltaY
			} else if (WindowManager.resize.edges.bottom) { height -= deltaY }

			resizingWindow.style.transform = `translate(${left}px,${top}px)`
			resizingWindow.style.width = `${width}px`
			resizingWindow.style.height = `${height}px`
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
		Utilities.events.LAUNCHER_CLICK.on(this.create.skeletonizeWindow)	// Open a window when a launcher is clicked

		// TODO: Make it toggle-able from settings
		Utilities.events.WINDOW_OPEN.on(this.move.centerWindow.bind(this))	// Center a window when a window is opened
		Utilities.events.WINDOW_CLOSE.on(this.basic.shiftFocus.bind(this))	// Move the focus when a window is closed

		Utilities.events.WINDOW_MOVE_START.on(this.move.init)	// Save the offsets when the user clicks on a titlebar
		Utilities.events.WINDOW_MOVE.on(this.move.followCursor)	// Move a window when the user moves the pointer
		Utilities.events.WINDOW_MOVE_END.on(this.move.reset)	// Stop the movement when the user releases the pointer

		Utilities.events.WINDOW_RESIZE_START.on(this.resize.init)	// Save the offsets when the user clicks on a window
		Utilities.events.WINDOW_RESIZE.on(this.resize.followCursor)	// Resize a window when the user moves the pointer
		Utilities.events.WINDOW_RESIZE_END.on(this.resize.reset)	// Stop the resizing when the user releases the pointer

		Utilities.events.WINDOW_RESIZE_START.on(this.resize.init)	// Save the offsets when the user clicks on a window

		Utilities.events.WINDOW_CLICK.on(this.resize.init)	// Check how to resize the window

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

		window.addEventListener("resize", this.move.checkAllViewportCollisions)
	}
}

const AppDockManager = new class {
	// Get the App Dock Element
	element = document.querySelector(".AppDock")
	// Get the Clock of inside App Dock
	clock = this.element.querySelector(".Clock")
	// Get the Open Windows element inside App Dock
	open = this.element.querySelector(".Open")
	// Maps a window to it's icon in the app dock
	windowToIcon = new WeakMap()
	// Contains all methods for icon managment
	icons = {
		// Add the maximised propriety to an icon
		maximised: {
			add(details) {
				const icon = AppDockManager.open.querySelector(`[icon=${details.app}]`)
				if (icon) { icon.classList.add("maximised") }
			},
			remove(details) {
				const icon = AppDockManager.open.querySelector(`[icon=${details.app}]`)
				if (icon) { icon.classList.remove("maximised") }
			}
		},
		// Add the minimised propriety to an icon
		minimised: {
			add(details) {
				const icon = AppDockManager.open.querySelector(`[icon=${details.app}]`)
				if (icon) { icon.classList.add("minimised") }
			},
			remove(details) {
				const icon = AppDockManager.open.querySelector(`[icon=${details.app}]`)
				if (icon) { icon.classList.remove("minimised") }
			}
		},
		// Create the icon for a newly opened window
		async add(details) {
			const manifest = Utilities.manifests[details.app]
			if (manifest.dni) { return }

			// Create the new icon for the window
			const icon = document.createElement("button")
			const image = document.createElement("img")
			const name = document.createElement("p")

			AppDockManager.windowToIcon.set(details.target, icon)

			// Assemble the dock icon element
			icon.append(name, image)
			// Set the focus to this new icon
			icon.classList.add("focus")

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
			const icon = AppDockManager.open.querySelector(`[icon=${details.app}]`)
			if (icon) { icon.remove() }

			AppDockManager.windowToIcon.delete(details.target)
		},
		// Focuses the window connected to a dock icon
		focusLinkedWindow(event) {
			// Shifts the Focus on the Linked Window of a Dock Icon
			const appName = event.target.closest(`[icon]`).getAttribute("icon")
			const window = WindowManager.space.querySelector(`[app="${appName}"]`)

			// Removes the minimised class
			window.classList.remove("minimised")
		},
		// Updates the icon of the focused window
		focus(details) {
			const oldFocus = AppDockManager.open.querySelector(".focus")
			const newFocus = AppDockManager.windowToIcon.get(details.target)

			if (oldFocus) { oldFocus.classList.remove("focus") }
			if (newFocus) { newFocus.classList.add("focus") }
		}
	}

	// Updates the clock (in the frontend)
	updateClockElement(details) {
		// When the clock is updated
		for (const piece of details.target) {
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
		Utilities.events.CLOCK_UPDATE.on(this.updateClockElement)

		Utilities.events.WINDOW_OPEN.on(this.icons.add)
		Utilities.events.WINDOW_CLOSE.on(this.icons.updateClosedWindow)

		Utilities.events.WINDOW_MINIMISE.on(this.icons.minimised.add)
		Utilities.events.WINDOW_MINIMISE_END.on(this.icons.maximised.remove)

		Utilities.events.WINDOW_MAXIMISE.on(this.icons.maximised.add)
		Utilities.events.WINDOW_MAXIMISE_END.on(this.icons.maximised.remove)

		Utilities.events.WINDOW_UPDATED_FOCUS.on(this.icons.focus)
	}
}

const defaultWindowsCustomization = new class {
	color = {
		background: "#D8DEE9",
		border: "#4C566A",
		title: "#2E3440",
		dots: "#2E3440",
		buttons: {
			close: "#D08770",
			maxi: "#EBCB8B",
			mini: "#A3BE8C",
		},
		focus: {
			background: "#ECEFF4",
			border: "#2E3440",
			title: "#2E3440",
			dots: "#3B4252",
			buttons: {
				close: "#D08770",
				maxi: "#EBCB8B",
				mini: "#A3BE8C",
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
			enabled: false,
			upTime: 5000,
			upDelay: 0,
			downDelay: 2000,
		},
		hideOnMaximisedWindow: {
			enabled: true,
			upTime: 5000,
			upDelay: 0,
			downDelay: 2000,
		}
	}
}

const UIManager = new class {
	backgroundWrapper = document.querySelector(".Background")
	backgroundID = 0
	customID = 0

	// Sets up themes in the database
	newUserInit() {
		const theme = {
			windows: defaultWindowsCustomization,
			appdock: defaultAppDockCustomization,
			launchers: defaultLaunchersCustomization,
		}

		localStorage.setItem("backgrounds-id", 0)
		webdeskDB.createTable("_backgrounds").then(() => {
			webdeskDB.set("_backgrounds", 0, `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="cool"><feTurbulence baseFrequency='0.01' numOctaves="1" result='noise' filterRes="1000"/><feDiffuseLighting in='noise' lighting-color='var(#D8DEE9)' surfaceScale='6'><feDistantLight azimuth='45' elevation='60' /></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#cool)" /></svg>`)
			this.loadBackground()
		})

		localStorage.setItem("customization-id", 0)
		webdeskDB.createTable("_customizations").then(() => {
			webdeskDB.set("_customizations", 0, theme)
			this.loadCustomization()
		})
	}
	// Converts the color proprieties of a theme into css variables
	loadCssVars(root, prefix = "") {
		for (const key of Object.keys(root)) {
			if (root[key] instanceof Object) { this.loadCssVars(root[key], `${prefix ? prefix + "-" : ""}${key}`) }
			else { document.documentElement.style.setProperty(`--${prefix}-${key}`, root[key]) }
		}
	}
	// Load the user's customization
	async loadCustomization() {
		this.customID = parseInt(localStorage.getItem("customization-id")) || 0
		const customization = await webdeskDB.get("_customizations", this.customID)

		if (customization) {
			this.loadCssVars(customization.windows, "windows")
			this.loadCssVars(customization.appdock, "appdock")
			this.loadCssVars(customization.launchers, "launchers")
		} else { this.newUserInit() }
	}
	// Load the user's background
	async loadBackground() {
		this.backgroundID = parseInt(localStorage.getItem("background-id")) || 0
		const backgroundContents = await webdeskDB.get("_backgrounds", this.backgroundID || 0)

		this.backgroundWrapper.innerHTML = backgroundContents
	}

	constructor() {
		this.loadCustomization()
		this.loadBackground()
	}
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
	Utilities.events.MANIFESTS_READY.on((details) => { WindowManager.create.skeletonizeWindow({ app: "intro" }) })
}