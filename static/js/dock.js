// TODO: When in overlap mode hide when a window is maximised

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
function add({ target }) {
	const app = target.getAttribute("app")
	const manifest = ApplicationManifests[app]
	console.log(target, ApplicationManifests, manifest)
	if (manifest.service) { return }

	const icon = document.createElement("button"),
		image = document.createElement("img"),
		name = document.createElement("p")

	image.src = `${window.location.protocol}//${app}.${window.location.hostname}/icon`
	name.innerText = app

	icon.append(name, image)
	icon.classList.add("focus")
	icon.setAttribute("icon", app)

	windowToIcon.set(target, icon)
	open.append(icon)

	icon.addEventListener("click", () => { WebdeskEvent.ICON_CLICK.emit({ target }) })
}

/** @param {import("./core").CloseData} data */
function updateClosedWindow({ closed, open }) {
	const icon = windowToIcon.get(closed)

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
		clockPieces[piece].innerText = `${time[piece]}`.padStart(2, 0)
	})
}

const Stator = new class {
	inHover = false
	isOverlapped = false
	downTimeout = 0
	upTimeout = 0
	autoHide

	/** @param {import("./core").CustomizationData} data */
	updateVars({ id, css, object }) {
		Stator.autoHide = object.dock.behavior.autoHide
		Stator.dockState()
	}
	dockUpCheck() {
		const { mode } = Stator.autoHide

		if (mode === "always") { return Stator.inHover }
		else if (mode === "overlap") { return !Stator.isOverlapped || Stator.inHover }
		else { return true }
	}
	dockState(skipWait = false) {
		if (Stator.dockUpCheck()) {
			clearTimeout(Stator.downTimeout)
			clearTimeout(Stator.upTimeout)
			return Stator.upTimeout = setTimeout(() => {
				if (Stator.dockUpCheck()) { element.classList.add("up") }
			}, skipWait ? 0 : Stator.autoHide.upDelay)
		}

		clearTimeout(Stator.downTimeout)
		clearTimeout(Stator.upTimeout)
		Stator.downTimeout = setTimeout(() => {
			if (!Stator.dockUpCheck()) { element.classList.remove("up") }
		}, skipWait ? 0 : Stator.autoHide.upDelay)
	}

	observer() {
		const dockBox = element.getBoundingClientRect()
		const windows = document.querySelectorAll(".Window.Space article[app]:not(.minimised)")
		let overlapped = false

		for (const win of windows) {
			const box = win.getBoundingClientRect()
			const collision = !(
				box.right < dockBox.left ||
				box.left > dockBox.right ||
				box.bottom < dockBox.top ||
				box.top > dockBox.bottom
			)

			if (collision) {
				overlapped = true
				break
			} else if (win.classList.contains("maximised")) {
				overlapped = true
				break
			}
		}

		if (Stator.isOverlapped !== overlapped) {
			Stator.isOverlapped = overlapped
			Stator.dockState()
		}
	}

	constructor() {
		WebdeskEvent.CUSTOMIZATION_LOADED.on(this.updateVars)
		WebdeskEvent.CUSTOMIZATION_CHANGE_SAVED.on(this.updateVars)

		element.addEventListener("pointerenter", () => {
			Stator.inHover = true
			Stator.dockState()
		})
		element.addEventListener("pointerleave", () => {
			Stator.inHover = false
			Stator.dockState()
		})

		const observer = new MutationObserver(() => { requestAnimationFrame(this.observer) })
		observer.observe(document.querySelector(".Window.Space"), {
			attributes: true,
			childList: true,
			subtree: true,
			attributeFilter: [ "style", "class" ]
		})
	}
}

WebdeskEvent.CLOCK_UPDATE.on(updateClockElement)

WebdeskEvent.WINDOW_OPEN.on(add)
WebdeskEvent.WINDOW_CLOSING.on(updateClosedWindow)

WebdeskEvent.WINDOW_MINIMISE.on(minimised.add)
WebdeskEvent.WINDOW_MINIMISE_END.on(maximised.remove)

WebdeskEvent.WINDOW_MAXIMISE.on(maximised.add)
WebdeskEvent.WINDOW_MAXIMISE_END.on(maximised.remove)

WebdeskEvent.WINDOW_UPDATED_FOCUS.on(focus)

Object.keys(clockPieces).forEach((piece) => {
	clockPieces[piece].innerText = `${time[piece]}`.padStart(2, 0)
})