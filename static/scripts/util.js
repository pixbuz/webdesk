// Utility Class to Dispatch and Listen for Custom OS Events
class WebdeskOSEvent {
	constructor(eventName, objectTemplate = {}) {
		this.name = eventName;
		this.template = objectTemplate;
	}

	emit(data = {}) {
		// Used to trigger an Event
		// Merge the Template with the emit Data
		const details = { ...this.template, ...data }
		// Create the Event
		const event = new CustomEvent(this.name, {
			detail: details,
			bubbles: true,
			composed: true
		})

		// Dispatch the Custom Event
		window.dispatchEvent(event)
	}

	on(callBackFunctions = [], oneTime = false) {
		// Used to set callback Functions to an event in batch

		callBackFunctions.map((callBackFunction) => {
			console.log(`Resistred the "${callBackFunction.name}" function to run on the "${this.name}" event`)
			window.addEventListener(this.name, (event) => { callBackFunction(event.detail) }, { once: oneTime })
		})
	}
}

// Utility Function to extract all window information from a div
function getWindowInfo(appWindow) {
	const windowID = appWindow.getAttribute("id")
	const appName = appWindow.getAttribute("app")
	
	return { id: windowID, target: appWindow, app: appName}
}

// Detail Object Template for WINDOW Events
const WINDOW_EVENT_TEMPLATE = {
	id: null,
	app: "",
	target: null,
}

// Detail Object Template for TITLEBAR Events
const TITLEBAR_EVENT_TEMPLATE = WINDOW_EVENT_TEMPLATE

const WINDOW_OPEN = new WebdeskOSEvent("window-open", WINDOW_EVENT_TEMPLATE)
const WINDOW_CLOSE = new WebdeskOSEvent("window-closed", WINDOW_EVENT_TEMPLATE)

const WINDOW_MOVE = new WebdeskOSEvent("window-move_end", WINDOW_EVENT_TEMPLATE)
const WINDOW_MOVE_END = new WebdeskOSEvent("window-move", WINDOW_EVENT_TEMPLATE)
const WINDOW_RESIZE = new WebdeskOSEvent("window-resize_end", WINDOW_EVENT_TEMPLATE)
const WINDOW_RESIZE_END = new WebdeskOSEvent("window-resize", WINDOW_EVENT_TEMPLATE)

const WINDOW_MAXIMISE = new WebdeskOSEvent("window-maximised", WINDOW_EVENT_TEMPLATE)
const WINDOW_MAXIMISE_END = new WebdeskOSEvent("window-maximised_end", WINDOW_EVENT_TEMPLATE)
const WINDOW_MINIMISE = new WebdeskOSEvent("window-minimised", WINDOW_EVENT_TEMPLATE)
const WINDOW_MINIMISE_END = new WebdeskOSEvent("window-minimised_end", WINDOW_EVENT_TEMPLATE)

const WINDOW_CHANGED_FOCUS = new WebdeskOSEvent("window-changed_focus", WINDOW_EVENT_TEMPLATE)
const WINDOW_CHECK_COLLISION = new WebdeskOSEvent("window-check_collision", WINDOW_EVENT_TEMPLATE)

const TITLEBAR_MOUSEDOWN = new WebdeskOSEvent("titlebar-mousedown", TITLEBAR_EVENT_TEMPLATE)