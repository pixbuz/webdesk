// TODO: Make centerWindow toggle-able from settings

import { WebdeskEvent, MessagingHub } from "./core"

const Factory = new class {
	space = document.querySelector(".Window.Space")
	centerOffsets = [ ]
	open = new Map()

	/** @param {import("./core").LauncherData} data */
	async skeletonizeWindow({ app, manifest }) {
		const windowIdentifier = Symbol(app)
		const windowWrapper = document.createElement("article"),
			contentWrapper = document.createElement("section"),
			titlebarWrapper = document.createElement("header"),
			content = document.createElement("iframe"),
			titlebar = document.createElement("iframe")

		MessagingHub.generatePorts(windowIdentifier)
		// windowWrapper.classList.add("loading")

		Promise.all([
			new Promise((resolve) => { titlebar.addEventListener("load", () => Factory.titlebarLoaded(windowIdentifier, titlebar, resolve), { once: true }) }),
			new Promise((resolve) => { content.addEventListener("load", () => Factory.contentLoaded(windowIdentifier, content, resolve), { once: true }) })
		]).then(() => {
			windowWrapper.classList.remove("loading")
			WebdeskEvent.WINDOW_OPEN.emit({ target: windowWrapper })
		})

		titlebar.classList.add("titlebar")
		titlebar.setAttribute("allowfullscreen", false)
		titlebar.setAttribute("sandbox", `allow-scripts`)
		titlebar.setAttribute("title", `Application ${app}'s titlebar`)
		titlebar.src = `${window.location.protocol}//${ manifest.path ? `${app}.${window.location.hostname}` : window.location.hostname }/titlebar`

		titlebarWrapper.append(titlebar)
		titlebarWrapper.classList.add("titlebarWrapper")

		content.classList.add("content")
		content.setAttribute("allowfullscreen", false)
		content.setAttribute("sandbox", `allow-scripts`)
		content.setAttribute("title", `Application ${app}'s content`)
		content.src = `${window.location.protocol}//${app}.${window.location.hostname}/`

		contentWrapper.append(content)
		contentWrapper.classList.add("contentWrapper")

		windowWrapper.setAttribute("window", app)
		windowWrapper.append(titlebarWrapper, contentWrapper)

		windowWrapper.addEventListener("pointerdown", (event) => {
			windowWrapper.setPointerCapture(event.pointerId)

			WebdeskEvent.WINDOW_RESIZE_START.emit({ target: windowWrapper, x: event.x, y: event.y })
		})
		// ???

		windowWrapper.addEventListener("pointermove", (event) => {
			if (Resizer.inResize) WebdeskEvent.WINDOW_RESIZE.emit({ target: windowWrapper, x: event.x, y: event.y })
		})
		// ???

		windowWrapper.addEventListener("pointerup", (event) => {
			windowWrapper.releasePointerCapture(event.pointerId)

			if (Resizer.inResize) WebdeskEvent.WINDOW_RESIZE_END.emit({ target: windowWrapper, x: event.x, y: event.y })
		})
		// ???

		window.addEventListener("resize", () => { Mover.updatePositionIfCollision({ target: windowWrapper }) }) // ???

		Factory.space.append(windowWrapper)
		Factory.open.set(windowIdentifier, windowWrapper)
	}
	titlebarLoaded(id, iframe, promiseResolve) {
		MessagingHub.sendTitlebarPorts(id, iframe, { command: "init", payload: { app: id.description, palette: null /* TODO */, }})
			.addEventListener("message", (messageEvent) => Titlebar.messageInterpreter(messageEvent, iframe.closest("[window]")) )
		promiseResolve()
	}
	contentLoaded(id, iframe, promiseResolve) {
		MessagingHub.sendContentPorts(id, iframe)
		promiseResolve()
	}
	/** @param {import("./core").TargetData} data */ maximise({ target }) { target.classList.add("maximised") }
	/** @param {import("./core").TargetData} data */ minimise({ target }) { target.classList.add("minimised") }
	/** @param {import("./core").TargetData} data */ unMaximise({ target }) { target.classList.remove("maximised") }
	/** @param {import("./core").TargetData} data */ unMinimise({ target }) { target.classList.remove("minimised") }
	/** @param {import("./core").TargetData} data */
	checkAction({ target }) {
		if (target.classList.contains("minimised")) { Factory.unMinimise({ target }) }
		else { Factory.minimise({ target }) }
	}
}

const Animationer = new class {
	#animationTimeout = 10000

	/** @param {import("./core").TargetData} data */ open({ target }) { Animationer.runAnimation(target, "open") }
	/** @param {import("./core").TargetData} data */ unMaximise({ target }) { Animationer.runAnimation(target, "unmaximise") }
	/** @param {import("./core").TargetData} data */ unMinimise({ target }) { Animationer.runAnimation(target, "unminimise") }
	/** @param {import("./core").TargetData} data */ close({ target }) { Animationer.runAnimation(target, "close", () => { target.remove() }) }
	runAnimation(target, name, callback = () => { target.classList.remove(name) }) {
		const failsafe = setTimeout(callback, Animationer.#animationTimeout)
		target.addEventListener("animationend", () => { callback(); clearTimeout(failsafe) }, { once: true })
		target.classList.add(name)
	}
}

const Titlebar = new class {
	titlebarVars

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
				if (Mover.inMove) { return WebdeskEvent.WINDOW_MOVE_END.emit({ ...message.data, target: appWindow }) }
				else { return }
			}
			case "move": {
				if (Mover.inMove) { return WebdeskEvent.WINDOW_MOVE.emit({ ...message.data, target: appWindow }) }
				else { return }
			}
			case "move-start": { return WebdeskEvent.WINDOW_MOVE_START.emit({ ...message.data, target: appWindow }) }

			case "close": { return WebdeskEvent.WINDOW_CLOSING.emit({ closed: appWindow }) }
			case "minimise": { return WebdeskEvent.WINDOW_MINIMISE.emit({ target: appWindow }) }
			case "maximise": { return Titlebar.relayMaximise({ target: appWindow }) }
		}
	}
	/** @param {import("./core").CustomizationData} customizationData */
	setUpVars({ id, css, object, force }) {
		Titlebar.titlebarVars = css
			.split("; ")
			.filter((cssVar) => { return cssVar.startsWith("--windows-") && cssVar.includes("titlebar") })
			.join("; ")
	}
}

const Focuser = new class {
	focusHistory = [ ]

	// Mixture
	focusWindow({ target }) {
		if (target === Focuser.focusHistory[0]) { return }
		const oldFocus = Focuser.focusHistory[0]

		if (oldFocus) { oldFocus.classList.remove("focus") }

		Focuser.focusHistory = Focuser.focusHistory.filter((appWindow) => { return appWindow !== target })
		Focuser.focusHistory.unshift(target)
		target.classList.add("focus")

		WebdeskEvent.WINDOW_UPDATED_FOCUS.emit({ lost: oldFocus, gain: target })
	}
	/** @param {import("./core").FocusData} data */
	adjustZIndexes({ lost, gain }) {
		for (const appWindowIndex in Focuser.focusHistory) {
			const appWindow = Focuser.focusHistory[appWindowIndex]
			appWindow.style.zIndex = Math.max(20, 29 - appWindowIndex)
		}
	}
	/** @param {import("./core").CloseData} data */
	clearHistory({ closed }) {
		closed.classList.remove("focus")
		Focuser.focusHistory = Focuser.focusHistory.filter((appWindow) => { return !(appWindow.classList.contains("closing")) })
		if (Focuser.focusHistory[0]) { Focuser.focusHistory[0].classList.add("focus") }
		WebdeskEvent.WINDOW_UPDATED_FOCUS.emit({ lost: undefined, gain: Focuser.focusHistory[0] })
	}
}

const Mover = new class {
	anchor = { x: null, y: null }
	inMove = false

	/** @param {import("./core").InteractionData} data */
	init({ target, x, y }) {
		target.classList.add("moving")
		target.style.translate = ""
		const box = target.getBoundingClientRect()

		Mover.anchor = { x: (x - box.left), y: (y - box.top) }
		Mover.inMove = true
	}
	/** @param {import("./core").InteractionData} data */
	followCursor({ target, x, y }) {
		target.style.left = (x - Mover.anchor.x) + "px"
		target.style.top = (y - Mover.anchor.y) + "px"
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
		Mover.inMove = false
		target.classList.remove("moving")
	}
}

const Resizer = new class {
	edges = { top: null, right: null, bottom: null, left: null }
	anchor = { x: null, y: null }
	startContentBox = null
	startWindowBox = null
	resizeMargin = 6
	inResize = false

	/** @param {import("./core").InteractionData} interactionData */
	init({ target, x, y }) {
		Resizer.startContentBox = target.querySelector(".contentWrapper").getBoundingClientRect()
		target.style.translate = ""
		Resizer.inResize = true
		Resizer.anchor.x = x
		Resizer.anchor.y = y

		const box = Resizer.startWindowBox = target.getBoundingClientRect()

		const edges = Resizer.edges = {
			top: y - box.top <= Resizer.resizeMargin,
			right: box.right - x <= Resizer.resizeMargin,
			bottom: box.bottom - y <= Resizer.resizeMargin,
			left: x - box.left <= Resizer.resizeMargin,
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
		const { edges, anchor, startWindowBox, startContentBox } = Resizer

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
		Resizer.inResize = false
		target.classList.remove("X", "Y", "XY1", "XY2", "resizing")
	}
	/** @param {import("./core").CustomizationData} data */
	updateVars({ object, id, css }) {
		const border = parseInt(object.windows.appearance.border),
		padding = parseInt(object.windows.appearance.padding)
		Resizer.resizeMargin = border + padding
	}
}

WebdeskEvent.ICON_CLICK.on(Factory.checkAction) // ???
WebdeskEvent.LAUNCHER_CLICK.on(Factory.skeletonizeWindow)

WebdeskEvent.WINDOW_MINIMISE.on(Factory.minimise)
WebdeskEvent.WINDOW_MINIMISE_END.on(Factory.unMinimise)

WebdeskEvent.WINDOW_MAXIMISE.on(Factory.maximise)
WebdeskEvent.WINDOW_MAXIMISE_END.on(Factory.unMaximise)


WebdeskEvent.WINDOW_OPEN.on(Animationer.open)
WebdeskEvent.WINDOW_MAXIMISE_END.on(Animationer.unMaximise)
WebdeskEvent.WINDOW_MINIMISE_END.on(Animationer.unMinimise)
WebdeskEvent.WINDOW_CLOSE.on(Animationer.close)


WebdeskEvent.CUSTOMIZATION_LOADED.on(Titlebar.setUpVars)
WebdeskEvent.WINDOW_UPDATED_FOCUS.on(Titlebar.relayFocusChange)
// WebdeskEvent.CUSTOMIZATION_CHANGE_SAVED.on(TitlebarFactory.setUpVars)


WebdeskEvent.WINDOW_UPDATED_FOCUS.on(Focuser.adjustZIndexes)
WebdeskEvent.WINDOW_CLOSING.on(Focuser.clearHistory)

WebdeskEvent.WINDOW_RESIZE_START.on(Focuser.focusWindow)
WebdeskEvent.WINDOW_MOVE_START.on(Focuser.focusWindow)
WebdeskEvent.WINDOW_OPEN.on(Focuser.focusWindow)
WebdeskEvent.ICON_CLICK.on(Focuser.focusWindow)


WebdeskEvent.WINDOW_MOVE_START.on(Mover.init)
WebdeskEvent.WINDOW_MOVE.on(Mover.followCursor)
WebdeskEvent.WINDOW_MOVE_END.on(Mover.reset)

WebdeskEvent.WINDOW_RESIZE_END.on(Mover.updatePositionIfCollision)
WebdeskEvent.WINDOW_MOVE_END.on(Mover.updatePositionIfCollision)


WebdeskEvent.WINDOW_RESIZE_START.on(Resizer.init)
WebdeskEvent.WINDOW_RESIZE.on(Resizer.followCursor)
WebdeskEvent.WINDOW_RESIZE_END.on(Resizer.reset)
