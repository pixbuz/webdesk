function windowOpenAnimation(details) {
	// Add the animation class
	details.target.classList.add("opening")

	// Remove the animation class
	setTimeout(() => details.target.classList.remove("opening"), 100)
}

function windowToMaximisedAnimation(details) {
	details.target.classList.add("to-maximised")

	setTimeout(() => { details.target.classList.remove("to-maximised") }, 100)
}

function windowFromMaximisedAnimation(details) {
	details.target.classList.add("from-maximised")

	setTimeout(() => { details.target.classList.remove("from-maximised") }, 100)
}

function windowToMinimisedAnimation(details) {
	details.target.classList.add("to-minimised")

	setTimeout(() => { details.target.classList.remove("to-maximised") }, 100)
}

function windowFromMinimisedAnimation(details) {
	details.target.classList.add("from-minimised")

	setTimeout(() => { details.target.classList.remove("from-minimised") }, 100)
}

function windowCloseAnimation(details) {
	details.target.classList.add("closing")
}



function appDockIconOpenAnimation(details) {

}

function appDockIconCloseAnimation(details) {

}

function appDockIconFocusAnimation(details) {

}

WINDOW_OPEN.on(windowOpenAnimation)
WINDOW_OPEN.on(appDockIconOpenAnimation)

WINDOW_CLOSE.on(windowCloseAnimation)
WINDOW_CLOSE.on(appDockIconCloseAnimation)

WINDOW_CHANGED_FOCUS.on(appDockIconFocusAnimation)

WINDOW_MAXIMISE.on(windowToMaximisedAnimation)
WINDOW_MAXIMISE_END.on(windowFromMaximisedAnimation)

WINDOW_MINIMISE.on(windowToMinimisedAnimation)
WINDOW_MINIMISE_END.on(windowFromMinimisedAnimation)