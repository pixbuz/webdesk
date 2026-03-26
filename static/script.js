/// <reference lib="dom" />

// TODO: Animations
// TODO: Generator functions tho?

let newUser = false
// TODO: Make this into a object/class?
let ApplicationManifests

// Simplifies IndexDB interactions
const webdeskDB = new class {
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

window.webdeskDB = webdeskDB

class WebdeskEvent {
	static templates = {
		EMPTY: {},
		CLOCK: { update: [ ], },
		LAUNCHER: { app: null, },
		TARGET: { target: null },
		FOCUS: { old: null, new: null, },
		OPEN: { target: null, app: null },
		CLOSE: { closed: null, open: [ ] },
		CHANGE: { css: null, value: null, },
		TITLEBAR: { titlebar: null, app: null },
		BACKGROUND: { id: null, background: null, },
		INTERACTION: { target: null, x: null, y: null, force: false, },
		CUSTOMIZATION: { id: null, css: null, object: null, force: false, },
	}

	static MANIFESTS_READY = new WebdeskEvent(this.templates.EMPTY)

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

	static CUSTOMIZATION_LOADED = new WebdeskEvent(this.templates.CUSTOMIZATION)
	static CUSTOMIZATION_LOAD = new WebdeskEvent(this.templates.CUSTOMIZATION)
	static CUSTOMIZATION_CHANGE = new WebdeskEvent(this.templates.CHANGE)

	static BACKGROUND_LOADED = new WebdeskEvent(this.templates.BACKGROUND)
	static BACKGROUND_REMOVE_ALL = new WebdeskEvent(this.templates.EMPTY)
	static BACKGROUND_LOAD = new WebdeskEvent(this.templates.BACKGROUND)
	static BACKGROUND_UPLOAD = new WebdeskEvent(this.templates.EMPTY)
	static BACKGROUND_UPLOADED = new WebdeskEvent(this.templates.BACKGROUND)

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

window.WebdeskEvent = WebdeskEvent

fetch("/api/_/getManifests").then(async (response) => {
	ApplicationManifests = await response.json()
	WebdeskEvent.MANIFESTS_READY.emit(ApplicationManifests)
	if (newUser) { WMFactory.skeletonizeWindow({ app: "intro" }) }
	/* BEBUGGGG BEBUUUUUGGG */
	SettingsManager.openWindow()
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
	titlebarVars
	comPorts = new WeakMap()

	async setup(details) {
		const { titlebar, app } = details
		const path = ApplicationManifests[app].titlebar
		const manifest = ApplicationManifests[app]
		const channel = new MessageChannel()

		titlebar.setAttribute("allowfullscreen", false)
		titlebar.setAttribute("sandbox", "allow-scripts")
		titlebar.setAttribute("title", `"${app}"'s application titlebar`)

		if (path == "") { titlebar.src = "/api/_/defaultTitlebar" }
		else { titlebar.src = `/apps/${app}/${path}` }

		channel.port1.addEventListener("message", (messageEvent) => {
			WMTitlebarFactory.messageInterpreter(titlebar, channel.port1, messageEvent)
		})
		channel.port1.start()

		titlebar.addEventListener("load", () => {
			titlebar.contentWindow.postMessage({
				command: "init",
				data: { style: WMTitlebarFactory.titlebarVars, icon: `/apps/${app}/${manifest.icon}`, title: app, service: manifest.service }
			}, "*", [channel.port2])
		})

		WMTitlebarFactory.comPorts.set(titlebar, channel.port1)

		WebdeskEvent.CUSTOMIZATION_CHANGE.on((details) => { channel.port1.postMessage({ command: "css", data: details }) })
		WebdeskEvent.WINDOW_UPDATED_FOCUS.on(WMTitlebarFactory.relayFocusChange)
	}
	relayFocusChange(details) {
		const newFocusedTitlebar = details.new.querySelector(".titlebar")
		const newTitlebarPort = WMTitlebarFactory.comPorts.get(newFocusedTitlebar)
		newTitlebarPort.postMessage({ command: "focus", data: true })

		if (details.old) {
			const oldFocusedTitlebar = details.old.querySelector(".titlebar")
			const oldTitlebarPort = WMTitlebarFactory.comPorts.get(oldFocusedTitlebar)
			oldTitlebarPort.postMessage({ command: "focus", data: false })
		}
	}
	close(details) {
		if (details.app == "settings") { SettingsManager.closeWindow() }
		else { details.target.remove() }

		WebdeskEvent.WINDOW_CLOSE.emit({ closed: details.target, open: WMFactory.open })
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
	messageInterpreter(titlebar, port, messageEvent) {
		const window = titlebar.closest("[app]")
		const app = window.getAttribute("app")
		const message = messageEvent.data

		switch(message.command) {
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
			case "close": { return WMTitlebarFactory.close({ target: window, app: app }) }
			case "minimise": { return WMTitlebarFactory.minimise({ target: window }) }
			case "maximise": { return WMTitlebarFactory.maximise({ target: window }) }
		}
	}
	updateVar(details) {
		document.documentElement.style.setProperty(details.css, )
		const replacePos = WMTitlebarFactory.titlebarVars.indexOf(details.css) + details.css.length + 1

		WMTitlebarFactory.titlebarVars = WMTitlebarFactory.titlebarVars.substring(replacePos) + details.value + WMTitlebarFactory.titlebarVars.substring(replacePos + details.value.length)
	}
	setUpVars(details) {
		WMTitlebarFactory.titlebarVars = details.css
			.split("; ")
			.filter((cssVar) => { return cssVar.startsWith("--windows-color-titlebar") })
			.join(";")
	}

	constructor() {
		WebdeskEvent.TITLEBAR_SETUP.on(this.setup)
		WebdeskEvent.CUSTOMIZATION_LOADED.on(this.setUpVars)
		WebdeskEvent.CUSTOMIZATION_CHANGE.on(this.updateVar)
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
		titlebarWrapper.classList.add("titlebarWrapper")

		content.classList.add("content")
		content.setAttribute("allowfullscreen", false)
		content.setAttribute("sandbox", `allow-scripts`)
		content.setAttribute("title", `"${details.app}"'s application content`)
		content.src = `/apps/${details.app}/${manifest.index}`

		contentWrapper.append(content)
		contentWrapper.classList.add("contentWrapper")

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

		WebdeskEvent.WINDOW_OPEN.emit({ target: windowWrapper, app: details.app })
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

		details.target.style.left = Math.round((window.innerWidth - box.width) / 2) + "px"
		details.target.style.top = Math.round((window.innerHeight - box.height) / 2) + "px"
	}
	followCursor(details) {
		details.target.style.left = (details.x - WMMover.anchor.x) + "px"
		details.target.style.top = (details.y - WMMover.anchor.y) + "px"
	}
	updatePositionIfCollision(details) {
		const box = details.target.getBoundingClientRect()

		box.x = Math.min( Math.max(0, box.left), window.innerWidth - box.width )
		box.y = Math.min( Math.max(0, box.top), window.innerHeight - box.height )

		details.target.style.left = Math.round(box.x) + "px"
		details.target.style.top = Math.round(box.y) + "px"
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
	edges = { top: null, right: null, bottom: null, left: null }
	anchor = { x: null, y: null }
	resizeMargin = 6
	inResize = false
	startWindowBox = null
	startContentBox = null

	init(details) {
		WMResizer.startContentBox = details.target.querySelector(".contentWrapper").getBoundingClientRect()
		WMResizer.inResize = true
		WMResizer.anchor.x = details.x
		WMResizer.anchor.y = details.y

		const box = WMResizer.startWindowBox = details.target.getBoundingClientRect()

		const edges = WMResizer.edges = {
			top: details.y - box.top <= WMResizer.resizeMargin,
			right: box.right - details.x <= WMResizer.resizeMargin,
			bottom: box.bottom - details.y <= WMResizer.resizeMargin,
			left: details.x - box.left <= WMResizer.resizeMargin,
		}

		if (details.target.classList.contains("maximised")) { details.target.classList.remove("maximised") }

		if (edges.top && edges.left || edges.bottom && edges.right) { details.target.classList.add("XY1", "resizing") }
		else if (edges.top && edges.right || edges.bottom && edges.left) { details.target.classList.add("XY2", "resizing") }
		else if (edges.left || edges.right) { details.target.classList.add("X", "resizing") }
		else if (edges.top || edges.bottom) { details.target.classList.add("Y", "resizing") }
	}
	followCursor(details) {
		const content = details.target.querySelector(".contentWrapper")
		const { edges, anchor, startWindowBox, startContentBox } = WMResizer

		let { left, top } = startWindowBox
		let { width, height } = startContentBox

		const deltaX = details.x - anchor.x
		const deltaY = details.y - anchor.y

		if (edges.left) {
			width -= deltaX
			left += deltaX
		} else if (edges.right) { width += deltaX }

		if (edges.top) {
			height -= deltaY
			top += deltaY
		} else if (edges.bottom) { height += deltaY }

		details.target.style.left = `${Math.round(left)}px`
		details.target.style.top = `${Math.round(top)}px`
		content.style.height = `${Math.round(height)}px`
		content.style.width = `${Math.round(width)}px`
	}
	reset(details) {
		WMResizer.inResize = false
		details.target.classList.remove("X", "Y", "XY1", "XY2", "resizing")
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

const defaultWindowsCustomization = new class {
	color = {
		background: "#D8DEE9",
		border: "#4C566A",
		dots: "#2E3440",
		focus: {
			background: "#ECEFF4",
			border: "#2E3440",
			dots: "#3B4252",
		},
		titlebar: {
			title: "#2E3440",
			buttons: {
				close: "#D08770",
				maxi: "#EBCB8B",
				mini: "#A3BE8C",
			},
			focus: {
				title: "#2E3440",
				buttons: {
					close: "#D08770",
					maxi: "#EBCB8B",
					mini: "#A3BE8C",
				},
			}
		},
	}
	appearance = {
		width: "37.5vmax",
		height: "37.5vmin",
		"min-width": "17.5vmax",
		"min-height": "17.5vmin",
		"max-width": "95vmax",
		"max-height": "95vmin",
		titlebar: "2.5vmin",
		border: "2px",
		padding: "4px",
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

const UIManager = new class {
	backgroundElement = document.querySelector(".Background")
	currentCustomizationID = parseInt(localStorage.getItem("customization-id"))
	currentBackgroundID = parseInt(localStorage.getItem("background-id"))
	saveID = 1

	async newUserCustomizationInit() {
		const theme = {
			windows: defaultWindowsCustomization,
			appdock: defaultAppDockCustomization,
			launchers: defaultLaunchersCustomization,
		}

		localStorage.setItem("customization-id", 0)
		await webdeskDB.createTable("_customizations")
		await webdeskDB.set("_customizations", 0, theme)

		UIManager.currentCustomizationID = 0
	}
	async newUserBackgroundInit() {
		localStorage.setItem("background-id", 0)
		await webdeskDB.createTable("_backgrounds")
		await webdeskDB.set("_backgrounds", 0, `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="cool"><feTurbulence baseFrequency='0.01' numOctaves="1" result='noise' filterRes="1000"/><feDiffuseLighting in='noise' lighting-color='#D8DEE9' surfaceScale='6'><feDistantLight azimuth='45' elevation='60' /></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#cool)" /></svg>`)

		UIManager.currentBackgroundID = 0
	}
	loadCssVars(root, prefix = "") {
		for (const key of Object.keys(root)) {
			if (root[key] instanceof Object) { this.loadCssVars(root[key], `${prefix ? prefix + "-" : ""}${key}`) }
			else { document.documentElement.style.setProperty(`--${prefix}-${key}`, root[key]) }
		}
	}
	// TODO: Check if selected custom is the same as current
	async loadCustomization(details) {
		if (!details.object) { return }
		else if (!details.force && details.id == UIManager.currentBackgroundID) { return }

		localStorage.setItem("customization-id", UIManager.currentCustomizationID = details.id)

		UIManager.loadCssVars(details.object.windows, "windows")
		UIManager.loadCssVars(details.object.appdock, "appdock")
		UIManager.loadCssVars(details.object.launchers, "launchers")

		WebdeskEvent.CUSTOMIZATION_LOADED.emit({ id: UIManager.currentCustomizationID, css: document.documentElement.style.cssText, object: details.object })
	}
	// TODO: Check if selected bg is the same as current
	async loadBackground(details) {
		if (!details.background) { return }
		else if (!details.force && details.id == UIManager.currentBackgroundID) { return }

		localStorage.setItem("background-id", UIManager.currentBackgroundID = details.id)
		UIManager.backgroundElement.innerHTML = details.background

		WebdeskEvent.BACKGROUND_LOADED.emit({ id: details.id, background: details.background })
	}
	async uploadBackgroundToDB(details) {
		const savedBackgrounds = await webdeskDB.getAll("_backgrounds")
		const ID = UIManager.saveID++

		// TODO: vvv Improve this with some sort of frontend thing informing
		if (!details.background) { return }
		else if (savedBackgrounds.includes(details.background)) { return }

		WebdeskEvent.BACKGROUND_LOAD.emit({ id: ID, background: details.background })
		webdeskDB.set("_backgrounds", ID, details.background)
		WebdeskEvent.BACKGROUND_UPLOADED.emit({ id: ID, background: details.background })
	}
	async emptyBackgroundsDatabase() {
		for (let i = 1; i < UIManager.saveID; i++) { await webdeskDB.delete("_backgrounds", i) }

		WebdeskEvent.BACKGROUND_LOAD.emit({ id: 0, background: await webdeskDB.get("_backgrounds", 0) })
	}
	previewCustomization(details) {
		document.documentElement.style.setProperty(details.css, details.value)
	}

	constructor() {(async () => {
		if (isNaN(this.currentCustomizationID)) { await this.newUserCustomizationInit() }
		if (isNaN(this.currentBackgroundID)) { await this.newUserBackgroundInit() }

		WebdeskEvent.CUSTOMIZATION_CHANGE.on(this.previewCustomization)
		WebdeskEvent.CUSTOMIZATION_LOAD.on(this.loadCustomization)

		WebdeskEvent.BACKGROUND_REMOVE_ALL.on(this.emptyBackgroundsDatabase)
		WebdeskEvent.BACKGROUND_UPLOAD.on(this.uploadBackgroundToDB)
		WebdeskEvent.BACKGROUND_LOAD.on(this.loadBackground)
		
		WebdeskEvent.CUSTOMIZATION_LOAD.emit({ id: this.currentCustomizationID, css: null, object: await webdeskDB.get("_customizations", this.currentCustomizationID), force: true })
		WebdeskEvent.BACKGROUND_LOAD.emit({ id: this.currentBackgroundID, background: await webdeskDB.get("_backgrounds", this.currentBackgroundID), force: true })

		this.saveID = (await webdeskDB.getAll("_backgrounds")).length
	})()}
}

const SettingsManager = new class {
	launcher = LauncherManager.space.querySelector(`[launcher="settings"]`)
	window = WMFactory.space.querySelector(`[app="settings"]`)
	icon = AppDockManager.open.querySelector(`[icon="settings"]`)

	openWindow() {
		SettingsManager.window.style.display = "block"

		WebdeskEvent.WINDOW_OPEN.emit({ target: SettingsManager.window, app: "settings" })
		WebdeskEvent.WINDOW_UPDATED_FOCUS.on((details) => { WMFocuser.updateZIndex(details, SettingsManager.window) })

		SettingsManager.window.addEventListener("pointerdown", (event) => {
			SettingsManager.window.setPointerCapture(event.pointerId)

			WebdeskEvent.WINDOW_RESIZE_START.emit({ target: SettingsManager.window, x: event.x, y: event.y })
		})

		SettingsManager.window.addEventListener("pointermove", (event) => {
			if (WMResizer.inResize) {
				WebdeskEvent.WINDOW_RESIZE.emit({ target: SettingsManager.window, x: event.x, y: event.y })
			}
		})

		SettingsManager.window.addEventListener("pointerup", (event) => {
			SettingsManager.window.releasePointerCapture(event.pointerId)

			WebdeskEvent.WINDOW_RESIZE_END.emit({ target: SettingsManager.window, x: event.x, y: event.y })
		})

		SettingsManager.icon.style.display = "block"
	}
	closeWindow() {
		SettingsManager.window.style.display = "none"
		SettingsManager.icon.style.display = "none"

		SettingsManager.window.classList.remove("maximised")
		SettingsManager.window.classList.remove("minimised")
	}
	setupLauncher() {
		this.launcher.addEventListener("click", this.openWindow)
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

/* BEBUGGGG BEBUUUUUGGG */
// UIManager.newUserCustomizationInit()
// UIManager.newUserBackgroundInit()

export {}