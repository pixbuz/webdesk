const assetsWindow = document.getElementsByName("Window")[0]
const windowSpace = document.querySelector(".Window.Space")

const openWindowsProprieties = new WeakMap()
let grabPos = [ false, false, false, false ]
let resizingWindow = null
let movingWindow = null
let clickOffsets = []

function openWindow(launcher) {
	const appWindow = assetsWindow.cloneNode(true)
	const appName = launcher.getAttribute("app")

	appWindow.querySelector(".Titlebar").addEventListener("mousedown", enableMovement)
	appWindow.addEventListener("mousedown", windowInteraction)

	appWindow.querySelector(".Icon").src = `apps/${appName}/icon`
	appWindow.querySelector("iframe").src = `apps/${appName}/`
	appWindow.setAttribute("app", appName)
	windowSpace.appendChild(appWindow)
	focusWindow(appWindow)

	openWindowsProprieties.set(appWindow, appWindow.getBoundingClientRect())

	const center = [ ( window.innerWidth - openWindowsProprieties.get(appWindow).width )/2 , ( window.innerHeight - openWindowsProprieties.get(appWindow).width.height )/2 ]
	appWindow.style.transform = `translate(${center[0]}px,${center[1]}px)`
}

function enableMovement(event) {
	if (event.target.tagName === "BUTTON") return

	const appWindow = event.target.closest(`[name="Window"]`)

	if (appWindow.classList.contains("maximised")) return

	clickOffsets = [ event.x , event.y ]
	appWindow.classList.add("moving")
	focusWindow(appWindow)

	movingWindow = appWindow
}

function moveWindow(moveX, moveY) {
	if (!movingWindow) return

	const xPos = moveX - clickOffsets[0] + openWindowsProprieties.get(movingWindow).x
	const yPos = moveY - clickOffsets[1] + openWindowsProprieties.get(movingWindow).y

	movingWindow.style.transform = `translate(${xPos}px,${yPos}px)`
}

function updateWindowPosition(target) {
	const boundingBox = target.getBoundingClientRect()

	if (boundingBox.right > window.innerWidth) boundingBox.x = ( window.innerWidth - boundingBox.width )
	else if (boundingBox.left < 0) boundingBox.x = 0

	if (boundingBox.bottom > window.innerHeight) boundingBox.y = ( window.innerHeight - boundingBox.height )
	else if (boundingBox.top < 0) boundingBox.y = 0

	target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
	openWindowsProprieties.set(target, boundingBox)
}

function windowInteraction(event) {
	if (event.target.getAttribute("name") == "Window") {
		const boundingBox = openWindowsProprieties.get(event.target)
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
	const boundingBox = openWindowsProprieties.get(resizingWindow)

	if (grabPos[0] && grabPos[3]) {
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
	for (openAppWindow of document.getElementsByName("Window")) {
		openAppWindow.classList.remove("focus")
		const zIndex = parseInt(openAppWindow.style.zIndex)
		if (zIndex > 20) openAppWindow.style.zIndex = zIndex - 1
	}

	appWindow.classList.add("focus")
	appWindow.style.zIndex = 29
	focusedWindow = appWindow
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

socket.addEventListener("open", async () => {
	const apps = (await serverQuery("app list"))
			.split(",")
			.sort()

	for (appName of apps) await addLauncher(appName)
})

document.addEventListener("mousemove", moveEvent)
document.addEventListener("mouseup", mouseupEvent)
window.addEventListener("resize", resizeEvent)