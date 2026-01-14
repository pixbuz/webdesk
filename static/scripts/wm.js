const assetsWindow = document.getElementsByName("Window")[0]
const windowSpace = document.querySelector(".Window.Space")
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

function openWindow(launcher) {
	// Spawns a window and sets all the appropriate proprieties also maps the newly opened window in 'windowsBoundryBoxes'
	const appWindow = assetsWindow.cloneNode(true)
	const appName = launcher.getAttribute("app")

	// Add the event listeners for the different window elements
	appWindow.addEventListener("mousedown", windowInteraction)
	appWindow.querySelector(".Titlebar").addEventListener("mousedown", enableMovement)

	appWindow.querySelector(".Close").addEventListener("click", (event) => { closeWindow(event.target.closest(`[name="Window"]`)) })
	appWindow.querySelector(".Minimize").addEventListener("click", (event) => { minimizeWindow(event.target.closest(`[name="Window"]`)) })
	appWindow.querySelector(".Maximise").addEventListener("click", (event) => { maximiseWindow(event.target.closest(`[name="Window"]`)) })

	// Set all the elements' values
	appWindow.querySelector("iframe").src = `apps/${appName}/?${windowID}`
	appWindow.querySelector(".Icon").src = `apps/${appName}/icon`
	appWindow.querySelector(".Title").innerText = appName

	appWindow.setAttribute("app", appName)
	appWindow.setAttribute("id", windowID)

	// Add the new window to the window space
	windowSpace.appendChild(appWindow)

	// Send the event
	windowID++
	WINDOW_OPEN.emit(getWindowInfo(appWindow))
}

function closeWindow(appWindow) {
	windowsBoundryBoxes.delete(appWindow)
	setTimeout(() => { appWindow.remove() }, 100)

	WINDOW_CLOSE.emit(getWindowInfo(appWindow))
}

function maximiseWindow(appWindow) {
	if (!appWindow.classList.contains("maximised")) {
		appWindow.classList.add("maximised")
		WINDOW_MAXIMISE.emit(getWindowInfo(appWindow))
	} else {
		appWindow.classList.remove("maximised")
		WINDOW_MAXIMISE_END.emit(getWindowInfo(appWindow))
	}
}

function minimizeWindow(appWindow) {
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

	if (event.target.tagName === "BUTTON") return
	else if (appWindow.classList.contains("maximised")) return

	clickOffsets = [ event.x , event.y ]
	appWindow.classList.add("moving")

	movingWindow = appWindow
}

function moveWindow(moveEvent) {
	// Move the window applying the current mouse position - the click offset + the old position
	if (!movingWindow) return
	
	const xPos = moveEvent.x - clickOffsets[0] + windowsBoundryBoxes.get(movingWindow).x
	const yPos = moveEvent.y - clickOffsets[1] + windowsBoundryBoxes.get(movingWindow).y

	movingWindow.style.transform = `translate(${xPos}px,${yPos}px)`
}

function updatePositionBasedOnViewportCollision(details) {
	// Checks if the current window is in a valid position inside webdesk and corrects it if needed
	const boundingBox = details.target.getBoundingClientRect()

	if (boundingBox.right > window.innerWidth) boundingBox.x = ( window.innerWidth - boundingBox.width )
	else if (boundingBox.left < 0) boundingBox.x = 0

	if (boundingBox.bottom > window.innerHeight) boundingBox.y = ( window.innerHeight - boundingBox.height )
	else if (boundingBox.top < 0) boundingBox.y = 0

	details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
	windowsBoundryBoxes.set(details.target, boundingBox)
}

function windowInteraction(event) {
	// Checks where the user clicked in a Window and enables resizing
	if (event.target.getAttribute("name") == "Window") {
		const boundingBox = windowsBoundryBoxes.get(event.target)
		clickOffsets = [ event.x, event.y ]

		const relClickX = clickOffsets[0] - boundingBox.x
		const relClickY = clickOffsets[1] - boundingBox.y

		grabPos = [
			(relClickY <= 6), // Top
			(boundingBox.width - relClickX <= 6), // Left
			(boundingBox.height - relClickY <= 6), // Bottom
			(relClickX <= 6) // Right
		]

		if (grabPos[1] || grabPos[3]) event.target.classList.add("resizeX")
		if (grabPos[0] || grabPos[2]) event.target.classList.add("resizeY")

		if (grabPos[0] && grabPos[3] || grabPos[1] && grabPos[2]) event.target.classList.add("resizeXY1")
		else if (grabPos[0] && grabPos[1] || grabPos[2] && grabPos[3]) event.target.classList.add("resizeXY2")

		if (grabPos.indexOf(true) != -1) resizingWindow = event.target
	}
}

function resizeWindow(moveEvent) {
	// Interprets where a user clicked and runs the appropriate rescaling of a Window
	if (!resizingWindow) return

	const boundingBox = windowsBoundryBoxes.get(resizingWindow)

	if (grabPos[0] && grabPos[3]) { // Top Right corner special treatment
		resizingWindow.style.transform = `translate(${boundingBox.x + moveEvent.x - clickOffsets[0]}px , ${boundingBox.y + moveEvent.y - clickOffsets[1]}px)`
		resizingWindow.style.height = `${boundingBox.height - moveEvent.y + clickOffsets[1]}px`
		resizingWindow.style.width = `${boundingBox.width - moveEvent.x + clickOffsets[0]}px`
		return
	}

	if (grabPos[0]) {
		resizingWindow.style.transform = `translate(${boundingBox.x}px , ${boundingBox.y + moveEvent.y - clickOffsets[1]}px)`
		resizingWindow.style.height = `${boundingBox.height - moveEvent.y + clickOffsets[1]}px`
	} else if (grabPos[2]) { resizingWindow.style.height = `${boundingBox.height + moveEvent.y - clickOffsets[1]}px` }

	if (grabPos[3]) {
		resizingWindow.style.transform = `translate(${boundingBox.x + moveEvent.x - clickOffsets[0]}px , ${boundingBox.y}px)`
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

function checkAllViewportCollisions() {
	for (appWindow of document.getElementsByName("Window")) { updatePositionBasedOnViewportCollision(appWindow) }
}

function windowMovementEnd() {
	if (!movingWindow) return
	movingWindow.classList.remove("moving")

	WINDOW_CHECK_COLLISION.emit(getWindowInfo(movingWindow))
	movingWindow = null
}

function windowResizeEnd(event) {
	if (!resizingWindow) return
	grabPos = [ false, false, false, false ]

	resizingWindow.classList.remove("resizeY")
	resizingWindow.classList.remove("resizeX")
	resizingWindow.classList.remove("resizeXY1")
	resizingWindow.classList.remove("resizeXY2")

	WINDOW_CHECK_COLLISION.emit(getWindowInfo(resizingWindow))
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

WINDOW_OPEN.on(centerNewWindow)

WINDOW_MOVE_END.on(windowMovementEnd)

WINDOW_CHECK_COLLISION.on(updatePositionBasedOnViewportCollision)

WINDOW_OPEN.on(focusWindow)
WINDOW_MOVE_END.on(focusWindow)

windowCommandChannel.addEventListener("message", windowCommandChannelHandler)

document.addEventListener("mousemove", moveWindow)
document.addEventListener("mousemove", resizeWindow)

document.addEventListener("mouseup", windowMovementEnd)
document.addEventListener("mouseup", windowResizeEnd)

window.addEventListener("resize", checkAllViewportCollisions)