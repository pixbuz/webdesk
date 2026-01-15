function windowOpenAnimation(details) {
	// Window Open Animation Function
	// Add the animation class
	details.target.classList.add("opening")

	// Remove the animation class
	setTimeout(() => details.target.classList.remove("opening"), 100)
}

function windowToMaximisedAnimation(details) {
	// Window Maximising Animation Function
	// Add the animation class
	details.target.classList.add("to-maximised")

	// Remove the animation class
	setTimeout(() => { details.target.classList.remove("to-maximised") }, 100)
}

function windowFromMaximisedAnimation(details) {
	// Window From Maximised Animation Function
	// Add the animation class
	details.target.classList.add("from-maximised")

	// Remove the animation class
	setTimeout(() => { details.target.classList.remove("from-maximised") }, 100)
}

function windowToMinimisedAnimation(details) {
	// Window Minimising Animation Function
	// Add the animation class
	details.target.classList.add("to-minimised")

	// Remove the animation class
	setTimeout(() => { details.target.classList.remove("to-maximised") }, 100)
}

function windowFromMinimisedAnimation(details) {
	// Window From Minimised Animation Function
	// Add the animation class
	details.target.classList.add("from-minimised")

	// Remove the animation class
	setTimeout(() => { details.target.classList.remove("from-minimised") }, 100)
}

function windowCloseAnimation(details) {
	// Window Closing Animation Function
	details.target.classList.add("closing")
}

let removeClassTimeout
function appDockMaximisedAnimation() {
	// Animation assist class for the appDock when there is a maximised window
	showappDock()
	clearTimeout(removeClassTimeout)
	if (!appDock.matches(":hover")) removeClassTimeout = setTimeout(hideappDock, 2500)
}

function hideAppDockAnimation() {
	// Handles the hiding of the App Dock
	appDock.classList.remove("up")
}

function showAppDockAnimation() {
	// Handles the showing of the App Dock
	appDock.classList.add("up")
}

function appDockIconOpenAnimation(details) {
	// Adding a Dock Icon Animation Function
}

function appDockIconCloseAnimation(details) {
	// Removing a Dock Icon Animation Function
}

function appDockIconFocusAnimation(details) {
	// Focus Changed Dock Icon Animation Function
}

WINDOW_OPEN.on([windowOpenAnimation, appDockIconOpenAnimation])
WINDOW_CLOSE.on([windowCloseAnimation, appDockIconCloseAnimation])

WINDOW_CHANGED_FOCUS.on([appDockIconFocusAnimation])

WINDOW_MAXIMISE.on([windowToMaximisedAnimation, hideAppDockAnimation])
WINDOW_MAXIMISE_END.on([windowFromMaximisedAnimation, showAppDockAnimation])

WINDOW_MINIMISE.on([windowToMinimisedAnimation])
WINDOW_MINIMISE_END.on([windowFromMinimisedAnimation])

appDock.addEventListener("mouseover", appDockMaximisedAnimation)