/*
 * Contains all the functions
 * that make the app dock work
*/

const appDock = document.querySelector(".AppDock")
const appDockClock = appDock.querySelector(".Clock")
const appDockOpenWindows = appDock.querySelector(".Open")
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
	appDockClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0)
	appDockClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
	appDockClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)

	appDockClock.querySelector(".Day").innerText = `${clockTime[3]}`.padStart(2, 0)
	appDockClock.querySelector(".Month").innerText = `${clockTime[4]}`.padStart(2, 0)
	appDockClock.querySelector(".Year").innerText = clockTime[5]

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

		appDockClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0)
		appDockClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
	} else appDockClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0)

	if (clockTime[1] >= 60) {
		clockTime[1] = 0
		clockTime[2]++

		appDockClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
		appDockClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)
	}

	if (clockTime[2] >= 24) {
		clockTime[2] = 0
		clockTime[3]++

		appDockClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)
		appDockClock.querySelector(".Day").innerText = `${clockTime[3]}`.padStart(2, 0)
	}
}

function appDockUpdate(appWindow, eventType) {
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

	appDockOpenWindows.append(statusIcon)
	windowIndicator.set(appWindow, statusIcon)
}

function updateClose(appWindow) {
	const statusIcon = windowIndicator.get(appWindow)

	statusIcon.remove()
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
	// Animation assist class for the appDock when there is a maximised window
	showappDock()
	clearTimeout(removeClassTimeout)
	if (!appDock.matches(":hover")) removeClassTimeout = setTimeout(hideappDock, 2500)
}

function hideappDock() {
	// Handles the hiding of the appDock
	appDock.classList.remove("up")
}

function showappDock() {
	// Handles the showing(?) of the appDock
	appDock.classList.add("up")
}

appDock.addEventListener("mouseover", maximisedWindowAnimations)
appDock.addEventListener("mouseleave", maximisedWindowAnimations)

initClock()