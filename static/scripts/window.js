/*
 * Contains the main interactions
 * that the user can have with an open
 * window that doesn't bother the wm
*/

function closeWindow(button) {
	// Function called by the close button
	// of a window used to close it
	const appWindow = button.parentElement.parentElement.parentElement
	openWindowsProprieties.delete(appWindow)

	appWindow.classList.add("closing")
	setTimeout(() => appWindow.remove(), 100)
}

function maximiseWindow(button) {
	// Function called by the maximise button
	// of a window used to make it full screen
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
	// Function called by the minimize button
	// of a window used to make it disappear
	const appWindow = button.parentElement.parentElement.parentElement
	appWindow.style.display = "none"
}