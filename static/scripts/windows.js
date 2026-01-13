const windowCommandChannel = new BroadcastChannel("wm/commands")

function closeMe(button) {
	// Function called by the close button of a window used to close it
	const appWindow = button.parentElement.parentElement.parentElement

	closeWindow(appWindow)
}

function closeWindow(appWindow) {
	appWindow.classList.add("closing")
	windowsBox.delete(appWindow)
	appDockUpdateClosedWindow(appWindow)
	setTimeout(() => { appWindow.remove() }, 100)
}

function maximiseMe(button) {
	// Function called by the maximise button of a window used to make it full screen
	const appWindow = button.parentElement.parentElement.parentElement
	
	maximiseWindow(appWindow)
}

function maximiseWindow(appWindow) {
	if (!appWindow.classList.contains("maximised")) {
		appWindow.classList.add("maximised")

		appWindow.style.transform = `translate(0)`
		appWindow.style.width = `100%`
		appWindow.style.height = `100%`

		hideappDock()
		WINDOW_MAXIMISE.emit({ id: windowID, target: appWindow, app: appName })
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

function minimizeMe(button) {
	// Function called by the minimize button of a window used to make it disappear
	const appWindow = button.parentElement.parentElement.parentElement

	minimizeWindow(appWindow)
}

function minimizeWindow(appWindow) {
	appWindow.classList.add("minimized")
	appDockUpdateMinimizedWindow(appWindow)
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

windowCommandChannel.onmessage = windowCommandChannelHandler