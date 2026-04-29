import { Time, WebdeskEvent, ApplicationManifests } from "./core"

const element = document.querySelector("[dock]")
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

let mode, downDelay, upDelay
const windowToIcon = new WeakMap()

let focusedIcon

const maximised = {
	/** @param {import("./core").TargetData} data */
	add({ target }) {
		const app = target.getAttribute("app")
		const icon = open.querySelector(`[icon=${app}]`)
		if (icon) { icon.classList.add("maximised") }
	},
	/** @param {import("./core").TargetData} data */
	remove({ target }) {
		const app = target.getAttribute("app")
		const icon = open.querySelector(`[icon=${app}]`)
		if (icon) { icon.classList.remove("maximised") }
	}
}

const minimised = {
	/** @param {import("./core").TargetData} data */
	add({ target }) {
		const app = target.getAttribute("app")
		const icon = open.querySelector(`[icon=${app}]`)
		if (icon) { icon.classList.add("minimised") }
	},
	/** @param {import("./core").TargetData} data */
	remove({ target }) {
		const app = target.getAttribute("app")
		const icon = open.querySelector(`[icon=${app}]`)
		if (icon) { icon.classList.remove("minimised") }
	}
}

/** @param {import("./core").TargetData} data */
function add({ app, target }) {
	const icon = document.createElement("button"),
		image = document.createElement("img"),
		name = document.createElement("p")

	image.src = `${window.location.protocol}//${app}.${window.location.hostname}/icon`
	name.innerText = app

	icon.classList.add("focus")
	icon.setAttribute("icon", app)
	icon.append(name, image)
	windowToIcon.set(target, icon)

	icon.addEventListener("click", () => WebdeskEvent.WINDOW_MINIMISE_END.emit({ target }))

	open.append(icon)
}

/** @param {import("./core").TargetData} data */
function updateClosedWindow({ target }) {
	const icon = windowToIcon.get(target)
	console.log(target, icon, windowToIcon)

	if (icon) {
		windowToIcon.delete(closed)
		icon.remove()
	}
}

/** @param {import("./core").FocusData} data */
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

/** @param {import("./core").ClockData} data */
function updateClockElement({ update }) {
	update.forEach((piece) => {
		clockPieces[piece].innerText = `${Time[piece]}`.padStart(2, 0)
	})
}

WebdeskEvent.CLOCK_UPDATE.on(updateClockElement)

WebdeskEvent.WINDOW_OPEN.on(add)
WebdeskEvent.WINDOW_CLOSE.on(updateClosedWindow)

WebdeskEvent.WINDOW_MINIMISE.on(minimised.add)
WebdeskEvent.WINDOW_MINIMISE_END.on(maximised.remove)

WebdeskEvent.WINDOW_MAXIMISE.on(maximised.add)
WebdeskEvent.WINDOW_MAXIMISE_END.on(maximised.remove)

WebdeskEvent.WINDOW_UPDATED_FOCUS.on(focus)

Object.keys(clockPieces).forEach((piece) => {
	clockPieces[piece].innerText = `${Time[piece]}`.padStart(2, 0)
})