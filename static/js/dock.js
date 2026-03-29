// TODO: Make a better system for window to icon and icon to window for the dock

import { time, WebdeskEvent, ApplicationManifests } from "./core"

const element = document.querySelector(".Dock")
const open = element.querySelector(".Open")

const clock = element.querySelector(".Clock")
const clockPieces = {
	seconds: clock.querySelector(".seconds"),
	minutes: clock.querySelector(".minutes"),
	hours: clock.querySelector(".hours"),

	day: clock.querySelector(".day"),
	month: clock.querySelector(".month"),
	year: clock.querySelector(".year"),
}

const windowToIcon = new WeakMap()
const iconToWindow = new WeakMap()

let focusedIcon

const maximised = {
	/** @param {import("./core").TargetData} targetData */
	add({ target, app }) {
		const icon = open.querySelector(`[icon=${app}]`)
		if (icon) { icon.classList.add("maximised") }
	},
	/** @param {import("./core").TargetData} targetData */
	remove({ target, app }) {
		const icon = open.querySelector(`[icon=${app}]`)
		if (icon) { icon.classList.remove("maximised") }
	}
}

const minimised = {
	/** @param {import("./core").TargetData} targetData */
	add({ target, app }) {
		const icon = open.querySelector(`[icon=${app}]`)
		if (icon) { icon.classList.add("minimised") }
	},
	/** @param {import("./core").TargetData} targetData */
	remove({ target, app }) {
		const icon = open.querySelector(`[icon=${app}]`)
		if (icon) { icon.classList.remove("minimised") }
	}
}

/** @param {import("./core").TargetData} targetData */
function add({ target, app }) {
	const manifest = ApplicationManifests[app]
	if (manifest.service) { return }

	const icon = document.createElement("button")
	const image = document.createElement("img")
	const name = document.createElement("p")

	windowToIcon.set(target, icon)
	iconToWindow.set(icon, target)

	icon.append(name, image)
	icon.classList.add("focus")

	open.append(icon)

	icon.addEventListener("click", (event) => { WebdeskEvent.ICON_CLICK.emit({ target: event.target.closest("[icon]") }) })
	icon.setAttribute("icon", app)
	image.src = `apps/${app}/${manifest.icon}`
	name.innerText = app
}

/** @param {import("./core").CloseData} closeData */
function updateClosedWindow({ closed, open }) {
	const icon = windowToIcon.get(closed)

	if (icon) {
		windowToIcon.delete(closed)
		icon.remove()
	}
}

/** @param {import("./core").TargetData} targetData */
function focusLinkedWindow({ target, app }) {
	const window = iconToWindow.get(targetData.target)

	window.classList.remove("minimised")
}

/** @param {import("./core").FocusData} focusData */
function focus({ lost, gain }) {
	const newFocusIcon = windowToIcon.get(lost)

	if (focusedIcon) {
		focusedIcon.classList.remove("focus")
		focusedIcon = undefined
	}
	if (newFocusIcon) {
		newFocusIcon.classList.add("focus")
		focusedIcon = newFocusIcon
	}
}

/** @param {import("./core").ClockData} clockData */
function updateClockElement({ update }) {
	update.forEach((piece) => {
		clockPieces[piece].innerText = `${time[piece]}`.padStart(2, 0)
	})
}

WebdeskEvent.ICON_CLICK.on(focusLinkedWindow)

WebdeskEvent.CLOCK_UPDATE.on(updateClockElement)

WebdeskEvent.WINDOW_OPEN.on(add)
WebdeskEvent.WINDOW_CLOSE.on(updateClosedWindow)

WebdeskEvent.WINDOW_MINIMISE.on(minimised.add)
WebdeskEvent.WINDOW_MINIMISE_END.on(maximised.remove)

WebdeskEvent.WINDOW_MAXIMISE.on(maximised.add)
WebdeskEvent.WINDOW_MAXIMISE_END.on(maximised.remove)

WebdeskEvent.WINDOW_UPDATED_FOCUS.on(focus)

Object.keys(clockPieces).forEach((piece) => {
	clockPieces[piece].innerText = `${time[piece]}`.padStart(2, 0)
})