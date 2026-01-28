// Utility Class 👍
const Utilities = new class UtilitiesClass {
	// --- Attributes ---
	initTime = new Date()

	clockTime = {
		"seconds": this.initTime.getSeconds(),
		"minutes": this.initTime.getMinutes(),
		"hours": this.initTime.getHours(),

		"day": this.initTime.getDate(),
		"month": this.initTime.getMonth() + 1,
		"year": this.initTime.getFullYear(),
	}

	WINDOW_EVENT_TEMPLATE = {
		app: "",
		id: null,
		target: null,
	}

	TITLEBAR_EVENT_TEMPLATE = this.WINDOW_EVENT_TEMPLATE

	LAUNCHER_EVENT_TEMPLATE = { app: "" }

	// --- Inner Objects ---
	WebdeskOSEvents = class {
		constructor(eventName, objectTemplate = {}) {
			this.name = eventName
			this.template = objectTemplate
		}

		emit(data = {}) {
			const details = { ...this.template, ...data }
			const event = new CustomEvent(this.name, {
				detail: details,
				bubbles: true,
				composed: true
			})
			window.dispatchEvent(event)
		}

		on(thisContext = null, callBackFunctions = [], oneTime = false) {
			if (callBackFunctions instanceof Function) { callBackFunctions = [ callBackFunctions ] }
			callBackFunctions.map((callBackFunction) => {
				window.addEventListener(this.name, ((event) => { callBackFunction(event.detail) }).bind(thisContext), { once: oneTime })
			})
		}
	}

	webdeskDB = {
		parent: this,
		version: 0,
		ready: null,
		updateLock: Promise.resolve(),

		init() {
			const dbVersion = localStorage.getItem("db-version")
			if (dbVersion == undefined) {
				window.dispatchEvent(new Event("FirstTimeInit"))
				localStorage.setItem("db-version", 1)
				this.version = 1
			} else { this.version = parseInt(dbVersion) }

			this.ready = new Promise((resolve, reject) => {
				const req = indexedDB.open("webdesk", this.version)
				req.onsuccess = () => {
					req.result.onversionchange = () => { req.result.close() }
					resolve(req.result)
				}
				req.onblocked = req.onerror = (event) => reject(event)
			})
		},

		async _run(tableName, mode, callback) {
			await this.updateLock
			const database = await this.ready
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

		get(table, key) {
			return this._run(table, 0, (store) => { return store.get(key) })
		},

		getAll(table) {
			return this._run(table, 0, (store) => { return store.getAll() })
		},

		set(table, key, value) {
			return this._run(table, 1, (store) => { return store.put(value, key) })
		},

		delete(table, key) {
			return this._run(table, 1, (store) => { return store.delete(key) })
		},

		_addTable(tableName) {
			return new Promise((resolve, reject) => {
				const req = indexedDB.open("webdesk", ++this.version)
				req.onupgradeneeded = (event) => {
					const database = event.target.result
					database.createObjectStore(tableName)
				}
				req.onsuccess = (event) => {
					const database = event.target.result
					database.onversionchange = () => { database.close() }
					localStorage.setItem("db-version", this.version)
					resolve()
				}
				req.onblocked = req.onerror = (event) => reject(event)
			})
		},

		async createTable(tableName) {
			this.updateLock = this.updateLock.then(async () => {
				const database = await this.ready
				if (database.objectStoreNames.contains(tableName)) return
				this.ready = new Promise((resolve) => { this._resolveNewDb = resolve })
				return this._addTable(tableName)
			})
			return this.updateLock
		}
	}

	// --- Methods ---
	// Window Context
	getWindowInfo(appWindow) {
		const windowID = appWindow.getAttribute("id")
		const appName = appWindow.getAttribute("app")
		return { id: windowID, target: appWindow, app: appName }
	}

	// Clock Context
	updateClock() {
		this.clockTime.seconds++
		if (this.clockTime.seconds >= 60) {
			this.clockTime.seconds = 0
			this.clockTime.minutes++
			this.CLOCK_UPDATE_SECONDS.emit(this.clockTime)
			this.CLOCK_UPDATE_MINUTES.emit(this.clockTime)
		} else { this.CLOCK_UPDATE_SECONDS.emit(this.clockTime) }

		if (this.clockTime.minutes >= 60) {
			this.clockTime.minutes = 0
			this.clockTime.hours++
			this.CLOCK_UPDATE_MINUTES.emit(this.clockTime)
			this.CLOCK_UPDATE_HOURS.emit(this.clockTime)
		} else { this.CLOCK_UPDATE_MINUTES.emit(this.clockTime) }

		if (this.clockTime.hours >= 24) {
			this.clockTime.hours = 0
			this.clockTime.day++
			this.CLOCK_UPDATE_HOURS.emit(this.clockTime)
			this.CLOCK_UPDATE_DAY.emit(this.clockTime)
		} else { this.CLOCK_UPDATE_HOURS.emit(this.clockTime) }
	}

	// --- Constructor ---
	constructor() {
		this.webdeskDB.init()

		this.WINDOW_OPEN = new this.WebdeskOSEvents("window-open", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_CLOSE = new this.WebdeskOSEvents("window-closed", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_MOVE = new this.WebdeskOSEvents("window-move_end", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_MOVE_END = new this.WebdeskOSEvents("window-move", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_RESIZE = new this.WebdeskOSEvents("window-resize_end", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_RESIZE_END = new this.WebdeskOSEvents("window-resize", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_MAXIMISE = new this.WebdeskOSEvents("window-maximised", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_MAXIMISE_END = new this.WebdeskOSEvents("window-maximised_end", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_MINIMISE = new this.WebdeskOSEvents("window-minimised", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_MINIMISE_END = new this.WebdeskOSEvents("window-minimised_end", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_CHANGED_FOCUS = new this.WebdeskOSEvents("window-changed_focus", this.WINDOW_EVENT_TEMPLATE)
		this.WINDOW_CHECK_COLLISION = new this.WebdeskOSEvents("window-check_collision", this.WINDOW_EVENT_TEMPLATE)

		this.TITLEBAR_MOUSEDOWN = new this.WebdeskOSEvents("titlebar-mousedown", this.TITLEBAR_EVENT_TEMPLATE)

		this.CLOCK_UPDATE_SECONDS = new this.WebdeskOSEvents("clock-update-seconds", this.CLOCK_EVENT_TEMPLATE)
		this.CLOCK_UPDATE_MINUTES = new this.WebdeskOSEvents("clock-update-minutes", this.CLOCK_EVENT_TEMPLATE)
		this.CLOCK_UPDATE_HOURS = new this.WebdeskOSEvents("clock-update-hours", this.CLOCK_EVENT_TEMPLATE)
		this.CLOCK_UPDATE_DAY = new this.WebdeskOSEvents("clock-update-day", this.CLOCK_EVENT_TEMPLATE)
		this.CLOCK_UPDATE_MONTH = new this.WebdeskOSEvents("clock-update-month", this.CLOCK_EVENT_TEMPLATE)
		this.CLOCK_UPDATE_YEAR = new this.WebdeskOSEvents("clock-update-year", this.CLOCK_EVENT_TEMPLATE)

		this.LAUNCHER_CLICKED = new this.WebdeskOSEvents("launcher-clicked", this.LAUNCHER_EVENT_TEMPLATE)

		setTimeout(() => {
			this.updateClock()
			setInterval(this.updateClock.bind(this), 1000)
		}, 1000 - this.initTime.getMilliseconds())

		window.utilities = {
			webdeskDB: this.webdeskDB,
			saveBackground: async (htmlObject) => {
				const lastBackgroundID = localStorage.getItem("backgrounds-last-id")
				await this.webdeskDB.set("_backgrounds", lastBackgroundID + 1, htmlObject)
				UI.loadBackground(lastBackgroundID + 1)
				localStorage.setItem("backgrounds-last-id", lastBackgroundID + 1)
			}
		}

		// window.addEventListener("firstTimeInit", () => {
		// 	window.addEventListener("load", async () => {
		// 		await this.webdeskDB.createTable("settings")
		// 		await this.webdeskDB.set("settings", "dbclass", `return ${UtilitiesClass.toString()}`)
		// 	})
		// })
	}
}

const AppDock = new class AppDockClass {
	// --- Attributes ---
	element = document.querySelector(".AppDock")
	clock = this.element.querySelector(".Clock")
	windowIcons = this.element.querySelector(".Open")
	assetsDockIcon = document.getElementsByName("DockIcon")[0]

	// --- Inner Objects ---
	icons = {
		windowDockIconMap: new WeakMap(),

		windowOpenendUpdate(details) {
			const dockIcon = AppDock.assetsDockIcon.cloneNode(true)
			const appName = details.target.getAttribute("app")
			AppDock.windowIcons.append(dockIcon)

			dockIcon.addEventListener("click", this.focusLinkedWindow.bind(this))
			dockIcon.setAttribute("app", appName)
			dockIcon.querySelector(".Icon").src = `apps/${appName}/icon`
			this.windowDockIconMap.set(details.target, dockIcon)
		},

		windowClosedUpdate(details) {
			const dockIcon = this.windowDockIconMap.get(details.target)
			if (dockIcon) {
				dockIcon.remove()
				this.windowDockIconMap.delete(details.target)
			}
		},

		windowMinimisedUpdate(details) {
			const dockIcon = this.windowDockIconMap.get(details.target)
			if (dockIcon) dockIcon.classList.add("mini")
		},

		focusLinkedWindow(event) {
			const appName = event.target.closest(`[name=\"DockIcon\"]`).getAttribute("app")
			const window = WindowManager.windowSpace.querySelector(`[app=\"${appName}\"]`)
			window.classList.remove("minimised")
			window.classList.remove("maximised")
		}
	}

	// --- Methods ---
	// No standalone methods currently outside inner objects

	// --- Constructor ---
	constructor() {
		this.clock.querySelector(".Seconds").innerText = `${Utilities.clockTime.seconds}`.padStart(2, 0)
		this.clock.querySelector(".Minutes").innerText = `${Utilities.clockTime.minutes}`.padStart(2, 0)
		this.clock.querySelector(".Hours").innerText = `${Utilities.clockTime.hours}`.padStart(2, 0)
		this.clock.querySelector(".Day").innerText = `${Utilities.clockTime.day}`.padStart(2, 0)
		this.clock.querySelector(".Month").innerText = `${Utilities.clockTime.month}`.padStart(2, 0)
		this.clock.querySelector(".Year").innerText = Utilities.clockTime.year

		Utilities.CLOCK_UPDATE_SECONDS.on(this, (time) => { this.clock.querySelector(".Seconds").innerText = `${time.seconds}`.padStart(2, 0) })
		Utilities.CLOCK_UPDATE_MINUTES.on(this, (time) => { this.clock.querySelector(".Minutes").innerText = `${time.minutes}`.padStart(2, 0) })
		Utilities.CLOCK_UPDATE_HOURS.on(this, (time) => { this.clock.querySelector(".Hours").innerText = `${time.hours}`.padStart(2, 0) })
		Utilities.CLOCK_UPDATE_DAY.on(this, (time) => { this.clock.querySelector(".Day").innerText = `${time.day}`.padStart(2, 0) })
		Utilities.CLOCK_UPDATE_MONTH.on(this, (time) => { this.clock.querySelector(".Month").innerText = `${time.month}`.padStart(2, 0) })
		Utilities.CLOCK_UPDATE_YEAR.on(this, (time) => { this.clock.querySelector(".Year").innerText = time.year })

		Utilities.WINDOW_OPEN.on(this, [this.icons.windowOpenendUpdate])
		Utilities.WINDOW_CLOSE.on(this, [this.icons.windowClosedUpdate])
		Utilities.WINDOW_MINIMISE.on(this, [this.icons.windowMinimisedUpdate])
		Utilities.WINDOW_MINIMISE_END.on(this, [this.icons.windowMinimisedUpdate])
	}
}

const Launchers = new class LaunchersClass {
	// --- Attributes ---
	space = document.querySelector(".Launcher.Space")
	assetsLauncher = document.getElementsByName("Launcher")[0]

	// --- Methods ---
	addLaunchers(appsManifests) {
		const appNames = Object.keys(appsManifests)
		appNames.sort().map((appName) => {
			const launcher = this.assetsLauncher.cloneNode(true)
			const description = appsManifests[appName].description
			this.space.appendChild(launcher)

			launcher.setAttribute("app", appName)
			launcher.setAttribute("title", description == "undefined" ? appName : description)
			launcher.querySelector(".Name").innerText = appName
			launcher.querySelector(".Icon").src = `apps/${appName}/icon`

			launcher.addEventListener("click", () => { Utilities.LAUNCHER_CLICKED.emit({ app: appName }) })
		})
	}
}

const Sockets = new class SocketsClass {
	// --- Attributes ---
	webdeskBackend = new WebSocket(`/`)
	connectionTimeout = null

	// --- Methods ---
	// Communication Context
	serverQuery(message) {
		this.webdeskBackend.send(message)

		return new Promise((resolve) => {
			this.webdeskBackend.addEventListener("message", (response) => {
				resolve(response.data)
			}, { once: true })
		})
	}

	// Error Handling Context
	connectionError() {
		console.log("Unable to connect to Web Desk's Backend")
	}

	// --- Constructor ---
	constructor() {
		this.connectionTimeout = setTimeout(this.connectionError.bind(this), 10000)
		this.webdeskBackend.addEventListener("error", this.connectionError.bind(this), { once: true })
		this.webdeskBackend.addEventListener("open", async () => {
			clearTimeout(this.connectionTimeout)
			const appsManifests = JSON.parse(await this.serverQuery("app manifests"))
			Launchers.addLaunchers(appsManifests)
		}, { once: true })
	}
}

const UI = new class UIClass {
	// --- Attributes ---
	windows = {
		"colors": {
			"background": "#D8DEE9",
			"border": "#4C566A",
			"title": "#2E3440",
			"dots": "#2E3440",
			"buttons": { "close": "#D08770", "maxi": "#EBCB8B", "mini": "#A3BE8C" },
			"focus": {
				"background": "#ECEFF4",
				"border": "#2E3440",
				"title": "#2E3440",
				"dots": "#3B4252",
				"buttons": { "close": "#D08770", "maxi": "#EBCB8B", "mini": "#A3BE8C" }
			}
		},
		"sizes": { "background": "", "titlebar": "", "border": "", "title": "", "icon": "", "dots": "", "buttons": { "close": "", "maxi": "", "mini": "" } },
		"behaviour": { "moveSmoothing": null, "resizeSmoothing": null, "maximizeSmoothing": null, "minimizeSmoothing": null, "closeSmoothing": null }
	}

	launchers = {
		"colors": { "text": "#2E3440" },
		"sizes": { "text": "" },
		"behaviour": {}
	}

	element = {
		"colors": {
			"background": "#4C566A", "border": "#434C5E", "text": "#D8DEE9",
			"icons": { "background": "transparent", "focus": { "background": "transparent" }, "mini": { "background": "transparent" }, "maxi": { "background": "transparent" } }
		},
		"sizes": { "borderWidth": "none", "borderStyle": "solid" },
		"behaviour": {
			"autoHide": { "enabled": null, "upTime": null, "upDelay": null, "downDelay": null },
			"hideOnMaximisedWindow": { "enabled": null, "upTime": null, "upDelay": null, "downDelay": null }
		}
	}

	customName = "nord"
	customType = 1
	background = 0

	// --- Methods ---
	// Initialization Context
	async firstTimeInit() {
		localStorage.setItem("customization", JSON.stringify(this.windows))
		localStorage.setItem("backgrounds-last-id", 0)
		await Utilities.webdeskDB.createTable("_backgrounds")
		await Utilities.webdeskDB.set("_backgrounds", 0, `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100%\" height=\"100%\"><filter id=\"cool\"><feTurbulence baseFrequency='0.01' numOctaves=\"1\" result='noise' filterRes=\"1000\"/><feDiffuseLighting in='noise' lighting-color='var(#D8DEE9)' surfaceScale='6'><feDistantLight azimuth='45' elevation='60' /></feDiffuseLighting></filter><rect width=\"100%\" height=\"100%\" filter=\"url(#cool)\" /></svg>`)
	}

	// Loading Context
	loadCssVar(root, prefix = "") {
		for (const key of Object.keys(root)) {
			if (root[key] instanceof Object) { this.loadCssVar(root[key], `${prefix ? prefix + "-" : ""}${key}`) }
			else { document.documentElement.style.setProperty(`--${prefix}-${key}`, root[key]) }
		}
	}

	async loadBackground(override) {
		const backgroundWrapper = document.querySelector(".Background")
		const backgroundID = override || this.background
		const backgroundContents = await Utilities.webdeskDB.get("_backgrounds", backgroundID)
		backgroundWrapper.innerHTML = backgroundContents
	}

	// --- Constructor ---
	constructor () {
		this.loadCssVar(this.windows.colors, null)
		this.loadBackground()
	}
}

const WindowManager = new class WindowManagerClass {
	// --- Attributes ---
	windowCommandChannel = new BroadcastChannel("wm/commands")
	assetsWindow = document.getElementsByName("Window")[0]
	windowSpace = document.querySelector(".Window.Space")
	grabPos = [ false, false, false, false ]
	windowsBoundryBoxes = new WeakMap()
	resizingWindow = null
	focusedWindow = null
	movingWindow = null
	clickOffsets = []
	windowID = 0

	// --- Methods ---
	// Lifecycle Context
	openWindow(details) {
		console.log(this)
		const appWindow = this.assetsWindow.cloneNode(true)
		const appName = details.app

		appWindow.addEventListener("mousedown", this.windowInteraction.bind(this))
		appWindow.querySelector(".Titlebar").addEventListener("mousedown", this.enableMovement.bind(this))
		appWindow.querySelector(".Close").addEventListener("click", () => this.closeWindow(appWindow))
		appWindow.querySelector(".Minimize").addEventListener("click", () => this.minimizeWindow(appWindow))
		appWindow.querySelector(".Maximise").addEventListener("click", () => this.maximiseWindow(appWindow))

		appWindow.setAttribute("app", appName)
		appWindow.setAttribute("id", this.windowID)
		appWindow.querySelector("iframe").src = `apps/${appName}/?${this.windowID}`
		appWindow.querySelector(".Icon").src = `apps/${appName}/icon`
		appWindow.querySelector(".Title").innerText = appName

		this.windowSpace.appendChild(appWindow)
		this.windowID++
		Utilities.WINDOW_OPEN.emit(Utilities.getWindowInfo(appWindow))
	}

	closeWindow(appWindow) {
		this.windowsBoundryBoxes.delete(appWindow)
		setTimeout(() => { appWindow.remove() }, 100)
		Utilities.WINDOW_CLOSE.emit(Utilities.getWindowInfo(appWindow))
	}

	// Transform Context
	maximiseWindow(appWindow) {
		if (!appWindow.classList.contains("maximised")) {
			appWindow.classList.add("maximised")
			Utilities.WINDOW_MAXIMISE.emit(Utilities.getWindowInfo(appWindow))
		} else {
			appWindow.classList.remove("maximised")
			Utilities.WINDOW_MAXIMISE_END.emit(Utilities.getWindowInfo(appWindow))
		}
	}

	minimizeWindow(appWindow) {
		appWindow.classList.add("minimised")
		Utilities.WINDOW_MINIMISE.emit(Utilities.getWindowInfo(appWindow))
	}

	centerNewWindow(details) {
		const boundingBox = details.target.getBoundingClientRect()
		this.windowsBoundryBoxes.set(details.target, boundingBox)
		boundingBox.x = ( window.innerWidth - boundingBox.width ) / 2
		boundingBox.y = ( window.innerHeight - boundingBox.height ) / 2
		details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
	}

	// Movement Context
	enableMovement(event) {
		const appWindow = event.target.closest(`[name=\"Window\"]`)
		if (event.target.tagName === "BUTTON" || appWindow.classList.contains("maximised")) return
		this.movingWindow = appWindow
		this.clickOffsets = [ event.x , event.y ]
		appWindow.classList.add("moving")
		Utilities.WINDOW_MOVE.emit(Utilities.getWindowInfo(appWindow))
	}

	moveWindow(moveEvent) {
		if (!this.movingWindow) return
		const xPos = moveEvent.x - this.clickOffsets[0] + this.windowsBoundryBoxes.get(this.movingWindow).x
		const yPos = moveEvent.y - this.clickOffsets[1] + this.windowsBoundryBoxes.get(this.movingWindow).y
		this.movingWindow.style.transform = `translate(${xPos}px,${yPos}px)`
	}

	appWindowMovementEnd() {
		if (!this.movingWindow) return
		this.movingWindow.classList.remove("moving")
		Utilities.WINDOW_MOVE_END.emit(Utilities.getWindowInfo(this.movingWindow))
		this.movingWindow = null
	}

	// Resize Context
	windowInteraction(event) {
		if (event.target.getAttribute("name") == "Window") {
			const boundingBox = this.windowsBoundryBoxes.get(event.target)
			this.clickOffsets = [ event.x, event.y ]
			const relClickX = this.clickOffsets[0] - boundingBox.x
			const relClickY = this.clickOffsets[1] - boundingBox.y

			this.grabPos = [ (relClickY <= 6), (boundingBox.width - relClickX <= 6), (boundingBox.height - relClickY <= 6), (relClickX <= 6) ]
			if (this.grabPos[1] || this.grabPos[3]) { event.target.classList.add("resizeX") }
			if (this.grabPos[0] || this.grabPos[2]) { event.target.classList.add("resizeY") }
			if (this.grabPos[0] && this.grabPos[3] || this.grabPos[1] && this.grabPos[2]) { event.target.classList.add("resizeXY1") }
			else if (this.grabPos[0] && this.grabPos[1] || this.grabPos[2] && this.grabPos[3]) { event.target.classList.add("resizeXY2") }

			this.resizingWindow = event.target
			Utilities.WINDOW_RESIZE.emit(Utilities.getWindowInfo(this.resizingWindow))
		}
	}

	resizeWindow(moveEvent) {
		if (!this.resizingWindow) return
		const boundingBox = this.windowsBoundryBoxes.get(this.resizingWindow)

		if (this.grabPos[0] && this.grabPos[3]) {
			this.resizingWindow.style.transform = `translate(${boundingBox.x + moveEvent.x - this.clickOffsets[0]}px,${boundingBox.y + moveEvent.y - this.clickOffsets[1]}px)`
			this.resizingWindow.style.height = `${boundingBox.height - moveEvent.y + this.clickOffsets[1]}px`
			this.resizingWindow.style.width = `${boundingBox.width - moveEvent.x + this.clickOffsets[0]}px`
			return
		}

		if (this.grabPos[0]) {
			this.resizingWindow.style.transform = `translate(${boundingBox.x}px,${boundingBox.y + moveEvent.y - this.clickOffsets[1]}px)`
			this.resizingWindow.style.height = `${boundingBox.height - moveEvent.y + this.clickOffsets[1]}px`
		} else if (this.grabPos[2]) { this.resizingWindow.style.height = `${boundingBox.height + moveEvent.y - this.clickOffsets[1]}px` }

		if (this.grabPos[3]) {
			this.resizingWindow.style.transform = `translate(${boundingBox.x + moveEvent.x - this.clickOffsets[0]}px,${boundingBox.y}px)`
			this.resizingWindow.style.width = `${boundingBox.width - moveEvent.x + this.clickOffsets[0]}px`
		} else if (this.grabPos[1]) { this.resizingWindow.style.width = `${boundingBox.width + moveEvent.x - this.clickOffsets[0]}px` }
	}

	appWindowResizeEnd() {
		if (!this.resizingWindow) return
		this.grabPos = [ false, false, false, false ]
		this.resizingWindow.classList.remove("resizeY", "resizeX", "resizeXY1", "resizeXY2")
		Utilities.WINDOW_RESIZE_END.emit(Utilities.getWindowInfo(this.resizingWindow))
		this.resizingWindow = null
	}

	// Focus Context
	focusWindow(details) {
		if (details.target != this.focusedWindow) {
			for (const win of document.getElementsByName("Window")) {
				win.classList.remove("focus")
				const zIndex = parseInt(win.style.zIndex) || 20
				if (zIndex > 20) { win.style.zIndex = zIndex - 1 }
			}
			this.focusedWindow = details.target
			this.focusedWindow.classList.add("focus")
			this.focusedWindow.style.zIndex = 29
			Utilities.WINDOW_CHANGED_FOCUS.emit(Utilities.getWindowInfo(details.target))
		}
	}

	shiftWindowFocus() {
		for (const win of document.getElementsByName("Window")) {
			win.classList.remove("focus")
			const zIndex = parseInt(win.style.zIndex) || 20
			if (zIndex < 29) { win.style.zIndex = zIndex + 1 }
			if (zIndex == 28) { win.classList.add("focus") }
		}
	}

	// Collision Context
	updatePositionBasedOnViewportCollision(details) {
		const boundingBox = details.target.getBoundingClientRect()
		if (boundingBox.right > window.innerWidth) boundingBox.x = ( window.innerWidth - boundingBox.width )
		else if (boundingBox.left < 0) boundingBox.x = 0
		if (boundingBox.bottom > window.innerHeight) boundingBox.y = ( window.innerHeight - boundingBox.height )
		else if (boundingBox.top < 0) boundingBox.y = 0
		details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
		this.windowsBoundryBoxes.set(details.target, boundingBox)
	}

	checkAllViewportCollisions() {
		for (const appWindow of document.getElementsByName("Window")) { this.updatePositionBasedOnViewportCollision({target: appWindow}) }
	}

	// Communication Context
	windowCommandChannelHandler(event) {
		const command = event.data.split(" ")
		switch(command[0]) {
			case "close":
				const appWindow = this.windowSpace.querySelector(`div[id=\"${command[1]}\"]`)
				if (appWindow) this.closeWindow(appWindow)
				break
		}
	}

	// --- Constructor ---
	constructor() {
		Utilities.WINDOW_OPEN.on(this, [this.centerNewWindow, this.focusWindow])
		Utilities.WINDOW_CLOSE.on(this, [this.shiftWindowFocus])
		Utilities.WINDOW_MOVE.on(this, [this.focusWindow])
		Utilities.WINDOW_MOVE_END.on(this, [this.updatePositionBasedOnViewportCollision])
		Utilities.WINDOW_RESIZE.on(this, [this.focusWindow])
		Utilities.WINDOW_RESIZE_END.on(this [this.updatePositionBasedOnViewportCollision])

		Utilities.LAUNCHER_CLICKED.on(this, [this.openWindow])

		this.windowCommandChannel.addEventListener("message", this.windowCommandChannelHandler.bind(this))
		document.addEventListener("mousemove", this.moveWindow.bind(this))
		document.addEventListener("mousemove", this.resizeWindow.bind(this))
		document.addEventListener("mouseup", this.appWindowMovementEnd.bind(this))
		document.addEventListener("mouseup", this.appWindowResizeEnd.bind(this))
		window.addEventListener("resize", this.checkAllViewportCollisions.bind(this))
	}
}

const Animations = new class AnimationClass {
	// --- Attributes ---
	removeClassTimeout = undefined

	// --- Inner Objects ---
	windows = {
		openAnimation: (details) => {
			details.target.classList.add("opening")
			setTimeout(() => details.target.classList.remove("opening"), 100)
		},
		toMaximisedAnimation: (details) => {
			details.target.classList.add("to-maximised")
			setTimeout(() => { details.target.classList.remove("to-maximised") }, 100)
		},
		fromMaximisedAnimation: (details) => {
			details.target.classList.add("from-maximised")
			setTimeout(() => { details.target.classList.remove("from-maximised") }, 100)
		},
		toMinimisedAnimation: (details) => {
			details.target.classList.add("to-minimised")
			setTimeout(() => { details.target.classList.remove("to-minimised") }, 100)
		},
		fromMinimisedAnimation: (details) => {
			details.target.classList.add("from-minimised")
			setTimeout(() => { details.target.classList.remove("from-minimised") }, 100)
		},
		closeAnimation: (details) => {
			details.target.classList.add("closing")
		}
	}

	appdock = {
		parent: this,
		windowMaximisedAnimation() {
			this.showAnimation()
			clearTimeout(this.parent.removeClassTimeout)
			if (!AppDock.element.matches(":hover")) {
				this.parent.removeClassTimeout = setTimeout(this.hideAnimation.bind(this), 2500)
			}
		},
		hideAnimation() { AppDock.element.classList.remove("up") },
		showAnimation() { AppDock.element.classList.add("up") },
		icons: {
			openAnimation: (details) => {},
			closeAnimation: (details) => {},
			focusAnimation: (details) => {}
		}
	}

	// --- Methods ---
	// No standalone methods currently outside inner objects

	// --- Constructor ---
	constructor() {
		Utilities.WINDOW_OPEN.on(this, [this.windows.openAnimation, this.appdock.icons.openAnimation])
		Utilities.WINDOW_CLOSE.on(this, [this.windows.closeAnimation, this.appdock.icons.closeAnimation])
		Utilities.WINDOW_CHANGED_FOCUS.on(this, [this.appdock.icons.focusAnimation])
		Utilities.WINDOW_MAXIMISE.on(this, [this.windows.toMaximisedAnimation, this.appdock.hideAnimation.bind(this.appdock)])
		Utilities.WINDOW_MAXIMISE_END.on(this, [this.windows.fromMaximisedAnimation, this.appdock.showAnimation.bind(this.appdock)])
		Utilities.WINDOW_MINIMISE.on(this, [this.windows.toMinimisedAnimation])
		Utilities.WINDOW_MINIMISE_END.on(this, [this.windows.fromMinimisedAnimation])
	}
}