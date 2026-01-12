// Get the App Dock Element
const appDock = document.querySelector(".AppDock")
// Get the Clock of inside App Dock
const appDockClock = appDock.querySelector(".Clock")
// Get the Open Windows element inside App Dock
const appDockOpenWindows = appDock.querySelector(".Open")
// Template of the Open Window Icon Element
const assetsStatusIcon = document.getElementsByName("StatusIcon")[0]
// Map between an Open Window and a Open Window Icon Element
const windowIndicator = new WeakMap()

// Timeout used for animations
let removeClassTimeout

// Get the client start time
const initTime = new Date()
// Initialize the Clock and Date Values
const clockTime = [
	initTime.getSeconds(),
	initTime.getMinutes(),
	initTime.getHours(),

	initTime.getDate(),
	initTime.getMonth() + 1,
	initTime.getFullYear()
]

function initClock() {
	// Set up the Clock Text Elements
	appDockClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0)
	appDockClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
	appDockClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)
	
	// Sets the up the Date Text Elements
	appDockClock.querySelector(".Day").innerText = `${clockTime[3]}`.padStart(2, 0)
	appDockClock.querySelector(".Month").innerText = `${clockTime[4]}`.padStart(2, 0)
	appDockClock.querySelector(".Year").innerText = clockTime[5]

	// "Nullifies" the start time offset
	setTimeout(() => {
		// Sets up a function to update the clock every second
		updateClock()
		setInterval(updateClock, 1000)
	}, 1000 - initTime.getMilliseconds())
}

function updateClock() {
	// Runs every second, updating the Clock in the frontend
	clockTime[0]++ // Add a second to the current time

	// If the seconds hit 60
	if (clockTime[0] >= 60) {
		// Set them to 0 and add a minute
		clockTime[0] = 0
		clockTime[1]++

		// Update Seconds and Minutes
		appDockClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0)
		appDockClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
	} else { appDockClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0) }

	// If the minutes hit 60
	if (clockTime[1] >= 60) {
		// Set them to 0 and add an hour
		clockTime[1] = 0
		clockTime[2]++

		// Update Minutes and Hours
		appDockClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
		appDockClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)
	}

	// If the hours hit 24
	if (clockTime[2] >= 24) {
		// Set them to 0 and add a day
		clockTime[2] = 0
		clockTime[3]++

		// Update the Hours and Days
		appDockClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)
		appDockClock.querySelector(".Day").innerText = `${clockTime[3]}`.padStart(2, 0)
	}
}

function appDockUpdateOpenWindow(appWindow) {
	// Update an Open Window Open Icon
	const statusIcon = assetsStatusIcon.cloneNode(true)
	const appName = appWindow.getAttribute("app")

	statusIcon.classList.add("focus")
	statusIcon.setAttribute("app", appName)
	statusIcon.querySelector(".Icon").src = `apps/${appName}/icon`

	appDockOpenWindows.append(statusIcon)
	windowIndicator.set(appWindow, statusIcon)
}

function appDockUpdateClosedWindow(appWindow) {
	// Update a Closed Window Open Icon
	const statusIcon = windowIndicator.get(appWindow)

	statusIcon.remove()
	windowIndicator.delete(appWindow)
}

function appDockUpdateMinimizedWindow(appWindow) {
	// Update an Minimized Window Open Icon
	const statusIcon = windowIndicator.get(appWindow)

	statusIcon.classList.add("mini")
}

function appDockUpdateFocusedWindow(appWindow) {
	// Update an Focussed Window Open Icon
	const statusIcon = windowIndicator.get(appWindow)

	
}

function focusLinkedWindow(statusIcon) {
	// Focusses the Window Linked to a Open Icon
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
	// Handles the hiding of the App Dock
	appDock.classList.remove("up")
}

function showappDock() {
	// Handles the showing of the App Dock
	appDock.classList.add("up")
}

appDock.addEventListener("mouseover", maximisedWindowAnimations)
appDock.addEventListener("mouseleave", maximisedWindowAnimations)

initClock()