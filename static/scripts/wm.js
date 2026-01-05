/*
 * Contains all the functions
 * needed by the wm
*/

const assetsWindow = document.getElementsByName("Window")[0]
const windowSpace = document.querySelector(".Window.Space")

// Pairs a open window with its boundry box
const windowsBox = new WeakMap()
// Used for interpreting mouse movements during a window resize
let grabPos = [ false, false, false, false ]
let resizingWindow = null
let movingWindow = null
// Contains the offsets to remove from a mouse click during a window movement
let clickOffsets = []

function openWindow(launcher) {
	// Spawns a window and sets all the appropriate proprieties
	// also maps the newly opened window in 'windowsBox'
	const appWindow = assetsWindow.cloneNode(true)
	const appName = launcher.getAttribute("app")

	appWindow.querySelector(".Titlebar").addEventListener("mousedown", enableMovement)
	appWindow.addEventListener("mousedown", windowInteraction)

	appWindow.querySelector(".Icon").src = `apps/${appName}/icon`
	appWindow.querySelector("iframe").src = `apps/${appName}/`
	appWindow.setAttribute("app", appName)
	windowSpace.appendChild(appWindow)

	const boundingBox = appWindow.getBoundingClientRect()
	windowsBox.set(appWindow, boundingBox)

	statusbarUpdate(appWindow, "open")
	focusWindow(appWindow)

	boundingBox.x = ( window.innerWidth - boundingBox.width ) / 2
	boundingBox.y = ( window.innerHeight - boundingBox.height ) / 2

	appWindow.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
}

function enableMovement(event) {
	// Register the window for movement status
	if (event.target.tagName === "BUTTON") return

	const appWindow = event.target.closest(`[name="Window"]`)

	if (appWindow.classList.contains("maximised")) return

	clickOffsets = [ event.x , event.y ]
	appWindow.classList.add("moving")
	focusWindow(appWindow)

	movingWindow = appWindow
}

function moveWindow(moveX, moveY) {
	// Move the window applying the current mouse position
	// - the click offset + the old position
	if (!movingWindow) return

	const xPos = moveX - clickOffsets[0] + windowsBox.get(movingWindow).x
	const yPos = moveY - clickOffsets[1] + windowsBox.get(movingWindow).y

	movingWindow.style.transform = `translate(${xPos}px,${yPos}px)`
}

function updateWindowPosition(target) {
	// Checks if the current window is in a valid position
	// inside webdesk and corrects it if needed
	const boundingBox = target.getBoundingClientRect()

	if (boundingBox.right > window.innerWidth) boundingBox.x = ( window.innerWidth - boundingBox.width )
	else if (boundingBox.left < 0) boundingBox.x = 0

	if (boundingBox.bottom > window.innerHeight) boundingBox.y = ( window.innerHeight - boundingBox.height )
	else if (boundingBox.top < 0) boundingBox.y = 0

	target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
	windowsBox.set(target, boundingBox)
}

function windowInteraction(event) {
	// Checks where the user clicked in
	// a Window and enables resizing
	if (event.target.getAttribute("name") == "Window") {
		const boundingBox = windowsBox.get(event.target)
		clickOffsets = [ event.x, event.y ]
		focusWindow(event.target)

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

function resizeWindow(moveX, moveY) {
	// Interprets where a user clicked and runs
	// the appropriate rescaling of a Window
	const boundingBox = windowsBox.get(resizingWindow)

	if (grabPos[0] && grabPos[3]) { // Top Right corner special treatment
		resizingWindow.style.transform = `translate(${boundingBox.x + moveX - clickOffsets[0]}px , ${boundingBox.y + moveY - clickOffsets[1]}px)`
		resizingWindow.style.height = `${boundingBox.height - moveY + clickOffsets[1]}px`
		resizingWindow.style.width = `${boundingBox.width - moveX + clickOffsets[0]}px`
		return
	}

	if (grabPos[0]) {
		resizingWindow.style.transform = `translate(${boundingBox.x}px , ${boundingBox.y + moveY - clickOffsets[1]}px)`
		resizingWindow.style.height = `${boundingBox.height - moveY + clickOffsets[1]}px`
	} else if (grabPos[2]) resizingWindow.style.height = `${boundingBox.height + moveY - clickOffsets[1]}px`

	if (grabPos[3]) {
		resizingWindow.style.transform = `translate(${boundingBox.x + moveX - clickOffsets[0]}px , ${boundingBox.y}px)`
		resizingWindow.style.width = `${boundingBox.width - moveX + clickOffsets[0]}px`
	} else if (grabPos[1]) resizingWindow.style.width = `${boundingBox.width + moveX - clickOffsets[0]}px`
}

function focusWindow(appWindow) {
	// Makes a window go in focus
	for (openAppWindow of document.getElementsByName("Window")) {
		openAppWindow.classList.remove("focus")
		const zIndex = parseInt(openAppWindow.style.zIndex)
		if (zIndex > 20) openAppWindow.style.zIndex = zIndex - 1
	}

	appWindow.classList.add("focus")
	appWindow.style.zIndex = 29
	statusbarUpdate(appWindow, "focus")
}

function resizeEvent() {
	for (appWindow of document.getElementsByName("Window"))
		updateWindowPosition(appWindow)
}

function moveEvent(event) {
	if (movingWindow) moveWindow(event.x , event.y)
	else if (resizingWindow) resizeWindow(event.x , event.y)
}

function mouseupEvent(event) {
	if (movingWindow) {
		movingWindow.classList.remove("moving")
		updateWindowPosition(movingWindow)
		movingWindow = null
	}

	if (resizingWindow) {
		updateWindowPosition(resizingWindow)
		resizingWindow.classList.remove("resizeX")
		resizingWindow.classList.remove("resizeY")
		resizingWindow.classList.remove("resizeXY1")
		resizingWindow.classList.remove("resizeXY2")
		resizingWindow = null
		grabPos = [ false, false, false, false ]
	}
}

document.addEventListener("mousemove", moveEvent)
document.addEventListener("mouseup", mouseupEvent)
window.addEventListener("resize", resizeEvent)