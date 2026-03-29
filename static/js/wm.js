// TODO: Improve focusWindow logic
// TODO: Pass variables to content iframes
// TODO: Make centerWindow toggle-able from settings

// IDEA: Make a UPDATE Z INDEX event for cleaner (event driven) logic
// IDEA: Windows get added to the window space after the iframes loaded
// IDEA: Conjure a system for passive highest z-index resolve for windows focus shift
// IDEA: Quick window switching with focusWindow on WebdeskEvent.WINDOW_MOVE instead of WebdeskEvent.WINDOW_MOVE_START

import { WebdeskEvent, ApplicationManifests } from "./core"

const WMTitlebarFactory = new class {
	comPorts = new WeakMap()
	titlebarVars

	/** @param {import("./core").TitlebarData} titlebarData */
	async setup({ titlebar, app }) {
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

		WebdeskEvent.CUSTOMIZATION_CHANGE.on((titlebarData) => { channel.port1.postMessage({ command: "css", data: titlebarData }) })
		WebdeskEvent.WINDOW_UPDATED_FOCUS.on(WMTitlebarFactory.relayFocusChange)
	}
	/** @param {import("./core").FocusData} focusData */
	relayFocusChange({ lost, gain }) {
		if (gain) {
			const newFocusedTitlebar = gain.querySelector(".titlebar")
			const newTitlebarPort = WMTitlebarFactory.comPorts.get(newFocusedTitlebar)
			newTitlebarPort.postMessage({ command: "focus", data: true })
		}

		if (lost) {
			const oldFocusedTitlebar = lost.querySelector(".titlebar")
			const oldTitlebarPort = WMTitlebarFactory.comPorts.get(oldFocusedTitlebar)
			oldTitlebarPort.postMessage({ command: "focus", data: false })
		}
	}
	/** @param {import("./core").TargetData} targetData */
	close({ target, app }) {
		if (app == "settings") { SettingsManager.closeWindow() }
		else { target.remove() }

		WebdeskEvent.WINDOW_CLOSE.emit({ closed: target, open: WMFactory.open })
	}
	/** @param {import("./core").TargetData} targetData */
	maximise({ target, app }) {
		if (target.classList.contains("maximised")) {
			target.classList.remove("maximised")
			WebdeskEvent.WINDOW_MAXIMISE_END.emit({ target, app })
		} else {
			target.classList.add("maximised")
			WebdeskEvent.WINDOW_MAXIMISE.emit({ target, app })
		}
	}
	/** @param {import("./core").TargetData} targetData */
	minimise({ target, app }) {
		if (target.classList.contains("minimised")) {
			target.classList.remove("minimised")
			WebdeskEvent.WINDOW_MINIMISE_END.emit({ target, app })
		} else {
			target.classList.add("minimised")
			WebdeskEvent.WINDOW_MINIMISE.emit({ target, app })
		}
	}
	messageInterpreter(titlebar, port, messageEvent) {
		const window = titlebar.closest("[app]")
		const app = window.getAttribute("app")
		const message = messageEvent.data

		switch(message.command) {
			case "move-end": {
				if (WMMover.inMove) { return WebdeskEvent.WINDOW_MOVE_END.emit({ ...message.result, target: window }) }
				else { return }
			}
			case "move": {
				if (WMMover.inMove) { return WebdeskEvent.WINDOW_MOVE.emit({ ...message.result, target: window }) }
				else { return }
			}
			case "move-start": { return WebdeskEvent.WINDOW_MOVE_START.emit({ ...message.result, target: window }) }

			case "close": { return WMTitlebarFactory.close({ target: window, app: app }) }
			case "minimise": { return WMTitlebarFactory.minimise({ target: window }) }
			case "maximise": { return WMTitlebarFactory.maximise({ target: window }) }
		}
	}
	/** @param {import("./core").CustomizationData} customizationData */
	setUpVars({ id, css, object, force }) {
		WMTitlebarFactory.titlebarVars = css
			.split("; ")
			.filter((cssVar) => { return cssVar.startsWith("--windows-") && cssVar.includes("titlebar") })
			.join("; ")
	}

	constructor() {
		WebdeskEvent.TITLEBAR_SETUP.on(this.setup)
		WebdeskEvent.CUSTOMIZATION_LOADED.on(this.setUpVars)
		WebdeskEvent.CUSTOMIZATION_CHANGE_SAVED.on(this.setUpVars)
	}
}

const WMFactory = new class {
	space = document.querySelector(".Window.Space")
	open = [ ]

	/** @param {import("./core").LauncherData} launcherData */
	async skeletonizeWindow({ app }) {
		const manifest = ApplicationManifests[app]

		const windowWrapper = document.createElement("article"),
			contentWrapper = document.createElement("section"),
			titlebarWrapper = document.createElement("header"),
			content = document.createElement("iframe"),
			titlebar = document.createElement("iframe")

		WebdeskEvent.TITLEBAR_SETUP.emit({ titlebar: titlebar, app: app })

		titlebar.classList.add("titlebar")
		titlebarWrapper.append(titlebar)
		titlebarWrapper.classList.add("titlebarWrapper")

		content.classList.add("content")
		content.setAttribute("allowfullscreen", false)
		content.setAttribute("sandbox", `allow-scripts`)
		content.setAttribute("title", `"${app}"'s application content`)
		content.src = `/apps/${app}/${manifest.index}`

		contentWrapper.append(content)
		contentWrapper.classList.add("contentWrapper")

		windowWrapper.setAttribute("app", app)
		windowWrapper.append(titlebarWrapper, contentWrapper)

		WMFactory.space.appendChild(windowWrapper)
		WMFactory.open.push(windowWrapper)

		WebdeskEvent.WINDOW_UPDATED_FOCUS.on(() => { WMFocuser.updateZIndex({ app }, windowWrapper) })

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

			if (WMResizer.inResize) {
				WebdeskEvent.WINDOW_RESIZE_END.emit({ target: windowWrapper, x: event.x, y: event.y })
			}
		})

		window.addEventListener("resize", () => { WMMover.updatePositionIfCollision({ target: windowWrapper }) })

		WebdeskEvent.WINDOW_OPEN.emit({ target: windowWrapper, app: app })
	}

	constructor() {
		WebdeskEvent.LAUNCHER_CLICK.on(this.skeletonizeWindow)
	}
}

const WMFocuser = new class {
	focusedWindow = null

	/** @param {import("./core").TargetData} targetData */
	focusWindow({ target, app }) {
		if (target != WMFocuser.focusedWindow || !WMFocuser.focusedWindow) {
			if (WMFocuser.focusedWindow) { WMFocuser.focusedWindow.classList.remove("focus") }

			WebdeskEvent.WINDOW_UPDATED_FOCUS.emit({ old: WMFocuser.focusedWindow, new: target })

			WMFocuser.focusedWindow = target
			WMFocuser.focusedWindow.classList.add("focus")
		}
	}
	/** @param {import("./core").FocusData} focusData */
	updateZIndex({ lost, gain }, targetWindow) {
		const zIndex = parseInt(targetWindow.style.zIndex)

		if (gain === targetWindow) { targetWindow.style.zIndex = 29 }
		else if (zIndex > 20) { targetWindow.style.zIndex = zIndex - 1 }
	}
	/** @param {import("./core").CloseData} closeData */
	shiftFocus({ closed, open }) {
		const targetWindow = open.sort((a, b) => {
			if (a.style.zIndex > b.style.zIndex) { return a }
		}).at(0)

		if (targetWindow) {
			targetWindow.classList.add("focus")
			WebdeskEvent.WINDOW_UPDATED_FOCUS.emit({ lost: WMFocuser.focusedWindow, gain: targetWindow })
		}

		WMFocuser.focusedWindow = targetWindow
	}

	constructor() {
		WebdeskEvent.WINDOW_CLOSE.on(this.shiftFocus)

		WebdeskEvent.WINDOW_RESIZE_START.on(this.focusWindow)
		WebdeskEvent.WINDOW_MOVE_START.on(this.focusWindow)
		WebdeskEvent.WINDOW_OPEN.on(this.focusWindow)
	}
}

const WMMover = new class {
	anchor = { x: null, y: null }
	inMove = false

	/** @param {import("./core").InteractionData} interactionData */
	init({ target, x, y }) {
		target.classList.add("moving")
		const box = target.getBoundingClientRect()

		WMMover.anchor = { x: (x - box.left), y: (y - box.top) }
		WMMover.inMove = true
	}
	/** @param {import("./core").TargetData} targetData */
	centerWindow({ target, app }) {
		const box = target.getBoundingClientRect()

		target.style.left = Math.round((window.innerWidth - box.width) / 2) + "px"
		target.style.top = Math.round((window.innerHeight - box.height) / 2) + "px"
	}
	/** @param {import("./core").InteractionData} interactionData */
	followCursor({ target, x, y }) {
		target.style.left = (x - WMMover.anchor.x) + "px"
		target.style.top = (y - WMMover.anchor.y) + "px"
	}
	/** @param {import("./core").InteractionData} interactionData */
	updatePositionIfCollision({ target, x, y }) {
		const box = target.getBoundingClientRect()

		box.x = Math.min( Math.max(0, box.left), window.innerWidth - box.width )
		box.y = Math.min( Math.max(0, box.top), window.innerHeight - box.height )

		target.style.left = Math.round(box.x) + "px"
		target.style.top = Math.round(box.y) + "px"
	}
	/** @param {import("./core").InteractionData} interactionData */
	reset({ target, x, y }) {
		WMMover.inMove = false
		target.classList.remove("moving")
	}

	constructor() {
		WebdeskEvent.WINDOW_OPEN.on(this.centerWindow)

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
	startContentBox = null
	startWindowBox = null
	resizeMargin = 6
	inResize = false

	/** @param {import("./core").InteractionData} interactionData */
	init({ target, x, y }) {
		WMResizer.startContentBox = target.querySelector(".contentWrapper").getBoundingClientRect()
		WMResizer.inResize = true
		WMResizer.anchor.x = x
		WMResizer.anchor.y = y

		const box = WMResizer.startWindowBox = target.getBoundingClientRect()

		const edges = WMResizer.edges = {
			top: y - box.top <= WMResizer.resizeMargin,
			right: box.right - x <= WMResizer.resizeMargin,
			bottom: box.bottom - y <= WMResizer.resizeMargin,
			left: x - box.left <= WMResizer.resizeMargin,
		}

		if (target.classList.contains("maximised")) { target.classList.remove("maximised") }

		if (edges.top && edges.left || edges.bottom && edges.right) { target.classList.add("XY1", "resizing") }
		else if (edges.top && edges.right || edges.bottom && edges.left) { target.classList.add("XY2", "resizing") }
		else if (edges.left || edges.right) { target.classList.add("X", "resizing") }
		else if (edges.top || edges.bottom) { target.classList.add("Y", "resizing") }
	}
	/** @param {import("./core").InteractionData} interactionData */
	followCursor({ target, x, y }) {
		const content = target.querySelector(".contentWrapper")
		const { edges, anchor, startWindowBox, startContentBox } = WMResizer

		let { left, top } = startWindowBox
		let { width, height } = startContentBox

		const deltaX = x - anchor.x
		const deltaY = y - anchor.y

		if (edges.left) {
			width -= deltaX
			left += deltaX
		} else if (edges.right) { width += deltaX }

		if (edges.top) {
			height -= deltaY
			top += deltaY
		} else if (edges.bottom) { height += deltaY }

		target.style.left = `${Math.round(left)}px`
		target.style.top = `${Math.round(top)}px`
		content.style.height = `${Math.round(height)}px`
		content.style.width = `${Math.round(width)}px`
	}
	/** @param {import("./core").InteractionData} interactionData */
	reset({ target, x, y }) {
		WMResizer.inResize = false
		target.classList.remove("X", "Y", "XY1", "XY2", "resizing")
	}

	constructor() {
		WebdeskEvent.WINDOW_RESIZE_START.on(this.init)
		WebdeskEvent.WINDOW_RESIZE.on(this.followCursor)
		WebdeskEvent.WINDOW_RESIZE_END.on(this.reset)
	}
}

const SettingsManager = new class {
	launcher = document.querySelector(`[launcher="settings"]`)
	window = document.querySelector(`[app="settings"]`)
	icon = document.querySelector(`[icon="settings"]`)

	openWindow() {
		SettingsManager.window.style.display = "block"

		WebdeskEvent.WINDOW_OPEN.emit({ target: SettingsManager.window, app: "settings" })
		WebdeskEvent.WINDOW_UPDATED_FOCUS.on((focusData) => { WMFocuser.updateZIndex(focusData, SettingsManager.window) })

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

			if (WMResizer.inResize) {
				WebdeskEvent.WINDOW_RESIZE_END.emit({ target: SettingsManager.window, x: event.x, y: event.y })
			}
		})

		SettingsManager.icon.style.display = "block"
	}
	closeWindow() {
		SettingsManager.window.style.display = "none"
		SettingsManager.icon.style.display = "none"
		SettingsManager.window.querySelector(".contentWrapper").style.cssText = ""

		SettingsManager.window.classList.remove("maximised")
		SettingsManager.window.classList.remove("minimised")
	}
	setupWindow() {
		SettingsManager.window.style.display = "none"

		WebdeskEvent.TITLEBAR_SETUP.emit({ titlebar: SettingsManager.window.querySelector(`.titlebar`), app: "settings" })
	}

	constructor() {
		this.launcher.addEventListener("click", this.openWindow)
		this.icon.style.display = "none"

		WebdeskEvent.MANIFESTS_READY.on(this.setupWindow, this.openWindow /* DEBUG BEBUUUUUGGG */)
		this.icon.addEventListener("click", (event) => { this.window.classList.remove("minimised") })
	}
}