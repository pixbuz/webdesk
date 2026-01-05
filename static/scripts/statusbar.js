/*
 * Contains all the functions
 * that make the statusbar work
*/

const statusBar = document.querySelector(".StatusBar")
const statusBarClock = statusBar.querySelector(".Clock")
const statusBarOpenWindows = statusBar.querySelector(".Open")
const assetsStatusIcon = document.getElementsByName("StatusIcon")[0]
const windowIndicator = new WeakMap()

let removeClassTimeout

const initTime = new Date()
const clockTime = [
	initTime.getSeconds(),
	initTime.getMinutes(),
	initTime.getHours(),

	initTime.getDate(),
	initTime.getMonth() + 1,
	initTime.getFullYear()
]

function initClock() {
	statusBarClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0)
	statusBarClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
	statusBarClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)

	statusBarClock.querySelector(".Day").innerText = `${clockTime[3]}`.padStart(2, 0)
	statusBarClock.querySelector(".Month").innerText = `${clockTime[4]}`.padStart(2, 0)
	statusBarClock.querySelector(".Year").innerText = clockTime[5]

	setTimeout(() => {
		updateClock()
		setInterval(updateClock, 1000)
	}, 1000 - initTime.getMilliseconds())
}

function updateClock() {
	clockTime[0]++

	if (clockTime[0] >= 60) {
		clockTime[0] = 0
		clockTime[1]++

		statusBarClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0)
		statusBarClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
	} else statusBarClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0)

	if (clockTime[1] >= 60) {
		clockTime[1] = 0
		clockTime[2]++

		statusBarClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
		statusBarClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)
	}

	if (clockTime[2] >= 24) {
		clockTime[2] = 0
		clockTime[3]++

		statusBarClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)
		statusBarClock.querySelector(".Day").innerText = `${clockTime[3]}`.padStart(2, 0)
	}
}

function statusbarUpdate(appWindow, eventType) {
	switch(eventType) {
		case "open": return updateOpen(appWindow)
		case "focus": return updateFocus(appWindow)
		case "close": return updateClose(appWindow)
		case "minimized": return updateMini(appWindow)
	}
}

function updateOpen(appWindow) {
	const statusIcon = assetsStatusIcon.cloneNode(true)
	const appName = appWindow.getAttribute("app")

	statusIcon.classList.add("focus")
	statusIcon.setAttribute("app", appName)
	statusIcon.querySelector(".Icon").src = `apps/${appName}/icon`

	statusBarOpenWindows.append(statusIcon)
	windowIndicator.set(appWindow, statusIcon)
}

function updateClose(appWindow) {
	windowIndicator.delete(appWindow)
}

function updateMini(appWindow) {
	const statusIcon = windowIndicator.get(appWindow)

	statusIcon.classList.add("mini")
}

function updateFocus(appWindow) {
	const statusIcon = windowIndicator.get(appWindow)
	
	
}

function focusLinkedWindow(statusIcon) {
	const appName = statusIcon.getAttribute("app")
	const window = windowSpace.querySelector(`[app="${appName}"]`)

	window.classList.remove("minimized")
	window.classList.remove("maximised")
	window.classList.add("focus")
}

function maximisedWindowAnimations() {
	// Animation assist class for the statusbar when there is a maximised window
	showStatusbar()
	clearTimeout(removeClassTimeout)
	if (!statusBar.matches(":hover")) removeClassTimeout = setTimeout(hideStatusbar, 2500)
}

function hideStatusbar() {
	// Handles the hiding of the statusbar
	statusBar.classList.remove("up")
}

function showStatusbar() {
	// Handles the showing(?) of the statusbar
	statusBar.classList.add("up")
}

statusBar.addEventListener("mouseover", maximisedWindowAnimations)
statusBar.addEventListener("mouseleave", maximisedWindowAnimations)

initClock()