// Contains the Assets Window to Clone when Opening a New Window
const assetsWindow = document.getElementsByName("Window")[0]
// Contains the Space where to spawn Windows when Opening One
const windowSpace = document.querySelector(".Window.Space")
// Public Channel where to send Commands to have the WM Act on
const windowCommandChannel = new BroadcastChannel("wm/commands")

// Pairs a open window with its boundry box
const windowsBoundryBoxes = new WeakMap()

// Used for interpreting mouse movements during a window resize
let grabPos = [ false, false, false, false ]

let resizingWindow = null
let movingWindow = null
let focusedWindow = null

// Contains the offsets to remove from a mouse click during a window movement
let clickOffsets = []
// Increasing counter to keep track of different windows
let windowID = 0

function openWindow(event) {
	// Spawns a window and sets all the appropriate proprieties also maps the newly opened window in 'windowsBoundryBoxes'
	const appWindow = assetsWindow.cloneNode(true)
	const appName = event.target.closest(`[name="Launcher"]`).getAttribute("app")

	// Add the Interaction Event Listeners for the different window Elements
	appWindow.addEventListener("mousedown", windowInteraction)
	appWindow.querySelector(".Titlebar").addEventListener("mousedown", enableMovement)
	appWindow.querySelector(".Close").addEventListener("click", (event) => { closeWindow(event.target.closest(`[name="Window"]`)) })
	appWindow.querySelector(".Minimize").addEventListener("click", (event) => { minimizeWindow(event.target.closest(`[name="Window"]`)) })
	appWindow.querySelector(".Maximise").addEventListener("click", (event) => { maximiseWindow(event.target.closest(`[name="Window"]`)) })

	// Set all the elements' values
	appWindow.setAttribute("app", appName)
	appWindow.setAttribute("id", windowID)

	appWindow.querySelector("iframe").src = `apps/${appName}/?${windowID}`
	appWindow.querySelector(".Icon").src = `apps/${appName}/icon`
	appWindow.querySelector(".Title").innerText = appName

	// Add the new window to the window space
	windowSpace.appendChild(appWindow)

	// Send the event
	windowID++
	WINDOW_OPEN.emit(getWindowInfo(appWindow))

	// !!! !!! !!!
	// DEBUG !!! !!! !!!
	if (appName == "settings") appWindow.querySelector(".Maximise").dispatchEvent(new Event("click"))
}

function closeWindow(appWindow) {
	// Closes an Open Window
	// Remove the Window from the Boundry Boxes Map
	windowsBoundryBoxes.delete(appWindow)

	// Remoes the Window
	setTimeout(() => { appWindow.remove() }, 100)

	// Send a Event
	WINDOW_CLOSE.emit(getWindowInfo(appWindow))
}

function maximiseWindow(appWindow) {
	// Handles the Maximising and un-Maximising of Windows
	if (!appWindow.classList.contains("maximised")) {
		appWindow.classList.add("maximised")
		WINDOW_MAXIMISE.emit(getWindowInfo(appWindow))
	} else {
		appWindow.classList.remove("maximised")
		WINDOW_MAXIMISE_END.emit(getWindowInfo(appWindow))
	}
}

function minimizeWindow(appWindow) {
	// Handles the Minimising of Windows
	appWindow.classList.add("minimized")
	WINDOW_MINIMISE.emit(getWindowInfo(appWindow))
}

function centerNewWindow(details) {
	// Get the new window bounding box
	const boundingBox = details.target.getBoundingClientRect()
	windowsBoundryBoxes.set(details.target, boundingBox)

	// Calculate the exact center for the new window
	boundingBox.x = ( window.innerWidth - boundingBox.width ) / 2
	boundingBox.y = ( window.innerHeight - boundingBox.height ) / 2

	// Apply the transform
	details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
}

function enableMovement(event) {
	// Register the window for movement
	const appWindow = event.target.closest(`[name="Window"]`)
	
	// If the click Landed on a Button, ignore it
	// If the user is trying to move a Maximised Window, ignore it
	if (event.target.tagName === "BUTTON") return
	else if (appWindow.classList.contains("maximised")) return

	// Set the target as the Moving Window
	movingWindow = appWindow

	// Save the click Offsets
	clickOffsets = [ event.x , event.y ]
	// Add the "moving" class to the target
	appWindow.classList.add("moving")

	// Emit the Window Move Event
	WINDOW_MOVE.emit(getWindowInfo(appWindow))
}

function moveWindow(moveEvent) {
	// Move the window applying the current mouse position - the click offset + the old position
	if (!movingWindow) return
	
	// Calculate the Translate values of the Move
	const xPos = moveEvent.x - clickOffsets[0] + windowsBoundryBoxes.get(movingWindow).x
	const yPos = moveEvent.y - clickOffsets[1] + windowsBoundryBoxes.get(movingWindow).y

	// Set the Translate values
	movingWindow.style.transform = `translate(${xPos}px,${yPos}px)`
}

function updatePositionBasedOnViewportCollision(details) {
	// Checks if the current window is in a valid position inside webdesk and corrects it if needed
	const boundingBox = details.target.getBoundingClientRect()

	if (boundingBox.right > window.innerWidth) boundingBox.x = ( window.innerWidth - boundingBox.width ) // If the window is beyond the right of the screen, move the window back to the edge
	else if (boundingBox.left < 0) boundingBox.x = 0 // If the window is beyond the left of the screen, move the window back to the edge

	if (boundingBox.bottom > window.innerHeight) boundingBox.y = ( window.innerHeight - boundingBox.height ) // If the window is beyond the bottom of the screen, move the window back to the edge
	else if (boundingBox.top < 0) boundingBox.y = 0 // If the window is beyond the top of the screen, move the window back to the edge

	// Update the Window Translate values and Boundry Box
	details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
	windowsBoundryBoxes.set(details.target, boundingBox)
}

function windowInteraction(event) {
	// Checks where the user clicked in a Window and enables resizing
	if (event.target.getAttribute("name") == "Window") {
		// Get the Window Bounding Box of the Clicked Window
		const boundingBox = windowsBoundryBoxes.get(event.target)
		// Save the click offsets
		clickOffsets = [ event.x, event.y ]

		// Calculate where Inside the Window the User Clicked
		const relClickX = clickOffsets[0] - boundingBox.x
		const relClickY = clickOffsets[1] - boundingBox.y

		// Update the Window Grab Position
		grabPos = [
			(relClickY <= 6), // Top
			(boundingBox.width - relClickX <= 6), // Left
			(boundingBox.height - relClickY <= 6), // Bottom
			(relClickX <= 6) // Right
		]

		// If the user Clicked on the Left or Right Edge
		if (grabPos[1] || grabPos[3]) { event.target.classList.add("resizeX") }
		// If the user Clicked on the Top or Bottom Edge
		if (grabPos[0] || grabPos[2]) { event.target.classList.add("resizeY") }

		// If the user clicked on the Top-Right or the Bottom-Left
		if (grabPos[0] && grabPos[3] || grabPos[1] && grabPos[2]) { event.target.classList.add("resizeXY1") }
		// If the user clicked on the Top-Left or the Bottom-Right
		else if (grabPos[0] && grabPos[1] || grabPos[2] && grabPos[3]) { event.target.classList.add("resizeXY2") }

		// Set the Resizing Target and emit the Event
		resizingWindow = event.target
		WINDOW_RESIZE.emit(getWindowInfo(resizingWindow))
	}
}

function resizeWindow(moveEvent) {
	// Interprets where a user clicked and runs the appropriate rescaling of a Window
	if (!resizingWindow) return

	// Get the Resizing Window Boundry Box
	const boundingBox = windowsBoundryBoxes.get(resizingWindow)

	if (grabPos[0] && grabPos[3]) { // Top Right corner special treatment
		resizingWindow.style.transform = `translate(${boundingBox.x + moveEvent.x - clickOffsets[0]}px,${boundingBox.y + moveEvent.y - clickOffsets[1]}px)`
		resizingWindow.style.height = `${boundingBox.height - moveEvent.y + clickOffsets[1]}px`
		resizingWindow.style.width = `${boundingBox.width - moveEvent.x + clickOffsets[0]}px`
		return
	}

	if (grabPos[0]) {
		resizingWindow.style.transform = `translate(${boundingBox.x}px,${boundingBox.y + moveEvent.y - clickOffsets[1]}px)`
		resizingWindow.style.height = `${boundingBox.height - moveEvent.y + clickOffsets[1]}px`
	} else if (grabPos[2]) { resizingWindow.style.height = `${boundingBox.height + moveEvent.y - clickOffsets[1]}px` }

	if (grabPos[3]) {
		resizingWindow.style.transform = `translate(${boundingBox.x + moveEvent.x - clickOffsets[0]}px,${boundingBox.y}px)`
		resizingWindow.style.width = `${boundingBox.width - moveEvent.x + clickOffsets[0]}px`
	} else if (grabPos[1]) { resizingWindow.style.width = `${boundingBox.width + moveEvent.x - clickOffsets[0]}px` }
}

function focusWindow(details) {
	// Makes a window go in focus
	if (details.target != focusedWindow) {
		for (openAppWindow of document.getElementsByName("Window")) {
			openAppWindow.classList.remove("focus")
			const zIndex = parseInt(openAppWindow.style.zIndex)
			if (zIndex > 20) { openAppWindow.style.zIndex = zIndex - 1 }
		}

		focusedWindow = details.target
		focusedWindow.classList.add("focus")
		focusedWindow.style.zIndex = 29

		WINDOW_CHANGED_FOCUS.emit(getWindowInfo(details.target))
	}
}

function shiftWindowFocus(details) {
	for (openAppWindow of document.getElementsByName("Window")) {
		openAppWindow.classList.remove("focus")
		const zIndex = parseInt(openAppWindow.style.zIndex)
		if (zIndex < 29) { openAppWindow.style.zIndex = zIndex + 1 }
		if (zIndex == 28) { openAppWindow.classList.add("focus") }
	}
}

function checkAllViewportCollisions() {
	// When the Viewport gets Resized, Update all the Collisions and window Sizes
	for (appWindow of document.getElementsByName("Window")) { updatePositionBasedOnViewportCollision(appWindow) }
}

function appWindowMovementEnd() {
	// Handles the End of a Window Movement
	if (!movingWindow) return

	// Remove Classes
	movingWindow.classList.remove("moving")

	// Emit the Move End Event and remove the move Target
	WINDOW_MOVE_END.emit(getWindowInfo(movingWindow))
	movingWindow = null
}

function appWindowResizeEnd(event) {
	// Handles the End of a Window Resizing
	if (!resizingWindow) return

	// Reset User Grab Position
	grabPos = [ false, false, false, false ]

	// Remove Classes
	resizingWindow.classList.remove("resizeY")
	resizingWindow.classList.remove("resizeX")
	resizingWindow.classList.remove("resizeXY1")
	resizingWindow.classList.remove("resizeXY2")

	// Emit the Resize End Event and remove the resize Target
	WINDOW_RESIZE_END.emit(getWindowInfo(resizingWindow))
	resizingWindow = null
}

function windowCommandChannelHandler(event) {
	// Handles the commands coming from the windows
	const command = event.data.split(" ")
	switch(command[0]) {
		case "close":
			const appWindow = windowSpace.querySelector(`div[id="${command[1]}"]`)
			return closeWindow(appWindow)
	}
}

