// TODO: Make centerWindow toggle-able from settings

import { WebdeskEvent, ApplicationManifests, MessagingHub, StyleSheets } from "./core"

const WMTitlebarFactory = new class {
	titlebarVars

	/** @param {import("./core").OpeningData} data */
	async setup({ window: appWindow, titlebar, app }) {
		const comChannel = MessagingHub.windowToChannels.get(appWindow).titlebar
		const path = ApplicationManifests[app].titlebar
		const manifest = ApplicationManifests[app]

		titlebar.setAttribute("allowfullscreen", false)
		titlebar.setAttribute("sandbox", "allow-scripts")
		titlebar.setAttribute("title", `"${app}"'s application titlebar`)

		if (path === "") { titlebar.src = "/titlebar" }
		else { titlebar.src = `${window.location.protocol}//${app}.${window.location.hostname}/titlebar` }

		const initMessage = { command: "init", data: {
			style: WMTitlebarFactory.titlebarVars,
			service: manifest.service,
			app: app,
		}}

		comChannel.port1.addEventListener("message", (messageEvent) => { WMTitlebarFactory.messageInterpreter(messageEvent, appWindow) })

		titlebar.addEventListener("load", () => { WebdeskEvent.TITLEBAR_READY.emit({ data: titlebar, message: initMessage }) }, { once: true })

		WebdeskEvent.CUSTOMIZATION_CHANGE.on((titlebarData) => { comChannel.port1.postMessage({ command: "css", data: titlebarData }) })
		WebdeskEvent.WINDOW_UPDATED_FOCUS.on(WMTitlebarFactory.relayFocusChange)
	}
	/** @param {import("./core").FocusData} data */
	relayFocusChange({ lost, gain }) {
		if (gain && MessagingHub.windowToChannels.get(gain)) {
			const messageChannel = MessagingHub.windowToChannels.get(gain).titlebar
			messageChannel.port1.postMessage({ command: "focus", data: true })
		}
		if (lost && MessagingHub.windowToChannels.get(lost)) {
			const messageChannel = MessagingHub.windowToChannels.get(lost).titlebar
			messageChannel.port1.postMessage({ command: "focus", data: false })
		}
	}
	/** @param {import("./core").TargetData} data */
	relayMaximise({ target }) {
		if (target.classList.contains("maximised")) { WebdeskEvent.WINDOW_MAXIMISE_END.emit({ target }) }
		else { WebdeskEvent.WINDOW_MAXIMISE.emit({ target }) }
	}
	/** @param {MessageEvent} messageEvent
	@param {HTMLElement} appWindow */
	messageInterpreter({ data: message }, appWindow) {
		const app = appWindow.getAttribute("app")

		switch(message.command) {
			case "move-end": {
				if (WMMover.inMove) { return WebdeskEvent.WINDOW_MOVE_END.emit({ ...message.data, target: appWindow }) }
				else { return }
			}
			case "move": {
				if (WMMover.inMove) { return WebdeskEvent.WINDOW_MOVE.emit({ ...message.data, target: appWindow }) }
				else { return }
			}
			case "move-start": { return WebdeskEvent.WINDOW_MOVE_START.emit({ ...message.data, target: appWindow }) }

			case "close": { return WebdeskEvent.WINDOW_CLOSING.emit({ closed: appWindow, app }) }
			case "minimise": { return WebdeskEvent.WINDOW_MINIMISE.emit({ target: appWindow, app }) }
			case "maximise": { return WMTitlebarFactory.relayMaximise({ target: appWindow, app }) }
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
		WebdeskEvent.WINDOW_OPENING.on(this.setup)
		WebdeskEvent.CUSTOMIZATION_LOADED.on(this.setUpVars)
		WebdeskEvent.CUSTOMIZATION_CHANGE_SAVED.on(this.setUpVars)
	}
}

const WMFactory = new class {
	#animationTimeout = 10000
	space = document.querySelector(".Window.Space")
	centerOffsets = [ ]
	open = [ ]

	/** @param {import("./core").LauncherData} data */
	async skeletonizeWindow({ app }) {
		const manifest = ApplicationManifests[app]

		const windowWrapper = document.createElement("article"),
			contentWrapper = document.createElement("section"),
			titlebarWrapper = document.createElement("header"),
			content = document.createElement("iframe"),
			titlebar = document.createElement("iframe")

		windowWrapper.classList.add("loading")
		WMFactory.space.append(windowWrapper)

		const titlebarLoaded = new Promise((resolve) => { titlebar.addEventListener("load", resolve, { once: true }) })
		const contentLoaded = new Promise((resolve) => { content.addEventListener("load", resolve, { once: true }) })
		Promise.all([titlebarLoaded, contentLoaded]).then(() => { WebdeskEvent.WINDOW_OPEN.emit({ target: windowWrapper, app: app }) })
		
		WebdeskEvent.WINDOW_OPENING.emit({ window: windowWrapper, titlebar: titlebar, app })

		titlebar.classList.add("titlebar")
		titlebarWrapper.append(titlebar)
		titlebarWrapper.classList.add("titlebarWrapper")

		content.classList.add("content")
		content.setAttribute("allowfullscreen", false)
		content.setAttribute("sandbox", `allow-scripts`)
		content.setAttribute("title", `"${app}"'s application content`)
		content.src = `${window.location.protocol}//${app}.${window.location.hostname}/`
		content.addEventListener("load", () => { WebdeskEvent.CONTENT_READY.emit({ data: content }) }, { once: true })

		contentWrapper.append(content)
		contentWrapper.classList.add("contentWrapper")

		windowWrapper.setAttribute("app", app)
		windowWrapper.append(titlebarWrapper, contentWrapper)

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
	}
	/** @param {import("./core").OpeningData} data */
	centerWindow({ window: target, titlebar }) {
		target.style.left = WMFactory.centerOffsets[0]
		target.style.top = WMFactory.centerOffsets[1]
	}
	/** @param {import("./core").CustomizationData} data */
	setVars({ id, css, object, force }) {
		WMFactory.centerOffsets[0] = `calc(50% - ${object.windows.appearance.width}/2)`
		WMFactory.centerOffsets[1] = `calc(50% - ${object.windows.appearance.height}/2)`
	}
	/** @param {import("./core").OpeningData} data */
	addWindowToSpace({ target, app }) {
		target.classList.remove("loading")
		target.classList.add("opening")

		WMFactory.animationer(target, "opening", () => { target.classList.remove("opening") })
		WMFactory.open.push(target)
	}
	/** @param {import("./core").CloseData} data */
	removeWindowFromSpace({ closed, open }) {
		const app = closed.getAttribute("app")
		WMFactory.animationer(closed, "closing", () => { closed.remove(); WebdeskEvent.WINDOW_CLOSE.emit({ target: closed, app }) })
	}
	/** @param {import("./core").TargetData} data */
	maximiseAddWindow({ target }) { target.classList.add("maximised") }
	/** @param {import("./core").TargetData} data */
	minimiseAddWindow({ target }) { target.classList.remove("maximised"); target.classList.add("minimised") }
	/** @param {import("./core").TargetData} data */
	maximiseRemoveWindow({ target }) {
		target.classList.remove("maximised")
		WMFactory.animationer(target, "from-maximised", () => { target.classList.remove("from-maximised") })
	}
	/** @param {import("./core").TargetData} data */
	minimiseRemoveWindow({ target }) {
		target.classList.remove("minimised")
		WMFactory.animationer(target, "from-minimised", () => { target.classList.remove("from-minimised") })
	}
	/** @param {import("./core").TargetData} data */
	checkAction({ target }) {
		if (target.classList.contains("minimised")) { WMFactory.minimiseRemoveWindow({ target }) }
		else { WMFactory.minimiseAddWindow({ target }) }
	}
	animationer(target, animationTag, callback) {
		target.classList.add(animationTag)
		const failsafe = setTimeout(callback, WMFactory.#animationTimeout)
		target.addEventListener("animationend", () => { callback(); clearTimeout(failsafe) }, { once: true })
	}

	constructor() {
		WebdeskEvent.WINDOW_OPENING.on(this.centerWindow)
		WebdeskEvent.WINDOW_OPEN.on(this.addWindowToSpace)
		
		WebdeskEvent.WINDOW_CLOSING.on(this.removeWindowFromSpace)
		
		WebdeskEvent.WINDOW_MINIMISE.on(this.minimiseAddWindow)
		WebdeskEvent.ICON_CLICK.on(this.checkAction)

		WebdeskEvent.WINDOW_MAXIMISE.on(this.maximiseAddWindow)
		WebdeskEvent.WINDOW_MAXIMISE_END.on(this.maximiseRemoveWindow)

		WebdeskEvent.CUSTOMIZATION_LOADED.on(this.setVars)
		WebdeskEvent.LAUNCHER_CLICK.on(this.skeletonizeWindow)
	}
}

const WMFocuser = new class {
	focusHistory = [ ]

	// Mixture
	focusWindow({ target }) {
		if (target === WMFocuser.focusHistory[0]) { return }
		const oldFocus = WMFocuser.focusHistory[0]

		if (oldFocus) { oldFocus.classList.remove("focus") }

		WMFocuser.focusHistory = WMFocuser.focusHistory.filter((appWindow) => { return appWindow !== target })
		WMFocuser.focusHistory.unshift(target)
		target.classList.add("focus")

		WebdeskEvent.WINDOW_UPDATED_FOCUS.emit({ lost: oldFocus, gain: target })
	}
	/** @param {import("./core").FocusData} data */
	adjustZIndexes({ lost, gain }) {
		for (const appWindowIndex in WMFocuser.focusHistory) {
			const appWindow = WMFocuser.focusHistory[appWindowIndex]
			appWindow.style.zIndex = Math.max(20, 29 - appWindowIndex)
		}
	}
	/** @param {import("./core").CloseData} data */
	clearHistory({ closed }) {
		closed.classList.remove("focus")
		WMFocuser.focusHistory = WMFocuser.focusHistory.filter((appWindow) => { return !(appWindow.classList.contains("closing")) })
		if (WMFocuser.focusHistory[0]) { WMFocuser.focusHistory[0].classList.add("focus") }
		WebdeskEvent.WINDOW_UPDATED_FOCUS.emit({ lost: undefined, gain: WMFocuser.focusHistory[0] })
	}

	constructor() {
		WebdeskEvent.WINDOW_UPDATED_FOCUS.on(this.adjustZIndexes)
		WebdeskEvent.WINDOW_CLOSING.on(this.clearHistory)

		WebdeskEvent.WINDOW_RESIZE_START.on(this.focusWindow)
		WebdeskEvent.WINDOW_MOVE_START.on(this.focusWindow)
		WebdeskEvent.WINDOW_OPEN.on(this.focusWindow)
		WebdeskEvent.ICON_CLICK.on(this.focusWindow)
	}
}

const WMMover = new class {
	anchor = { x: null, y: null }
	inMove = false

	/** @param {import("./core").InteractionData} data */
	init({ target, x, y }) {
		target.classList.add("moving")
		const box = target.getBoundingClientRect()

		WMMover.anchor = { x: (x - box.left), y: (y - box.top) }
		WMMover.inMove = true
	}
	/** @param {import("./core").InteractionData} data */
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
	/** @param {import("./core").CustomizationData} data */
	updateVars({ object, id, css }) {
		const border = parseInt(object.windows.appearance.border),
		padding = parseInt(object.windows.appearance.padding)
		WMResizer.resizeMargin = border + padding
	}

	constructor() {
		WebdeskEvent.WINDOW_RESIZE_START.on(this.init)
		WebdeskEvent.WINDOW_RESIZE.on(this.followCursor)
		WebdeskEvent.WINDOW_RESIZE_END.on(this.reset)
		WebdeskEvent.CUSTOMIZATION_CHANGE_SAVED.on(this.updateVars)
	}
}