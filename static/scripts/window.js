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
		appWindow.classList.add("max-transition")
		appWindow.classList.add("maximised")

		setTimeout(() => appWindow.classList.remove("max-transition"), 50)
	} else {
		appWindow.classList.add("min-transition")
		appWindow.classList.remove("maximised")
		
		setTimeout(() => appWindow.classList.remove("min-transition"), 50)
	}
}

function minimizeWindow(button) {
	const appWindow = button.parentElement.parentElement.parentElement
	appWindow.style.display = "none"
}