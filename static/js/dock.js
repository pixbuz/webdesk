// TODO: Make a better system for window to icon and icon to window for the appdock

import { time, WebdeskEvent, ApplicationManifests } from "./core"

const element = document.querySelector(".AppDock")
const clock = element.querySelector(".Clock")
const open = element.querySelector(".Open")

const windowToIcon = new WeakMap()
const iconToWindow = new WeakMap()

const maximised = {
	/** @param {import("./core").TargetData} targetData */
	add(targetData) {
		const icon = open.querySelector(`[icon=${targetData.app}]`)
		if (icon) { icon.classList.add("maximised") }
	},
	/** @param {import("./core").TargetData} targetData */
	remove(targetData) {
		const icon = open.querySelector(`[icon=${targetData.app}]`)
		if (icon) { icon.classList.remove("maximised") }
	}
}

const minimised = {
	/** @param {import("./core").TargetData} targetData */
	add(targetData) {
		const icon = open.querySelector(`[icon=${targetData.app}]`)
		if (icon) { icon.classList.add("minimised") }
	},
	/** @param {import("./core").TargetData} targetData */
	remove(targetData) {
		const icon = open.querySelector(`[icon=${targetData.app}]`)
		if (icon) { icon.classList.remove("minimised") }
	}
}

/** @param {import("./core").OpenData} openData */
function add(openData) {
	const manifest = ApplicationManifests[openData.app]
	if (manifest.service) { return }

	const icon = document.createElement("button")
	const image = document.createElement("img")
	const name = document.createElement("p")

	windowToIcon.set(openData.target, icon)
	iconToWindow.set(icon, openData.target)

	icon.append(name, image)
	icon.classList.add("focus")

	open.append(icon)

	icon.addEventListener("click", (event) => { WebdeskEvent.ICON_CLICK.emit({ target: event.target.closest("[icon]") }) })
	icon.setAttribute("icon", openData.app)
	image.src = `apps/${openData.app}/${manifest.icon}`
	name.innerText = openData.app
}

/** @param {import("./core").CloseData} closeData */
function updateClosedWindow(closeData) {
	const icon = windowToIcon.get(closeData.closed)

	if (icon) {
		windowToIcon.delete(closeData.closed)
		icon.remove()
	}
}

/** @param {import("./core").TargetData} targetData */
function focusLinkedWindow(targetData) {
	const window = iconToWindow.get(targetData.target)

	window.classList.remove("minimised")
}

/** @param {import("./core").FocusData} focusData */
function focus(focusData) {
	const oldFocus = windowToIcon.get(focusData.old)
	const newFocus = windowToIcon.get(focusData.new)

	if (oldFocus) { oldFocus.classList.remove("focus") }
	if (newFocus) { newFocus.classList.add("focus") }
}

/** @param {import("./core").ChangeData} clockData */
function updateClockElement(clockData) {
	for (const piece of clockData.update) {
		switch(piece) {
			case "seconds":
			case "minutes":
			case "hours": clock.querySelector(`.${piece}`).innerText = `${time.clock[piece]}`.padStart(2, 0); continue

			case "day":
			case "month":
			case "year": clock.querySelector(`.${piece}`).innerText = `${time.date[piece]}`.padStart(2, 0); continue
		}
	}
}

function initClockElement() {
	this.clock.querySelector(".seconds").innerText = `${time.clock.seconds}`.padStart(2, 0)
	this.clock.querySelector(".minutes").innerText = `${time.clock.minutes}`.padStart(2, 0)
	this.clock.querySelector(".hours").innerText = `${time.clock.hours}`.padStart(2, 0)

	this.clock.querySelector(".day").innerText = `${time.date.day}`.padStart(2, 0)
	this.clock.querySelector(".month").innerText = `${time.date.month}`.padStart(2, 0)
	this.clock.querySelector(".year").innerText = `${time.date.year}`
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