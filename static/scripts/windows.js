function closeWindow(button) {
	// Function called by the close button of a window used to close it
	const appWindow = button.parentElement.parentElement.parentElement
	windowsBox.delete(appWindow)

	appWindow.classList.add("closing")
	setTimeout(() => appWindow.remove(), 100)

	appDockUpdate(appWindow, "close")
}

function maximiseWindow(button) {
	// Function called by the maximise button of a window used to make it full screen
	const appWindow = button.parentElement.parentElement.parentElement

	if (!appWindow.classList.contains("maximised")) {
		appWindow.classList.add("maximised")

		focusWindow(appWindow)

		appWindow.style.transform = `translate(0)`
		appWindow.style.width = `100%`
		appWindow.style.height = `100%`

		hideappDock()
	} else {
		const boundingBox = windowsBox.get(appWindow)
		appWindow.classList.remove("maximised")
		appWindow.classList.add("from-maximised")
		
		appWindow.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
		appWindow.style.width = `${boundingBox.width}px`
		appWindow.style.height = `${boundingBox.height}px`

		setTimeout(() => { appWindow.classList.remove("from-maximised") }, 100)
		showappDock()
	}
}

function minimizeWindow(button) {
	// Function called by the minimize button of a window used to make it disappear
	const appWindow = button.parentElement.parentElement.parentElement
	appWindow.classList.add("minimized")

	appDockUpdate(appWindow, "minimized")
}