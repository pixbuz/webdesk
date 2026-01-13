class WebdeskOSEvent {
	constructor(eventName, objectTemplate = {}) {
		this.name = eventName;
		this.template = objectTemplate;
	}

	emit(data = {}) {
		const details = { ...this.template, ...data }
		const event = new CustomEvent(
			this.name, {
				detail: details,
				bubbles: true,
				composed: true
		})

		window.dispatchEvent(event)
	}

	on(callFunction = console.log, oneTime = false) {
		window.addEventListener(this.name, (event) => { callFunction(event.detail) }, { once: oneTime })
	}
}

function getWindowInfo(appWindow) {
	const windowID = appWindow.getAttribute("id")
	const window = appWindow.getAttribute("id")
}

const WINDOW_EVENT_TEMPLATE = {
	id: null,
	app: "",
	target: null,
}

const TITLEBAR_MOUSEDOWN_TEMPLATE = WINDOW_EVENT_TEMPLATE

const WINDOW_OPEN = new WebdeskOSEvent("os:window-open", WINDOW_EVENT_TEMPLATE)
const WINDOW_CLOSE = new WebdeskOSEvent("os:window-closed", WINDOW_EVENT_TEMPLATE)
// const WINDOW_MOVE_END = new WebdeskOSEvent("os:window-move_end", WINDOW_EVENT_TEMPLATE)
// const WINDOW_RESIZE_END = new WebdeskOSEvent("os:window-resize_end", WINDOW_EVENT_TEMPLATE)
const WINDOW_MAXIMISE = new WebdeskOSEvent("os:window-maximised", WINDOW_EVENT_TEMPLATE)
const WINDOW_MINIMISED = new WebdeskOSEvent("os:window-minimised", WINDOW_EVENT_TEMPLATE)

const TITLEBAR_MOUSEDOWN = new WebdeskOSEvent("os:titlebar-mousedown", TITLEBAR_MOUSEDOWN_TEMPLATE)