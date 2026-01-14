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
	const appName = appWindow.getAttribute("app")
	
	return { id: windowID, target: appWindow, app: appName}
}

const WINDOW_EVENT_TEMPLATE = {
	id: null,
	app: "",
	target: null,
}

const TITLEBAR_EVENT_TEMPLATE = WINDOW_EVENT_TEMPLATE

const WINDOW_OPEN = new WebdeskOSEvent("window-open", WINDOW_EVENT_TEMPLATE)
const WINDOW_CLOSE = new WebdeskOSEvent("window-closed", WINDOW_EVENT_TEMPLATE)
const WINDOW_MOVE_END = new WebdeskOSEvent("window-move_end", WINDOW_EVENT_TEMPLATE)
const WINDOW_RESIZE_END = new WebdeskOSEvent("window-resize_end", WINDOW_EVENT_TEMPLATE)

const WINDOW_MAXIMISE = new WebdeskOSEvent("window-maximised", WINDOW_EVENT_TEMPLATE)
const WINDOW_MAXIMISE_END = new WebdeskOSEvent("window-maximised_end", WINDOW_EVENT_TEMPLATE)
const WINDOW_MINIMISE = new WebdeskOSEvent("window-minimised", WINDOW_EVENT_TEMPLATE)
const WINDOW_MINIMISE_END = new WebdeskOSEvent("window-minimised_end", WINDOW_EVENT_TEMPLATE)

const WINDOW_CHANGED_FOCUS = new WebdeskOSEvent("window-changed_focus", WINDOW_EVENT_TEMPLATE)
const WINDOW_CHECK_COLLISION = new WebdeskOSEvent("window-check_collision", WINDOW_EVENT_TEMPLATE)

const TITLEBAR_MOUSEDOWN = new WebdeskOSEvent("titlebar-mousedown", TITLEBAR_EVENT_TEMPLATE)