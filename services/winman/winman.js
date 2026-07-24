import { log, WebdeskEvent } from "@webdesk/"

class Window extends HTMLElement {
	static newWindow(domain, name, icon) {
		const appWindow = document.createElement("webdesk-window")
		
		appWindow.classList.add("opening")
		appWindow.domain = domain
		appWindow.name = name
		appWindow.icon = icon
		
		space.append(appWindow)
		return appWindow
	}

	domain = ""
	name = ""
	titlebarElement = document.createElement("iframe")
	contentElement = document.createElement("iframe")

	#position = { x: 0, y: 0 }
	#size = { width: 0, height: 0 }
	#resize = { top: false, right: false, bottom: false, left: false }
	#moveFlag = false
	#startInteraction = { x: 0, y: 0, width: 0, height: 0, screenX: 0, screenY: 0 }

	get x() { return this.#position.x }
	set x(value) {
		this.#position.x = Math.max(-this.#size.width + 20, Math.min(Math.floor(value), window.innerWidth - 20))
		this.style.left = `${this.#position.x}px`
	}
	get y() { return this.#position.y }
	set y(value) {
		this.#position.y = Math.max(0, Math.min(Math.floor(value), window.innerHeight - 20))
		this.style.top = `${this.#position.y}px`
	}
	get width() { return this.#size.width }
	set width(value) {
		this.style.width = `${Math.floor(value)}px`
		this.#size.width = this.getBoundingClientRect().width
	}
	get height() { return this.#size.height }
	set height(value) {
		this.style.height = `${Math.floor(value)}px`
		this.#size.height = this.getBoundingClientRect().height
	}

	#resizing = () => {
		log.verb(`Resize start for window ${this.domain}`)
		this.classList.add(
			this.#resize.top ? "top" : "resizing",
			this.#resize.right ? "right" : "resizing",
			this.#resize.bottom ? "bottom" : "resizing",
			this.#resize.left ? "left" : "resizing",
		)
	}
	#pointerDown = (event) => {
		const { pointerId, clientX, clientY, screenX, screenY } = event
		const windowX = clientX - this.#position.x
		const windowY = clientY - this.#position.y

		this.#resize = {
			left: windowX < 16,
			top: windowY < 16,
			right: windowX > this.#size.width - 16,
			bottom: windowY > this.#size.height - 16
		}

		const isResizing = this.#resize.left || this.#resize.top || this.#resize.right || this.#resize.bottom
		
		if (!isResizing && windowY < 40) this.#moveFlag = true

		if (isResizing || this.#moveFlag) {
			this.#startInteraction = {
				x: this.#position.x,
				y: this.#position.y,
				width: this.#size.width,
				height: this.#size.height,
				screenX,
				screenY
			}

			this.setPointerCapture(pointerId)
			this.#resizing()
		}

		WebdeskEvent.emit("WINDOW INTERACTION", { domain: this.domain, appWindow: this })
	}
	#pointerMove = (event) => {
		const isResizing = this.#resize.top || this.#resize.right || this.#resize.bottom || this.#resize.left
		if (!isResizing && !this.#moveFlag) return

		const dx = event.screenX - this.#startInteraction.screenX
		const dy = event.screenY - this.#startInteraction.screenY

		if (this.#moveFlag) {
			this.x = this.#startInteraction.x + dx
			this.y = this.#startInteraction.y + dy
			return
		}

		if (this.#resize.right) this.width = this.#startInteraction.width + dx
		if (this.#resize.bottom) this.height = this.#startInteraction.height + dy

		if (this.#resize.left) {
			this.width = this.#startInteraction.width - dx
			this.x = this.#startInteraction.x + dx
		}
		if (this.#resize.top) {
			this.height = this.#startInteraction.height - dy
			this.y = this.#startInteraction.y + dy
		}
	}
	#pointerUp = (event) => {
		this.#resize = { top: false, right: false, bottom: false, left: false }
		this.#moveFlag = false
		
		this.classList.remove(
			"resizing",
			"moving",
			"top",
			"right",
			"bottom",
			"left",
		)
		this.releasePointerCapture(event.pointerId)
		
		log.verb(`Resize end for window "${this.name}"`)
	}
	#initialize = () => {
		const clientRect = this.getBoundingClientRect()
		this.#size = { width: clientRect.width || 600, height: clientRect.height || 400 }
		
		this.x = (window.innerWidth - this.#size.width) / 2
		this.y = (window.innerHeight - this.#size.height) / 2

		this.classList.remove("opening")
	}
	#titlebarDown = (event) => {
		const target = event.target
		
		if (target.tagName === "BUTTON" || target.closest("button")) return
		this.#moveFlag = true
		this.#startInteraction = {
			x: this.x,
			y: this.y,
			screenX: event.screenX,
			screenY: event.screenY
		}
		
		WebdeskEvent.emit("WINDOW INTERACTION", { domain: this.domain, appWindow: this })
		target.setPointerCapture(event.pointerId)
		log.verb(`Move start for window "${this.name}"`)
		this.classList.add("moving")
	}
	#titlebarMove = (event) => {
		if (!this.#moveFlag) return
		const dx = event.screenX - this.#startInteraction.screenX
		const dy = event.screenY - this.#startInteraction.screenY
		
		this.x = this.#startInteraction.x + dx
		this.y = this.#startInteraction.y + dy
	}
	#titlebarUp = (event) => {
		if (!this.#moveFlag) return
		this.#moveFlag = false
		event.target.releasePointerCapture(event.pointerId)
		log.verb(`Move end for window "${this.name}"`)
		this.classList.remove("moving")
	}
	#setupIframes = () => {
		WebdeskEvent("WINDOW LOADED", { titlebar: this.titlebarElement, content: this.contentElement })

		this.titlebarElement.setAttribute("titlebar", "")
		this.contentElement.setAttribute("content", "")
		
		this.titlebarElement.contentDocument.body.onpointerdown = this.#titlebarDown
		this.titlebarElement.contentDocument.body.onpointermove = this.#titlebarMove
		this.titlebarElement.contentDocument.body.onpointerup = this.#titlebarUp

		this.titlebarElement.contentDocument.querySelector("button[close]").onclick = () => this.kill()
		this.titlebarElement.contentDocument.querySelector("button[maximise]").onclick = () => this.classList.toggle("maximise")
		this.titlebarElement.contentDocument.querySelector("button[minimise]").onclick = () => this.suspend()
		
		this.titlebarElement.contentDocument.querySelector("p[name]").innerText = this.name
		this.titlebarElement.contentDocument.querySelector("p[name]").style.color = `var(--text-primary)`
		this.titlebarElement.contentDocument.querySelector("img[icon]").src = this.icon
	}
	#domRemove = () => {
		this.remove()
		log.verb(`Window "${this.name}" removed from DOM`)
	}

	kill() {
		log.info(`Closed window "${this.name}"`)
		activeWindows.delete(this.domain)
		this.classList.add("closing")
		WebdeskEvent("WINDOW CLOSE", { domain: this.domain, name: this.name, appWindow: this })

		this.contentElement.contentWindow.postMessage({
			sender: "WINDOW MANAGER",
			type: "kill",
		})
		setTimeout(this.#domRemove, 1000)
	}
	suspend() {
		log.info(`Suspended window "${this.name}"`)
		this.classList.add("minimise")
		this.contentElement.contentWindow.postMessage({
			sender: "WINDOW MANAGER",
			type: "suspend",
		})
		WebdeskEvent.emit("WINDOW INTERACTION", { domain: this.domain, appWindow: this })
	}
	resume() {
		log.info(`Resumed window "${this.name}"`)
		this.classList.remove("minimise")
		this.contentElement.contentWindow.postMessage({
			sender: "WINDOW MANAGER",
			type: "resume",
		})
		WebdeskEvent.emit("WINDOW INTERACTION", { domain: this.domain, appWindow: this })
	}
	async connectedCallback() {
		this.onpointerdown = this.#pointerDown
		this.onpointermove = this.#pointerMove
		this.onpointerup = this.#pointerUp
		
		this.setAttribute("window", this.name)
		
		this.append(this.titlebarElement, this.contentElement)
		
		const loads = [
			new Promise(res => this.titlebarElement.addEventListener("load", res, { once: true })),
			new Promise(res => this.contentElement.addEventListener("load", res, { once: true })),
		]
		
		this.titlebarElement.src = "/titlebar"
		this.contentElement.src = `/app/${this.domain}/`
		
		log.dbug(`Waiting for window "${this.name}" to load its contents`)
		await Promise.all(loads)
		log.dbug(`Contents of window "${this.name}" loaded`)

		this.#setupIframes()
		this.#initialize()
	}

	constructor() { super() }
}

function focus({ appWindow: focusWindow }) {
	if (activityQueue.includes(focusWindow)) {
		const focusWindowIndex = activityQueue.indexOf(focusWindow)
		activityQueue.splice(focusWindowIndex, 1)
		log.dbug(`Window interaction event received, focus is "${focusWindow.name}" (was in queue position ${focusWindowIndex})`)
	} else log.dbug(`Window interaction event received, focus is "${focusWindow.name}" (new window)`)
	
	activityQueue.forEach((queuedAppWindow, index) => {
		log.dbug(`Updated z-index of window "${queuedAppWindow.name}"`)
		queuedAppWindow.classList.remove("focus")
		queuedAppWindow.style.zIndex = 10 + index
	})
	
	activityQueue.push(focusWindow)
	focusWindow.classList.add("focus")
	focusWindow.style.zIndex = 10 + activityQueue.length
}

function shiftFocus({ appWindow: closedWindow }) {
	const index = activityQueue.indexOf(closedWindow)
	const isFocused = index === activityQueue.length - 1
	activityQueue.splice(index, 1)
	
	if (isFocused && activityQueue.length > 0) {
		const nextWindow = activityQueue[activityQueue.length - 1]
		focus({ appWindow: nextWindow })
	}
}

function open({ name, domain, icon }) {
	if (activeWindows.has(domain)) {
		const appWindow = activeWindows.get(domain)
		return appWindow.resume()
	} else if (!domain) return log.warn(`received a request to open a window with no domain attached (${domain})`)
	
	const appWindow = Window.newWindow(domain, name, icon)
	log.info(`Opened window of application "${name}" with domain "${domain}"`)
	
	activeWindows.set(domain, appWindow)
	activityQueue.push(appWindow)
	focus({ appWindow, domain })
}

function messageInbox({ data: { type, target, data }, source }) {
	if (target.toUpperCase() !== "WINDOW MANAGER") return
	switch(type) {
		// case "kill": return (source, data)
		// case "suspend": return (source, data)
		// case "resume": return (source, data)
	}
}

const space = document.createElement("section")
export const activeWindows = new Map()
const activityQueue = [ ]

window.addEventListener("message", messageInbox)

WebdeskEvent.on("LAUNCHER CLICK", open)
WebdeskEvent.on("WINDOW INTERACTION", focus)
WebdeskEvent.on("WINDOW CLOSE", shiftFocus)

customElements.define("webdesk-window", Window)

space.setAttribute("space", "window")
document.body.appendChild(space)

log.verb("Windows ready")