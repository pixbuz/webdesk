/// <reference lib="dom" />

// TODO: Animations
// TODO: Make code more readable with less comments (and better var names)

// Tracks if a user visits webdesk for the first time
let newUser = false
// TODO: Make this into a object/class
var ApplicationManifests

// Simplifies IndexDB interactions
var webdeskDB = new class {
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

// Custom webdesk event constructor
class WebdeskEvent {
	static templates = {
		MANIFEST: {},
		CLOCK: { update: [ ], },
		LAUNCHER: { app: null, },
		TARGET: { target: null },
		FOCUS: { old: null, new: null, },
		OPEN: { target: null, app: null },
		CLOSE: { closed: null, open: [ ] },
		INTERACTION: { target: null, x: null, y: null, },
	}

	static MANIFESTS_READY = new WebdeskEvent(this.templates.MANIFEST)

	static LAUNCHER_CLICK = new WebdeskEvent(this.templates.LAUNCHER)

	static TITLEBAR_LOADED = new WebdeskEvent(this.templates.TARGET)
	static TITLEBAR_READY = new WebdeskEvent(this.templates.TARGET)

	static WINDOW_READY = new WebdeskEvent(this.templates.TARGET)

	static WINDOW_MOVE_START = new WebdeskEvent(this.templates.INTERACTION)
	static WINDOW_MOVE = new WebdeskEvent(this.templates.INTERACTION)
	static WINDOW_MOVE_END = new WebdeskEvent(this.templates.INTERACTION)

	static WINDOW_RESIZE_START = new WebdeskEvent(this.templates.INTERACTION)
	static WINDOW_RESIZE = new WebdeskEvent(this.templates.INTERACTION)
	static WINDOW_RESIZE_END = new WebdeskEvent(this.templates.INTERACTION)

	static WINDOW_OPEN = new WebdeskEvent(this.templates.OPEN)
	static WINDOW_CLOSE = new WebdeskEvent(this.templates.CLOSE)

	static WINDOW_UPDATED_FOCUS = new WebdeskEvent(this.templates.FOCUS)

	static WINDOW_MAXIMISE = new WebdeskEvent(this.templates.TARGET)
	static WINDOW_MAXIMISE_END = new WebdeskEvent(this.templates.TARGET)

	static WINDOW_MINIMISE = new WebdeskEvent(this.templates.TARGET)
	static WINDOW_MINIMISE_END = new WebdeskEvent(this.templates.TARGET)

	static CLOCK_UPDATE = new WebdeskEvent(this.templates.CLOCK)

	static ICON_CLICK = new WebdeskEvent(this.templates.TARGET)

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
		callBackFunctions.forEach((callBackFunction) => {
			// Add an event listener for the event
			window.addEventListener(this.name, (event) => { callBackFunction(event.detail) })
		})
	}

	constructor(eventTemplate = {}) {
		this.name = Math.random().toString(36)
		this.template = eventTemplate
	}
}

// Fetches all the application manifests
fetch("/api/_/manifest").then(async (response) => {
	ApplicationManifests = await response.json()
	WebdeskEvent.MANIFESTS_READY.emit(ApplicationManifests)
})

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
		WebdeskEvent.CLOCK_UPDATE.emit({ update: changed })
	}

	constructor() {
		// "Nullify" the start time offset by updating the clock every 1.000s
		setTimeout(() => {
			time.progress()
			// Set an interval to progress the clock every second
			setInterval(time.progress, 1000)
		}, 1000 - this.init.getMilliseconds())
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
			if (details[appName].dni) { continue }	// If an app is "Do Not Index", don't add it to the desktop
			// IDEA: Make DNI app "services", makes more sense they be existing in the background
			LauncherManager.addLauncher(appName, details[appName])
		}
	}

	constructor() {
		WebdeskEvent.MANIFESTS_READY.on(this.addLaunchers)
	}
}

// Contains the methods called when opening a window
const WMFactory = new class {
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

		// Add the attributes to the iframes
		content.setAttribute("allowfullscreen", false)
		// TODO: Improve this special treatment
		content.setAttribute("sandbox", `allow-scripts ${ details.app === "settings" ? "allow-same-origin" : "" }`)
		content.setAttribute("title", `Application "${details.app}"'s content`)

		titlebar.setAttribute("allowfullscreen", false)
		// TODO: Make a solid titlebar system
		titlebar.setAttribute("sandbox", "allow-same-origin")
		titlebar.setAttribute("title", `Application "${details.app}"'s titlebar`)

		// Show the index page of the app
		content.src = `/apps/${details.app}/${manifest.index}`

		// If the app has no custom titlebar, set the default one
		if (manifest.titlebar.path != "") { titlebar.src = `/apps/${appName}/${manifest.titlebar.path}` }
		else { titlebar.src = `/api/_/titlebar` }

		// Setup the titlebar
		titlebar.addEventListener("load", WMFactory.setupTitlebar, { once: true })

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
		WebdeskEvent.WINDOW_OPEN.emit({ target: windowSkeleton, app: details.app, })
	}
	// Setup the titlebar
	// TODO: Messaging system for movement and stuff for perfect security
	async setupTitlebar(event) {
		const titlebar = event.target
		const targetWindow = event.target.closest("[app]")
		const content = targetWindow.querySelector(".content")
		const appName = targetWindow.getAttribute("app")
		const manifest = ApplicationManifests[appName]
		const titlebarDocument = titlebar.contentDocument
		const contentDocument = content.contentDocument
		const titleElement = titlebarDocument.querySelector(".title")

		// If the app is DNI, remove the icon
		if (manifest.dni) { titlebarDocument.querySelector(".icon").remove() }
		// If the titlebar is the default one, add the icon
		else if (manifest.titlebar.path == "") { titlebarDocument.querySelector(".icon").src = `/apps/${appName}/${manifest.icon}` }

		// TODO: Improve this with the messaging system
		titleElement.innerText = appName

		// Copy the CSS variables for styling
		titlebarDocument.documentElement.setAttribute("style", document.documentElement.getAttribute("style"))

		// // Listen for page changes
		// content.addEventListener("load", () => {
		// 	if (contentDocument.title) { titleElement.innerText = contentDocument.title }
		// 	else if (manifest.name) { titleElement.innerText = appName }
		// })

		// // Check if the content already loaded
		// if (contentDocument.readyState === "complete") {
		// 	if (contentDocument && contentDocument.title) { titleElement.innerText = contentDocument.title }
		// 	else if (manifest.name) { titleElement.innerText = appName }
		// }

		// Send an event when the user clicks in the titlebar
		// TODO: Improve the event wrapping by removing methods and stuff and putting into real methods
		// IDEA: using right mouse click moves but doesn't update the window focus
		titlebarDocument.body.addEventListener("pointerdown", (event) => {
			// If the element clicked is a button, ignore the event
			if (event.target.tagName === "BUTTON") { return }
			else if (targetWindow.classList.contains("maximised")) { return }

			titlebarDocument.body.setPointerCapture(event.pointerId)

			// Emit the event
			WebdeskEvent.WINDOW_MOVE_START.emit({ x: event.screenX, y: event.screenY, target: targetWindow })
		})

		// Send an event when the user moves
		titlebarDocument.body.addEventListener("pointermove", (event) => {
			if (WMMover.inMove) {
				WebdeskEvent.WINDOW_MOVE.emit({ x: event.screenX, y: event.screenY, target: targetWindow })
			}
		})

		// Send an event when releases the click in the titlebar
		titlebarDocument.body.addEventListener("pointerup", (event) => {
			// If the element clicked is a button, ignore the event
			if (event.target.tagName === "BUTTON") { return }
			else if (targetWindow.classList.contains("maximised")) { return }

			titlebarDocument.body.releasePointerCapture(event.pointerId)

			// Emit the event
			WebdeskEvent.WINDOW_MOVE_END.emit({ x: event.screenX, y: event.screenY, target: targetWindow })
		})

		// If there is a close button, make it close the window
		const closeButton = titlebarDocument.querySelector(".close")
		if (closeButton) {
			closeButton.addEventListener("click", () => {
				targetWindow.remove()
				WebdeskEvent.WINDOW_CLOSE.emit({ closed: targetWindow, open: WMFactory.open })
			})
		}
		// If there is a maximise button, make it maximise the window
		const maximiseButton = titlebarDocument.querySelector(".maximise")
		if (maximiseButton) {
			maximiseButton.addEventListener("click", () => {
				if (targetWindow.classList.contains("maximised")) {
					targetWindow.classList.remove("maximised")
					WebdeskEvent.WINDOW_MAXIMISE_END.emit({ target: targetWindow, app: appName })
				} else {
					targetWindow.classList.add("maximised")
					WebdeskEvent.WINDOW_MAXIMISE.emit({ target: targetWindow, app: appName })
				}
			})
		}
		// If there is a minimise button, make it minimise the window
		const minimiseButton = titlebarDocument.querySelector(".minimise")
		if (minimiseButton) {
			minimiseButton.addEventListener("click", () => {
				// Remove the maximised class
				targetWindow.classList.remove("maximised")
				if (targetWindow.classList.contains("minimised")) {
					targetWindow.classList.remove("minimised")
					WebdeskEvent.WINDOW_MINIMISE_END.emit({ target: targetWindow, app: appName })
				} else {
					targetWindow.classList.add("minimised")
					WebdeskEvent.WINDOW_MINIMISE.emit({ target: targetWindow, app: appName })
				}
			})
		}
	}

	constructor() {
		WebdeskEvent.LAUNCHER_CLICK.on(this.skeletonizeWindow)	// Open a window when a launcher is clicked
	}
}

const WMFocuser = new class {
	focusedWindow = null

	// Makes a window the "active" window
	focusWindow(details) {
		// If the focused window isn't the target window, update the focus
		if (details.target != WMFocuser.focusedWindow || !WMFocuser.focusedWindow) {
			// Remove the focus class from the old focused window
			if (WMFocuser.focusedWindow) { WMFocuser.focusedWindow.classList.remove("focus") }

			// Dispatch the event
			WebdeskEvent.WINDOW_UPDATED_FOCUS.emit({ old: WMFocuser.focusedWindow, new: details.target })

			// Set the window as the focused window
			WMFocuser.focusedWindow = details.target
			// Add focus class
			WMFocuser.focusedWindow.classList.add("focus")
		}
	}
	// Updates a window z-index, runs everytime the focus shifts
	// IDEA: Make a UPDATE Z INDEX event for cleaner event driven logic
	updateZIndex(details, targetWindow) {
		// Get the current z-index
		const zIndex = parseInt(targetWindow.style.zIndex)

		// If the window is in focus, max the z-index
		if (details.new == targetWindow) { targetWindow.style.zIndex = 29 }
		// If the z-index is greater that the min z-index, lower it
		else if (zIndex > 20) { targetWindow.style.zIndex = zIndex - 1 }
	}
	// When a window is closed, ensure there is one in focus
	// IDEA: Conjure a system for passive highest z-index finding
	shiftFocus(details) {
		// Target the window with the highest z-index
		const targetWindow = details.open.sort((a, b) => {
			if (a.style.zIndex > b.style.zIndex) { return a }
		}).at(0)

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
	// Maps a window to it's icon in the app dock
	windowToIcon = new WeakMap()
	// Maps a icon to it's window in the window space
	iconToWindow = new WeakMap()
	// Add the maximised propriety to an icon
	maximised = {
		add(details) {
			const icon = AppDockManager.open.querySelector(`[icon=${details.app}]`)
			if (icon) { icon.classList.add("maximised") }
		},
		remove(details) {
			const icon = AppDockManager.open.querySelector(`[icon=${details.app}]`)
			if (icon) { icon.classList.remove("maximised") }
		}
	}
	// Add the minimised propriety to an icon
	minimised = {
		add(details) {
			const icon = AppDockManager.open.querySelector(`[icon=${details.app}]`)
			if (icon) { icon.classList.add("minimised") }
		},
		remove(details) {
			const icon = AppDockManager.open.querySelector(`[icon=${details.app}]`)
			if (icon) { icon.classList.remove("minimised") }
		}
	}
	// Create the icon for a newly opened window
	add(details) {
		const manifest = ApplicationManifests[details.app]
		if (manifest.dni) { return }

		// Create the new icon for the window
		const icon = document.createElement("button")
		const image = document.createElement("img")
		const name = document.createElement("p")

		AppDockManager.windowToIcon.set(details.target, icon)
		AppDockManager.iconToWindow.set(icon, details.target)

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

		WebdeskEvent.WINDOW_MAXIMISE.on(this.maximised.add)
		WebdeskEvent.WINDOW_MAXIMISE_END.on(this.maximised.remove)

		WebdeskEvent.WINDOW_UPDATED_FOCUS.on(this.focus)
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
	// Load the user's customization
	async loadCustomization(customizationID) {
		const customization = await webdeskDB.get("_customizations", UIManager.currentCustomizationID = customizationID)

		this.loadCssVars(customization.windows, "windows")
		this.loadCssVars(customization.appdock, "appdock")
		this.loadCssVars(customization.launchers, "launchers")
	}
	// Load the user's background
	async loadBackground(backgroundID) {
		const backgroundContents = await webdeskDB.get("_backgrounds", UIManager.currentBackgroundID = backgroundID)

		this.backgroundElement.innerHTML = backgroundContents
	}

	constructor() {(async () => {
		const customizationID = localStorage.getItem("customization-id")
		const backgroundID = localStorage.getItem("background-id")

		if (!customizationID) { await this.newUserCustomizationInit() }
		if (!backgroundID) { await this.newUserBackgroundInit() }

		this.loadCustomization(parseInt(customizationID) || 0)
		this.loadBackground(parseInt(backgroundID) || 0)
	})()}
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
// TODO: Fix the titlebar styling not working
if (newUser) {
	WebdeskEvent.MANIFESTS_READY.on((details) => { WMFactory.skeletonizeWindow({ app: "intro" }) })
}