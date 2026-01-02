let oldBoundryBox = null

function closeWindow(button) {
	const appWindow = button.parentElement.parentElement.parentElement
	openWindowsProprieties.delete(appWindow)

	appWindow.classList.add("closing")
	setTimeout(() => appWindow.remove(), 100)
}

function maximiseWindow(button) {
	const appWindow = button.parentElement.parentElement.parentElement

	if (!appWindow.classList.contains("maximised")) {
		appWindow.classList.add("maximised")

		setTimeout(() => {
			appWindow.style.transform = "translate(0px,0px)"
			appWindow.style.width = "100%"
			appWindow.style.height = "100%"
		}, 100)

		oldBoundryBox = openWindowsProprieties.get(appWindow)
	} else {
		appWindow.classList.remove("maximised")

		appWindow.style.transform = `translate(${oldBoundryBox.x}px,${oldBoundryBox.y}px)`
		appWindow.style.width = `${oldBoundryBox.width}px`
		appWindow.style.height = `${oldBoundryBox.height}px`
		
		setTimeout(() => updateWindowPosition(appWindow), 100)

		oldBoundryBox = null
	}
}

function minimizeWindow(button) {
	const appWindow = button.parentElement.parentElement.parentElement
	appWindow.style.display = "none"
}