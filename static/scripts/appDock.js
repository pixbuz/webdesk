// Get the App Dock Element
const appDock = document.querySelector(".AppDock")
// Get the Clock of inside App Dock
const appDockClock = appDock.querySelector(".Clock")
// Get the Open Windows element inside App Dock
const appDockOpenWindows = appDock.querySelector(".Open")
// Template of the Open Window Icon Element
const assetsDockIcon = document.getElementsByName("DockIcon")[0]
// Map between an Open Window and a Open Window Icon Element
const windowDockIconMap = new WeakMap()

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

function appDockUpdateOpenWindow(details) {
	// Spawn a Newly Opened Window's Dock Icon
	const dockIcon = assetsDockIcon.cloneNode(true)
	const appName = details.target.getAttribute("app")
	appDockOpenWindows.append(dockIcon)

	// Add the necessary event listeners
	dockIcon.addEventListener("click", focusLinkedWindow)
	
	// Set the values of the Dock Icon
	dockIcon.setAttribute("app", appName)
	dockIcon.querySelector(".Icon").src = `apps/${appName}/icon`

	// Link the new Dock Icon to its Window
	windowDockIconMap.set(details.target, dockIcon)
}

function appDockUpdateClosedWindow(details) {
	// Delete a Just Closed Window's Dock Icon
	const dockIcon = windowDockIconMap.get(details.target)

	// Delete the Dock Icon and remove it from the Map
	dockIcon.remove()
	windowDockIconMap.delete(details.target)
}

function appDockUpdateMinimizedWindow(details) {
	// Update an Minimized Window Dock Icon
	const dockIcon = windowDockIconMap.get(details.target)

	// Add the class
	dockIcon.classList.add("mini")
}

function focusLinkedWindow(event) {
	// Shifts the Focus on the Linked Window of a Dock Icon
	const appName = event.target.closest(`[name="DockIcon"]`).getAttribute("app")
	const window = windowSpace.querySelector(`[app="${appName}"]`)

	// Removes classes for some reason
	window.classList.remove("minimized")
	window.classList.remove("maximised")
}

initClock()

WINDOW_OPEN.on([appDockUpdateOpenWindow])
WINDOW_CLOSE.on([appDockUpdateClosedWindow])

WINDOW_MINIMISE.on([appDockUpdateMinimizedWindow])
WINDOW_MINIMISE_END.on([appDockUpdateMinimizedWindow])