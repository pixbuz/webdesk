const socket = new WebSocket("http://localhost:3720")
const launcherSpace = document.querySelector(".Launcher.Space")
const windowSpace = document.querySelector(".Window.Space")
const statusBar = document.querySelector(".StatusBar")

const assetsLauncher = document.getElementsByName("Launcher")[0]
const assetsWindow = document.getElementsByName("Window")[0]


let movingWindow = null
let focusedWindow = null
let clickOffsets = []
let lastPosition = []
let openWindows = []

function serverQuery(message) {
	socket.send(message)
	return new Promise(resolve =>
		socket.addEventListener("message",
			response => resolve(response.data), { once: true }
		)
	)
}

async function addLauncher(appName) {
	const launcher = assetsLauncher.cloneNode(true)
	const description = await serverQuery(`app desc ${appName}`)
	launcherSpace.appendChild(launcher)

	launcher.setAttribute("app", appName)
	launcher.setAttribute("title", description == "undefined" ? "" : description)

	launcher.querySelector(".Name").innerText = appName
	launcher.querySelector(".Icon").src = `apps/${appName}/icon`
}

function openWindow(launcher) {
	const appWindow = assetsWindow.cloneNode(true)
	const appName = launcher.getAttribute("app")
	windowSpace.appendChild(appWindow)
	focusWindow(appWindow)
	openWindows.push(appWindow)

	const boundingBox = appWindow.getBoundingClientRect()
	const center = [ (window.innerWidth - boundingBox.width) / 2 , (window.innerHeight - boundingBox.height) / 2 ]

	appWindow.setAttribute("x", center[0])
	appWindow.setAttribute("y", center[1])
	appWindow.setAttribute("bx", center[0])
	appWindow.setAttribute("by", center[1])
	appWindow.style.transform = `translate(${center[0]}px , ${center[1]}px)`

	appWindow.setAttribute("app", appName)
	appWindow.querySelector(".Icon").src = `apps/${appName}/icon`
}

function closeWindow(button) {
	const appWindow = button.parentElement.parentElement.parentElement
	appWindow.classList.add("closing")
	setTimeout(() => appWindow.remove(), 100)
	openWindows = openWindows.filter(openAppWindow => openAppWindow != appWindow)
}

function enableMovementCheck(event) {
	if (event.target.classList.contains("Titlebar")) {
		const appWindow = event.target.parentElement
		clickOffsets = [ event.x , event.y ]
		appWindow.classList.add("moving")
		focusWindow(appWindow)

		movingWindow = appWindow
	}
}

function moveWindow(event) {
	if (!movingWindow) return

	const currentXPos = parseInt(movingWindow.getAttribute("x"))
	const currentYPos = parseInt(movingWindow.getAttribute("y"))

	const xPos = event.x - clickOffsets[0] + currentXPos
	const yPos = event.y - clickOffsets[1] + currentYPos

	lastPosition = [ xPos, yPos ]
	movingWindow.setAttribute("bx", xPos)
	movingWindow.setAttribute("by", yPos)

	movingWindow.style.transform = `translate(${xPos}px, ${yPos}px)`
}

function windowBoundryCheck(target) {
	const boundingBox = target.getBoundingClientRect()

	let x = parseInt(target.getAttribute("bx"))
	let y = parseInt(target.getAttribute("by"))
	
	if (boundingBox.right > window.innerWidth) { x = window.innerWidth - boundingBox.width }
	if (boundingBox.bottom > window.innerHeight) { y = window.innerHeight - boundingBox.height }

	if (boundingBox.left < 0) { x = 0 }
	if (boundingBox.top < 0) { y = 0 }

	return [ x , y ]
}

function resizeEvent(event) {
	const openWindows = document.getElementsByName("Window")

	for (appWindow of openWindows) {
		lastPosition = windowBoundryCheck(appWindow)
		appWindow.style.transform = `translate(${lastPosition[0]}px, ${lastPosition[1]}px)`
		appWindow.setAttribute("x", lastPosition[0])
		appWindow.setAttribute("y", lastPosition[1])
	}
}

function disableMovement(event) {
	if (!movingWindow) return

	lastPosition = windowBoundryCheck(movingWindow)
	movingWindow.classList.add("smooth")
	movingWindow.style.transform = `translate(${lastPosition[0]}px, ${lastPosition[1]}px)`
	setTimeout(() => document.querySelector(".smooth").classList.remove("smooth"), 100)

	movingWindow.setAttribute("x", lastPosition[0])
	movingWindow.setAttribute("y", lastPosition[1])

	movingWindow.classList.remove("moving")
	movingWindow = null
}

socket.addEventListener("open", async () => {
	const apps = (await serverQuery("app list")).split(",")
	const sortedApps = apps.sort()

	for (appName of sortedApps) await addLauncher(appName)
})

function focusWindow(appWindow) {
	for (openAppWindow of openWindows) {
		if (!openAppWindow) continue
		openAppWindow.classList.remove("focus")
		const zIndex = parseInt(openAppWindow.style.zIndex)
		if (zIndex > 20) openAppWindow.style.zIndex = zIndex - 1
	}

	appWindow.classList.add("focus")
	appWindow.style.zIndex = 29
	focusedWindow = appWindow
}

document.addEventListener("mousemove", moveWindow)
document.addEventListener("mousedown", enableMovementCheck)
document.addEventListener("mouseup", disableMovement)
window.addEventListener("resize", resizeEvent)