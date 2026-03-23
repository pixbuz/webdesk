/// <reference lib="dom" />

// TODO: Animations
// TODO: Make code more readable with less comments (and better var names)
// TODO: Generator functions tho?

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
		TITLEBAR: { titlebar: null, app: null },
	}

	static MANIFESTS_READY = new WebdeskEvent(this.templates.MANIFEST)

	static LAUNCHER_CLICK = new WebdeskEvent(this.templates.LAUNCHER)

	static TITLEBAR_SETUP = new WebdeskEvent(this.templates.TITLEBAR)

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

	emit(data = {}) {
		const details = { ...this.template, ...data }
		const event = new CustomEvent(this.name, {
			detail: details,
			bubbles: true,
			composed: true
		})
		window.dispatchEvent(event)
	}
	on(...callBackFunctions) {
		callBackFunctions.forEach((callback) => {
			window.addEventListener(this.name, (event) => { callback(event.detail) })
		})
	}

	constructor(eventTemplate = {}) {
		this.name = Math.random().toString(36)
		this.template = eventTemplate
	}
}

fetch("/api/_/getManifests").then(async (response) => {
	ApplicationManifests = await response.json()
	WebdeskEvent.MANIFESTS_READY.emit(ApplicationManifests)
	if (newUser) { WMFactory.skeletonizeWindow({ app: "intro" }) }
})

const time = new class {
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

const LauncherManager = new class {
	space = document.querySelector(".Launcher.Space")

	addLauncher(appName, manifest) {
		const launcherWrapper = document.createElement("button"),
			title = document.createElement("span"),
			icon = document.createElement("img")

		icon.setAttribute("fetchpriority", "high")
		icon.setAttribute("alt", `Application "${appName}"'s icon`)

		launcherWrapper.setAttribute("launcher", appName)
		launcherWrapper.setAttribute("title", manifest.description == "undefined" ? appName : manifest.description)
		launcherWrapper.append(icon, title)

		title.classList.add("name")
		title.innerText = appName

		icon.classList.add("icon")
		icon.src = `/apps/${appName}/${manifest.icon}`

		this.space.appendChild(launcherWrapper)

		launcherWrapper.addEventListener("click", () => { WebdeskEvent.LAUNCHER_CLICK.emit({ app: appName }) })
	}
	queueLaunchers(details) {
		for (const appName of Object.keys(details).sort()) {
			if (details[appName].service) { continue }
			else { LauncherManager.addLauncher(appName, details[appName]) }
		}
	}

	constructor() {
		WebdeskEvent.MANIFESTS_READY.on(this.queueLaunchers)
	}
}

const WMTitlebarFactory = new class {
	async setup(details) {
		const { titlebar, app } = details
		const path = ApplicationManifests[app].titlebar
		const channel = new MessageChannel()

		titlebar.setAttribute("allowfullscreen", false)
		titlebar.setAttribute("sandbox", "allow-scripts")
		titlebar.setAttribute("title", `Application "${app}"'s titlebar`)

		console.log(path)

		if (path == "") { titlebar.src = "/api/_/defaultTitlebar" }
		else { titlebar.src = `/apps/${app}/${path}` }

		channel.port1.addEventListener("message", (messageEvent) => {
			WMTitlebarFactory.commandInterpreter(titlebar, channel.port1, messageEvent)
		})
		channel.port1.start()

		titlebar.addEventListener("load", () => {
			titlebar.contentWindow.postMessage({ command: "init" }, "*", [channel.port2])
		})

		// // If the app is a service, remove the icon
		// if (manifest.service) { titlebarDocument.querySelector(".icon").remove() }
		// // If the titlebar is the default one, add the icon
		// else if (manifest.titlebar.path == "") { titlebarDocument.querySelector(".icon").src = `/apps/${appName}/${manifest.icon}` }
	}
	close(details) {
		details.target.remove()
		WebdeskEvent.WINDOW_CLOSE.emit({ closed: targetWindow, open: WMFactory.open })
	}
	maximise(details) {
		if (details.target.classList.contains("maximised")) {
			details.target.classList.remove("maximised")
			WebdeskEvent.WINDOW_MAXIMISE_END.emit(details)
		} else {
			details.target.classList.add("maximised")
			WebdeskEvent.WINDOW_MAXIMISE.emit(details)
		}
	}
	minimise(details) {
		if (details.target.classList.contains("minimised")) {
			details.target.classList.remove("minimised")
			WebdeskEvent.WINDOW_MINIMISE_END.emit(details)
		} else {
			details.target.classList.add("minimised")
			WebdeskEvent.WINDOW_MINIMISE.emit(details)
		}
	}
	commandInterpreter(titlebar, port, messageEvent) {
		const window = titlebar.closest("[app]")
		const app = window.getAttribute("app")
		const mainifest = ApplicationManifests[app]
		const message = messageEvent.data

		switch(message.command) {
			case "style": {
				const style = document.documentElement.getAttribute("style").split("; ")
				const titlebar = style.filter((cssVar) => { return cssVar.startsWith("--windows-color") })

				return port.postMessage({ command: "css", result: titlebar })
			}
			case "icon": {
				const iconPath = mainifest.icon

				return port.postMessage({ command: "icon", result: `/apps/${app}/${iconPath}` })
			}
			case "move-start": {
				const details = { ...message.result, target: window }

				return WebdeskEvent.WINDOW_MOVE_START.emit(details)
			}
			case "move": {
				const details = { ...message.result, target: window }

				if (WMMover.inMove) { return WebdeskEvent.WINDOW_MOVE.emit(details) }
				else { return }
			}
			case "move-end": {
				const details = { ...message.result, target: window }

				return WebdeskEvent.WINDOW_MOVE_END.emit(details)
			}
			case "title": { return port.postMessage({ command: "title", result: app }) }
			case "close": { return WMTitlebarFactory.close({ target: window }) }
			case "minimise": { return WMTitlebarFactory.minimise({ target: window }) }
			case "maximise": { return WMTitlebarFactory.maximise({ target: window }) }
		}
	}

	constructor() {
		WebdeskEvent.TITLEBAR_SETUP.on(this.setup)
	}
}

const WMFactory = new class {
	space = document.querySelector(".Window.Space")
	open = [ ]

	async skeletonizeWindow(details) {
		const manifest = ApplicationManifests[details.app]

		const windowWrapper = document.createElement("article"),
			contentWrapper = document.createElement("section"),
			titlebarWrapper = document.createElement("header"),
			content = document.createElement("iframe"),
			titlebar = document.createElement("iframe")

		WebdeskEvent.TITLEBAR_SETUP.emit({ titlebar: titlebar, app: details.app })

		titlebar.classList.add("titlebar")

		titlebarWrapper.append(titlebar)

		content.classList.add("content")
		content.setAttribute("allowfullscreen", false)
		content.setAttribute("sandbox", `allow-scripts`)
		content.setAttribute("title", `Application "${details.app}"'s content`)
		content.src = `/apps/${details.app}/${manifest.index}`

		contentWrapper.append(content)

		windowWrapper.setAttribute("app", details.app)
		windowWrapper.append(titlebarWrapper, contentWrapper)

		// IDEA: Windows get added to the window space after the iframes loaded
		WMFactory.space.appendChild(windowWrapper)
		WMFactory.open.push(windowWrapper)

		WebdeskEvent.WINDOW_UPDATED_FOCUS.on((details) => { WMFocuser.updateZIndex(details, windowWrapper) })

		windowWrapper.addEventListener("pointerdown", (event) => {
			windowWrapper.setPointerCapture(event.pointerId)

			WebdeskEvent.WINDOW_RESIZE_START.emit({ target: windowWrapper, x: event.x, y: event.y })
		})

		windowWrapper.addEventListener("pointermove", (event) => {
			if (WMResizer.inResize) {
				WebdeskEvent.WINDOW_RESIZE.emit({ target: windowWrapper, x: event.x, y: event.y })
			}
		})

		windowWrapper.addEventListener("pointerup", (event) => {
			windowWrapper.releasePointerCapture(event.pointerId)

			WebdeskEvent.WINDOW_RESIZE_END.emit({ target: windowWrapper, x: event.x, y: event.y })
		})

		window.addEventListener("resize", () => { WMMover.updatePositionIfCollision({ target: windowWrapper }) })

		WebdeskEvent.WINDOW_OPEN.emit({ target: windowWrapper, app: details.app, })
	}

	constructor() {
		WebdeskEvent.LAUNCHER_CLICK.on(this.skeletonizeWindow)
	}
}

const WMFocuser = new class {
	focusedWindow = null

	// TODO: Improve this logic
	focusWindow(details) {
		if (details.target != WMFocuser.focusedWindow || !WMFocuser.focusedWindow) {
			if (WMFocuser.focusedWindow) { WMFocuser.focusedWindow.classList.remove("focus") }

			WebdeskEvent.WINDOW_UPDATED_FOCUS.emit({ old: WMFocuser.focusedWindow, new: details.target })

			WMFocuser.focusedWindow = details.target
			WMFocuser.focusedWindow.classList.add("focus")
		}
	}
	// IDEA: Make a UPDATE Z INDEX event for cleaner (event driven) logic
	updateZIndex(details, targetWindow) {
		const zIndex = parseInt(targetWindow.style.zIndex)

		if (details.new == targetWindow) { targetWindow.style.zIndex = 29 }
		else if (zIndex > 20) { targetWindow.style.zIndex = zIndex - 1 }
	}
	// IDEA: Conjure a system for passive highest z-index resolve
	shiftFocus(details) {
		const targetWindow = details.open.sort((a, b) => {
			if (a.style.zIndex > b.style.zIndex) { return a }
		}).at(0)

		if (targetWindow) {
			targetWindow.classList.add("focus")
			WebdeskEvent.WINDOW_UPDATED_FOCUS.emit({ old: WMFocuser.focusedWindow, new: targetWindow })
		}

		// NOTE: Could be undefined
		WMFocuser.focusedWindow = targetWindow
	}

	constructor() {
		WebdeskEvent.WINDOW_CLOSE.on(this.shiftFocus)

		WebdeskEvent.WINDOW_RESIZE_START.on(this.focusWindow)
		// IDEA: Quick window switching with WebdeskEvent.WINDOW_MOVE instead of WebdeskEvent.WINDOW_MOVE_START
		WebdeskEvent.WINDOW_MOVE_START.on(this.focusWindow)
		WebdeskEvent.WINDOW_OPEN.on(this.focusWindow)
	}
}

const WMMover = new class {
	anchor = { x: null, y: null }
	inMove = false

	init(details) {
		details.target.classList.add("moving")
		const box = details.target.getBoundingClientRect()

		WMMover.anchor = { x: details.x - box.left, y: details.y - box.top }
		WMMover.inMove = true
	}
	centerWindow(details) {
		const box = details.target.getBoundingClientRect()

		details.target.style.transform = `translate(${(window.innerWidth - box.width) / 2}px,${(window.innerHeight - box.height) / 2}px)`
	}
	followCursor(details) {
		const targetWindow = details.target

		details.target.style.transform = `translate(${details.x - WMMover.anchor.x}px,${details.y - WMMover.anchor.y}px)`
	}
	// TODO: Improve var naming and logic
	updatePositionIfCollision(details) {
		const box = details.target.getBoundingClientRect()

		// If the window is beyond the right of the screen, move the window back to the edge
		if (box.right > window.innerWidth) { box.x = (window.innerWidth - box.width) }
		// If the window is beyond the left of the screen, move the window back to the edge
		else if (box.left < 0) { box.x = 0 }
		// If the window is beyond the bottom of the screen, move the window back to the edge
		if (box.bottom > window.innerHeight) { box.y = (window.innerHeight - box.height) }
		// If the window is beyond the top of the screen, move the window back to the edge
		else if (box.top < 0) { box.y = 0 }

		details.target.style.transform = `translate(${box.x}px,${box.y}px)`
	}
	reset(details) {
		WMMover.inMove = false
		details.target.classList.remove("moving")
	}

	constructor() {
		// TODO: Make it toggle-able from settings
		WebdeskEvent.WINDOW_OPEN.on(this.centerWindow.bind(this))

		WebdeskEvent.WINDOW_MOVE_START.on(this.init)
		WebdeskEvent.WINDOW_MOVE.on(this.followCursor)
		WebdeskEvent.WINDOW_MOVE_END.on(this.reset)

		WebdeskEvent.WINDOW_RESIZE_END.on(this.updatePositionIfCollision)
		WebdeskEvent.WINDOW_MOVE_END.on(this.updatePositionIfCollision)
	}
}

const WMResizer = new class {
	box = null
	edges = { }
	anchor = { x: null, y: null }
	// TODO: Actually make this margin work and settable from settings
	resizeMargin = 12
	inResize = false

	init(details) {
		const box = WMResizer.box = details.target.getBoundingClientRect()
		WMResizer.inResize = true

		const offsets = {
			top: details.y - box.top,
			right: box.right - details.x,
			bottom: box.bottom - details.y,
			left: details.x - box.left,
		}

		const edges = WMResizer.edges = {
			top: offsets.top <= WMResizer.resizeMargin,
			right: offsets.right <= WMResizer.resizeMargin,
			bottom: offsets.bottom <= WMResizer.resizeMargin,
			left: offsets.left <= WMResizer.resizeMargin,
		}

		WMResizer.anchor.x = details.x
		WMResizer.anchor.y = details.y

		// TODO: There has to be a better way
		if (edges.top && edges.right || edges.bottom && edges.left) { details.target.classList.add("resizeXY2", "resizing") }
		else if (edges.top && edges.left || edges.bottom && edges.right) { details.target.classList.add("resizeXY1", "resizing") }
		else if (edges.left || edges.right) { details.target.classList.add("resizeX", "resizing") }
		else if (edges.top || edges.bottom) { details.target.classList.add("resizeY", "resizing") }
	}
	followCursor(details) {
		const resizingWindow = WMFactory.space.querySelector(".resizing")
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
	reset(details) {
		WMResizer.inResize = false
		details.target.classList.remove("resizeX", "resizeY", "resizeXY1", "resizeXY2", "resizing")
	}

	constructor() {
		WebdeskEvent.WINDOW_RESIZE_START.on(this.init)
		WebdeskEvent.WINDOW_RESIZE.on(this.followCursor)
		WebdeskEvent.WINDOW_RESIZE_END.on(this.reset)
	}
}

const AppDockManager = new class {
	element = document.querySelector(".AppDock")
	clock = this.element.querySelector(".Clock")
	open = this.element.querySelector(".Open")
	// TODO: There has to be a better way
	windowToIcon = new WeakMap()
	iconToWindow = new WeakMap()
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

	add(details) {
		const manifest = ApplicationManifests[details.app]
		if (manifest.service) { return }

		const icon = document.createElement("button")
		const image = document.createElement("img")
		const name = document.createElement("p")

		AppDockManager.windowToIcon.set(details.target, icon)
		AppDockManager.iconToWindow.set(icon, details.target)

		icon.append(name, image)
		icon.classList.add("focus")

		AppDockManager.open.append(icon)

		icon.addEventListener("click", (event) => { WebdeskEvent.ICON_CLICK.emit({ target: event.target.closest("[icon]") }) })
		icon.setAttribute("icon", details.app)
		image.src = `apps/${details.app}/${manifest.icon}`
		name.innerText = details.app
	}
	updateClosedWindow(details) {
		const icon = AppDockManager.windowToIcon.get(details.closed)

		if (icon) {
			AppDockManager.windowToIcon.delete(details.closed)
			icon.remove()
		}
	}
	// NOTE: iconToWindow is only used for this... Kinda wasteful but loops are sad
	focusLinkedWindow(details) {
		const window = AppDockManager.iconToWindow.get(details.target)

		window.classList.remove("minimised")
	}
	focus(details) {
		const oldFocus = AppDockManager.windowToIcon.get(details.old)
		const newFocus = AppDockManager.windowToIcon.get(details.new)

		if (oldFocus) { oldFocus.classList.remove("focus") }
		if (newFocus) { newFocus.classList.add("focus") }
	}
	updateClockElement(details) {
		for (const piece of details.update) {
			switch(piece) {
				case "seconds":
				case "minutes":
				case "hours": AppDockManager.clock.querySelector(`.${piece}`).innerText = `${time.clock[piece]}`.padStart(2, 0); continue

				case "day":
				case "month":
				case "year": AppDockManager.clock.querySelector(`.${piece}`).innerText = `${time.date[piece]}`.padStart(2, 0); continue
			}
		}
	}
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

// TODO: Titlebar category for titlebar messaging system
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
	async newUserBackgroundInit() {
		localStorage.setItem("backgrounds-id", 0)
		await webdeskDB.createTable("_backgrounds")
		await webdeskDB.set("_backgrounds", 0, `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="cool"><feTurbulence baseFrequency='0.01' numOctaves="1" result='noise' filterRes="1000"/><feDiffuseLighting in='noise' lighting-color='var(#D8DEE9)' surfaceScale='6'><feDistantLight azimuth='45' elevation='60' /></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#cool)" /></svg>`)
		await webdeskDB.set("_backgrounds", "last-ID", 0)
	}
	loadCssVars(root, prefix = "") {
		for (const key of Object.keys(root)) {
			if (root[key] instanceof Object) { this.loadCssVars(root[key], `${prefix ? prefix + "-" : ""}${key}`) }
			else { document.documentElement.style.setProperty(`--${prefix}-${key}`, root[key]) }
		}
	}
	async loadCustomization(customizationID) {
		const customization = await webdeskDB.get("_customizations", UIManager.currentCustomizationID = customizationID)

		this.loadCssVars(customization.windows, "windows")
		this.loadCssVars(customization.appdock, "appdock")
		this.loadCssVars(customization.launchers, "launchers")
	}
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

const SettingsManager = new class {
	launcher = LauncherManager.space.querySelector(`[launcher="settings"]`)
	window = WMFactory.space.querySelector(`[app="settings"]`)
	icon = AppDockManager.open.querySelector(`[icon="settings"]`)

	openWindow() {
		SettingsManager.window.style.display = "block"
	}
	setupLauncher() {
		this.launcher.addEventListener("click", () => { WebdeskEvent.LAUNCHER_CLICK.emit({ app: "settings" }) })
	}
	setupWindow() {
		SettingsManager.window.style.display = "none"
		WebdeskEvent.TITLEBAR_SETUP.emit({ titlebar: SettingsManager.window.querySelector(`.titlebar`), app: "settings" })
	}
	setupIcon() {
		SettingsManager.icon.style.display = "none"
	}

	constructor() {
		this.setupLauncher()

		WebdeskEvent.MANIFESTS_READY.on(this.setupWindow, this.setupIcon)
	}
}

// TODO: Add a versioning system that empties the cache if any server asset is updated
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
		this.loadInformation()
		// navigator.serviceWorker.register("/sw")
		// 	// .then((registration) => { console.log("Service Worker registered successfully!", registration) })
		// 	.catch((error) => { console.error(error) })
	}
}