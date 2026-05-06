// TODO: Make centerWindow toggle-able from settings
// TODO: Widonws not getting dragged first try

import { WebdeskEvent, MessagingHub, activeCustomObject, openWindows, WebdeskRequest } from "./core"

const Factory = new class {
	space = document.querySelector(".Window.Space")
	centerOffsets = [ ]

	/** @param {import("./core").LauncherData} data */
	async skeletonizeWindow({ app, manifest }) {
		
		const windowWrapper = document.createElement("article"),
			contentWrapper = document.createElement("section"),
			titlebarWrapper = document.createElement("header"),
			content = document.createElement("iframe"),
			titlebar = document.createElement("iframe")
		const windowIdentifier = Symbol(app)

		windowWrapper.classList.add("loading")

		Promise.all([
			new Promise(resolve => titlebar.addEventListener("load", () => Factory.loaded(windowIdentifier, titlebar, resolve), { once: true })),
			new Promise(resolve => content.addEventListener("load", () => Factory.loaded(windowIdentifier, content, resolve), { once: true })),
		]).then(() => {
			windowWrapper.classList.remove("loading")
			WebdeskEvent.WINDOW_OPEN.emit({ app, target: windowWrapper })
		})

		titlebar.classList.add("titlebar")
		titlebar.setAttribute("allowfullscreen", false)
		titlebar.setAttribute("sandbox", `allow-scripts allow-same-origin`)
		titlebar.setAttribute("title", `Application ${app}'s titlebar`)
		titlebar.src = `${window.location.protocol}//${ manifest.titlebar ? `${app}.` : "" }${window.location.hostname}/titlebar`
		if (!manifest.titlebar) console.log("nerd vvv")

		titlebarWrapper.append(titlebar)
		titlebarWrapper.classList.add("titlebarWrapper")

		content.classList.add("content")
		content.setAttribute("allowfullscreen", false)
		content.setAttribute("sandbox", `allow-scripts allow-same-origin`)
		content.setAttribute("title", `Application ${app}'s content`)
		content.src = `${window.location.protocol}//${app}.${window.location.hostname}/`

		contentWrapper.append(content)
		contentWrapper.classList.add("contentWrapper")

		windowWrapper.setAttribute("window", app)
		windowWrapper.append(titlebarWrapper, contentWrapper)

		windowWrapper.addEventListener("pointerdown", Factory.pointerDown)
		windowWrapper.addEventListener("pointermove", Factory.pointerMove)
		windowWrapper.addEventListener("pointerup", Factory.pointerUp)

		window.addEventListener("resize", () => { Mover.updatePositionIfCollision({ target: windowWrapper }) })

		Factory.space.append(windowWrapper)
		openWindows.set(windowIdentifier, windowWrapper)
	}
	loaded(id, iframe, promiseResolve) {
		const message = { command: "init", data: { app: id.description, palette: activeCustomObject.palette, origin: window.location.origin } }
		iframe.addEventListener("load", () => iframe.contentWindow.postMessage(message, iframe.src))
		iframe.contentWindow.postMessage(message, iframe.src)
		promiseResolve()
	}
	/** @param {import("./core").TargetData} data */ maximise({ target }) { target.classList.add("maximised") }
	/** @param {import("./core").TargetData} data */ minimise({ target }) { target.classList.add("minimised") }
	/** @param {import("./core").TargetData} data */ unMaximise({ target }) { target.classList.remove("maximised") }
	/** @param {import("./core").TargetData} data */ unMinimise({ target }) { target.classList.remove("minimised") }
	pointerDown({ target, pointerId, x, y }) {
		target.setPointerCapture(pointerId)
		WebdeskEvent.WINDOW_RESIZE_START.emit({ target, x, y })
	}
	pointerMove({ target, pointerId, x, y }) {
		if (Resizer.inResize) WebdeskEvent.WINDOW_RESIZE.emit({ target, x, y })
	}
	pointerUp({ target, pointerId, x, y }) {
		target.releasePointerCapture(pointerId)
		if (Resizer.inResize) WebdeskEvent.WINDOW_RESIZE_END.emit({ target, x, y })
	}
	async messageInterpreter({ data: message, appWindow }) {
		switch (message.command) {
			case "save_custom": {
				if (appWindow.getAttribute("window") !== "colors") return
				WebdeskEvent.CUSTOMIZATION_SAVE_REQUEST.emit(message.data)
				return
			}
			case "get_customs": {
				const customs = await WebdeskRequest.CUSTOMIZATION_GET()
				const target = appWindow.querySelector(".content")
				target.contentWindow.postMessage({ command: "get_customs", data: customs }, target.src)
				return
			}
			case "set_custom": {
				if (appWindow.getAttribute("window") !== "colors") return
				WebdeskEvent.CUSTOMIZATION_LOAD_REQUEST.emit(message.data)
				return
			}
		}
	}
}

const Animationer = new class {
	#animationTimeout = 1000

	/** @param {import("./core").OpenData} data */ open({ target }) { Animationer.runAnimation(target, "open") }
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
	/** @param {import("./core").FocusData} data */
	relayFocusChange({ lost, gain }) {
		if (gain && MessagingHub.getChannels(gain)) {
			const messageChannel = MessagingHub.getChannels(gain).titlebar
			messageChannel.postMessage({ command: "focus", data: true })
		}
		if (lost && MessagingHub.getChannels(lost)) {
			const messageChannel = MessagingHub.getChannels(gain).titlebar
			messageChannel.postMessage({ command: "focus", data: false })
		}
	}
	/** @param {import("./core").TargetData} data */
	relayMaximise({ target }) {
		if (target.classList.contains("maximised")) { WebdeskEvent.WINDOW_MAXIMISE_END.emit({ target }) }
		else { WebdeskEvent.WINDOW_MAXIMISE.emit({ target }) }
	}
	/** @param {MessageEvent} messageEvent */
	messageInterpreter({ data: message, appWindow}) {
		switch(message.command) {
			case "move-end": {
				if (Mover.inMove) return WebdeskEvent.WINDOW_MOVE_END.emit({ ...message.data, target: appWindow })
				else return
			}
			case "move": {
				if (Mover.inMove) return WebdeskEvent.WINDOW_MOVE.emit({ ...message.data, target: appWindow })
				else return
			}
			case "move-start": return WebdeskEvent.WINDOW_MOVE_START.emit({ ...message.data, target: appWindow })
			case "close": return WebdeskEvent.WINDOW_CLOSE.emit({ target: appWindow })
			case "minimise": return WebdeskEvent.WINDOW_MINIMISE.emit({ target: appWindow })
			case "maximise": return Titlebar.relayMaximise({ target: appWindow })
		}
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
	/** @param {import("./core").TargetData} data */
	clearHistory({ target }) {
		target.classList.remove("focus")
		Focuser.focusHistory = Focuser.focusHistory.filter(appWindow => !appWindow.classList.contains("close"))
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

WebdeskEvent.LAUNCHER_CLICK.on(Factory.skeletonizeWindow)

WebdeskEvent.WINDOW_MINIMISE.on(Factory.minimise)

WebdeskEvent.WINDOW_MINIMISE_END.on(Factory.unMinimise)
WebdeskEvent.WINDOW_MINIMISE_END.on(Focuser.focusWindow)
WebdeskEvent.WINDOW_MINIMISE_END.on(Animationer.unMinimise)

WebdeskEvent.WINDOW_MAXIMISE.on(Factory.maximise)

WebdeskEvent.WINDOW_MAXIMISE_END.on(Factory.unMaximise)
WebdeskEvent.WINDOW_MAXIMISE_END.on(Focuser.focusWindow)
WebdeskEvent.WINDOW_MAXIMISE_END.on(Animationer.unMaximise)

WebdeskEvent.WINDOW_OPEN.on(Animationer.open)
WebdeskEvent.WINDOW_OPEN.on(Focuser.focusWindow)

WebdeskEvent.WINDOW_CLOSE.on(Animationer.close)
WebdeskEvent.WINDOW_CLOSE.on(Focuser.clearHistory)

WebdeskEvent.TITLEBAR_MESSAGE.on(Titlebar.messageInterpreter)
WebdeskEvent.CONTENT_MESSAGE.on(Factory.messageInterpreter)

WebdeskEvent.WINDOW_UPDATED_FOCUS.on(Focuser.adjustZIndexes)
WebdeskEvent.WINDOW_UPDATED_FOCUS.on(Titlebar.relayFocusChange)

WebdeskEvent.WINDOW_MOVE_START.on(Mover.init)
WebdeskEvent.WINDOW_MOVE_START.on(Focuser.focusWindow)

WebdeskEvent.WINDOW_MOVE.on(Mover.followCursor)

WebdeskEvent.WINDOW_MOVE_END.on(Mover.reset)
WebdeskEvent.WINDOW_MOVE_END.on(Mover.updatePositionIfCollision)

WebdeskEvent.WINDOW_RESIZE_START.on(Resizer.init)
WebdeskEvent.WINDOW_RESIZE_START.on(Focuser.focusWindow)

WebdeskEvent.WINDOW_RESIZE.on(Resizer.followCursor)

WebdeskEvent.WINDOW_RESIZE_END.on(Resizer.reset)
WebdeskEvent.WINDOW_RESIZE_END.on(Mover.updatePositionIfCollision)