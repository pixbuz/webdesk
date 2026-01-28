// gng this may be a mistake but let's make it a worth while one
// - Event Driven
// attributes
// classes
// methods

const Utilities = new class {
	assets = document.querySelector(".Assets")
	events = {
		templates: {
			LAUNCHER_EVENT: {
				"app": null
			},
			WINDOW_EVENT: {
				"app": null
			}
		}
	}

	WebdeskEvent = class {
		constructor(eventName, objectTemplate = {}) {
			this.name = `webdesk-${eventName}`
			this.template = objectTemplate
		}

		// Used to trigger an event
		emit(data = {}) {
			// Merge the template with the passed data
			const details = { ...this.template, ...data }

			// Create the event
			const event = new CustomEvent(this.name, {
				detail: details,
				bubbles: true,
				composed: true
			})

			// Dispatch the event
			window.dispatchEvent(event)
		}

		// Binds multiple callback function to an event
		on(callBackFunctions = [], oneTime = false) {
			callBackFunctions.map((callBackFunction) => { window.addEventListener(this.name, (event) => { callBackFunction(event.detail) }, { once: oneTime }) })
		}
	}

	getWindowInfo(webdeskWindow) {
		const windowID = webdeskWindow.getAttribute("id")
		const appName = webdeskWindow.getAttribute("app")
	
		return { id: windowID, target: webdeskWindow, app: appName}
	}

	constructor() {
		Function.prototype.onEvent = function(...eventsList) {
			eventsList.map((webdeskEvent) => {
				webdeskEvent.on([this])
			})

			return this
		}

		this.events.LAUNCHER_CLICK = new this.WebdeskEvent("launcher_click", this.events.templates.LAUNCHER_EVENT)

		this.events.WINDOW_OPEN = new this.WebdeskEvent("window_open", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MOVE = new this.WebdeskEvent("window_move", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_CLOSE = new this.WebdeskEvent("window_close", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MAXIMISE = new this.WebdeskEvent("window_is_maximised", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MAXIMISE_END = new this.WebdeskEvent("window_was_maximised", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MINIMISE = new this.WebdeskEvent("window_is_minimised", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MINIMISE_END = new this.WebdeskEvent("window_was_minimised", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_UPDATED_FOCUS = new this.WebdeskEvent("window_focus_update", this.events.templates.WINDOW_EVENT)
	}
}

const LauncherManager = new class {
	launcher = Utilities.assets.querySelector(`[name="Launcher"]`)
	space = document.querySelector(".Launcher.Space")

	// Adds an application launcher to the desktop
	addLauncher(appName) {
		const newLauncher = this.launcher.cloneNode(true)
		this.space.appendChild(newLauncher)

		newLauncher.addEventListener("click", () => { Utilities.events.LAUNCHER_CLICK.emit({app: appName}) })

		newLauncher.setAttribute("app", appName)
		// newLauncher.setAttribute("title", description == "undefined" ? appName : description)
		newLauncher.querySelector(".Name").innerText = appName
		newLauncher.querySelector(".Icon").src = `apps/${appName}/icon`
	}

	constructor() {
		this.addLauncher("settings")
	}
}

const WindowManager = new class {
	rollingID = 0
	assetsWindow = Utilities.assets.querySelector(`[name="Window"]`)
	space = document.querySelector(".Window.Space")
	windowsBoundryBoxes = new WeakMap()
	actions = {
		basic: {
			// Spawns a window and sets all the appropriate proprieties also maps the newly opened window in 'windowsBoundryBoxes'
			openWindow(details) {
				const newWindow = this.assetsWindow.cloneNode(true)
				// Add the new window to the window space
				this.space.appendChild(newWindow)

				// Add the Interaction Event Listeners for the different window Elements
				newWindow.addEventListener("mosedown", WindowManager.actions.resize.windowInteraction)
				newWindow.querySelector(".Titlebar").addEventListener("mosedown", WindowManager.actions.move.enableMovement)
				newWindow.querySelector(".Close").addEventListener("click", WindowManager.actions.basic.closeWindow)
				newWindow.querySelector(".Minimise").addEventListener("click", WindowManager.actions.basic.minimiseWindow)
				newWindow.querySelector(".Maximise").addEventListener("click", WindowManager.actions.basic.maximiseWindow)

				// Set all the elements' values
				newWindow.setAttribute("app", details.app)
				newWindow.setAttribute("id", WindowManager.rollingID)
			
				newWindow.querySelector("iframe").src = `apps/${details.app}/?${WindowManager.rollingID}`
				newWindow.querySelector(".Icon").src = `apps/${details.app}/icon`
				newWindow.querySelector(".Title").innerText = details.app

				// Send the event
				WindowManager.rollingID++
				Utilities.events.WINDOW_OPEN.emit(Utilities.getWindowInfo(newWindow))

				// !!! !!! !!!
				// DEBUG !!! !!! !!!
				if (details.app == "settings") { newWindow.querySelector(".Maximise").dispatchEvent(new Event("click")) }
			},
			// Closes a window
			closeWindow(event) {
				const targetWindow = event.target.closest(`[name="Window"]`)
				// Stop tracking the window position
				windowsBoundryBoxes.delete(targetWindow)
			
				// Removes the window
				// setTimeout(() => { targetWindow.remove() }, 100)
				targetWindow.remove()
			
				// Send the close a event
				Utilities.events.WINDOW_CLOSE.emit(getWindowInfo(targetWindow))
			},
			// Handles the maximising of windows
			maximiseWindow(event) {
				const targetWindow = event.target.closest(`[name="Window"]`)

				if (!targetWindow.classList.contains("maximised")) {
					targetWindow.classList.add("maximised")
					Utilities.events.WINDOW_MAXIMISE.emit(Utilities.getWindowInfo(targetWindow))
				} else {
					targetWindow.classList.remove("maximised")
					Utilities.events.WINDOW_MAXIMISE_END.emit(Utilities.getWindowInfo(targetWindow))
				}
			},
			// Handles the minimising of windows
			minimiseWindow(event) {
				const targetWindow = event.target.closest(`[name="Window"]`)

				if (!targetWindow.classList.contains("minimized")) {
					targetWindow.classList.add("minimized")
					Utilities.events.WINDOW_MINIMISE.emit(Utilities.getWindowInfo(targetWindow))
				} else {
					targetWindow.classList.remove("minimized")
					Utilities.events.WINDOW_MINIMISE_END.emit(Utilities.getWindowInfo(targetWindow))
				}
			},
			// Makes a window the "active" window
			focusWindow(details) {
				if (details.target != focusedWindow) {
					for (openAppWindow of document.getElementsByName("Window")) {
						openAppWindow.classList.remove("focus")
						const zIndex = parseInt(openAppWindow.style.zIndex)
						if (zIndex > 20) { openAppWindow.style.zIndex = zIndex - 1 }
					}
				
					focusedWindow = details.target
					focusedWindow.classList.add("focus")
					focusedWindow.style.zIndex = 29
				
					Utilities.events.WINDOW_UPDATED_FOCUS.emit(getWindowInfo(details.target))
				}
			}
		},
		move: {
			// gaming
			centerNewWindow(details) {
				// Get the window bounding box
				const boundingBox = details.target.getBoundingClientRect()
				windowsBoundryBoxes.set(details.target, boundingBox)

				// Calculate the offsets to center the window in the viewport
				boundingBox.x = ( window.innerWidth - boundingBox.width ) / 2
				boundingBox.y = ( window.innerHeight - boundingBox.height ) / 2

				// Apply the transform
				details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
			},
			// Registers the window for movement
			enableMovement(event) {
				const targetWindow = event.target.closest(`[name="Window"]`)
			
				// If the click Landed on a Button, ignore it
				// If the user is trying to move a Maximised Window, ignore it
				if (event.target.tagName === "BUTTON") return
				else if (targetWindow.classList.contains("maximised")) return
			
				targetWindow.classList.add("moving")
			
				// Save the click Offsets
				clickOffsets = [ event.x , event.y ]
				// Add the "moving" class to the target
			
				// Emit the Window Move Event
				Utilities.events.WINDOW_MOVE.emit(Utilities.getWindowInfo(targetWindow))
			},
			// Moves a window using transform
			moveWindow(moveEvent) {
				if (!movingWindow) return
			
				// Calculate the translate values of the move:
				// current mouse position - the click offset + the old position
				const xPos = moveEvent.x - clickOffsets[0] + windowsBoundryBoxes.get(movingWindow).x
				const yPos = moveEvent.y - clickOffsets[1] + windowsBoundryBoxes.get(movingWindow).y
			
				// Set the Translate values
				movingWindow.style.transform = `translate(${xPos}px,${yPos}px)`
			},
			// Ensures that the window is not clipped by the viewport
			updatePositionBasedOnViewportCollision(details) {
				const boundingBox = details.target.getBoundingClientRect()
			
				if (boundingBox.right > window.innerWidth) boundingBox.x = ( window.innerWidth - boundingBox.width ) // If the window is beyond the right of the screen, move the window back to the edge
				else if (boundingBox.left < 0) boundingBox.x = 0 // If the window is beyond the left of the screen, move the window back to the edge
			
				if (boundingBox.bottom > window.innerHeight) boundingBox.y = ( window.innerHeight - boundingBox.height ) // If the window is beyond the bottom of the screen, move the window back to the edge
				else if (boundingBox.top < 0) boundingBox.y = 0 // If the window is beyond the top of the screen, move the window back to the edge
			
				// Update the Window Translate values and Boundry Box
				details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
				windowsBoundryBoxes.set(details.target, boundingBox)
			},
			// When the viewport gets resized, update all the collisions and window sizes
			checkAllViewportCollisions() {
				for (appWindow of document.getElementsByName("Window")) { updatePositionBasedOnViewportCollision(appWindow) }
			},
			// Handles the end of a window movement
			appWindowMovementEnd() {
				if (!movingWindow) return
			
				// Remove Classes
				movingWindow.classList.remove("moving")
			
				// Emit the Move End Event and remove the move Target
				WINDOW_MOVE_END.emit(getWindowInfo(movingWindow))
				movingWindow = null
			}
		},
		resize: {
			windowInteraction(event) {
				// Checks where the user clicked in a Window and enables resizing
				if (event.target.getAttribute("name") == "Window") {
					// Get the Window Bounding Box of the Clicked Window
					const boundingBox = windowsBoundryBoxes.get(event.target)
					// Save the click offsets
					clickOffsets = [ event.x, event.y ]
				
					// Calculate where Inside the Window the User Clicked
					const relClickX = clickOffsets[0] - boundingBox.x
					const relClickY = clickOffsets[1] - boundingBox.y
				
					// Update the Window Grab Position
					grabPos = [
						(relClickY <= 6), // Top
						(boundingBox.width - relClickX <= 6), // Left
						(boundingBox.height - relClickY <= 6), // Bottom
						(relClickX <= 6) // Right
					]
				
					// If the user Clicked on the Left or Right Edge
					if (grabPos[1] || grabPos[3]) { event.target.classList.add("resizeX") }
					// If the user Clicked on the Top or Bottom Edge
					if (grabPos[0] || grabPos[2]) { event.target.classList.add("resizeY") }
				
					// If the user clicked on the Top-Right or the Bottom-Left
					if (grabPos[0] && grabPos[3] || grabPos[1] && grabPos[2]) { event.target.classList.add("resizeXY1") }
					// If the user clicked on the Top-Left or the Bottom-Right
					else if (grabPos[0] && grabPos[1] || grabPos[2] && grabPos[3]) { event.target.classList.add("resizeXY2") }
				
					// Set the Resizing Target and emit the Event
					resizingWindow = event.target
					WINDOW_RESIZE.emit(getWindowInfo(resizingWindow))
				}
			},
			resizeWindow(moveEvent) {
				// Interprets where a user clicked and runs the appropriate rescaling of a Window
				if (!resizingWindow) return
			
				// Get the Resizing Window Boundry Box
				const boundingBox = windowsBoundryBoxes.get(resizingWindow)
			
				if (grabPos[0] && grabPos[3]) { // Top Right corner special treatment
					resizingWindow.style.transform = `translate(${boundingBox.x + moveEvent.x - clickOffsets[0]}px,${boundingBox.y + moveEvent.y - clickOffsets[1]}px)`
					resizingWindow.style.height = `${boundingBox.height - moveEvent.y + clickOffsets[1]}px`
					resizingWindow.style.width = `${boundingBox.width - moveEvent.x + clickOffsets[0]}px`
					return
				}
			
				if (grabPos[0]) {
					resizingWindow.style.transform = `translate(${boundingBox.x}px,${boundingBox.y + moveEvent.y - clickOffsets[1]}px)`
					resizingWindow.style.height = `${boundingBox.height - moveEvent.y + clickOffsets[1]}px`
				} else if (grabPos[2]) { resizingWindow.style.height = `${boundingBox.height + moveEvent.y - clickOffsets[1]}px` }
			
				if (grabPos[3]) {
					resizingWindow.style.transform = `translate(${boundingBox.x + moveEvent.x - clickOffsets[0]}px,${boundingBox.y}px)`
					resizingWindow.style.width = `${boundingBox.width - moveEvent.x + clickOffsets[0]}px`
				} else if (grabPos[1]) { resizingWindow.style.width = `${boundingBox.width + moveEvent.x - clickOffsets[0]}px` }
			},
			appWindowResizeEnd(event) {
				// Handles the End of a Window Resizing
				if (!resizingWindow) return

				// Reset User Grab Position
				grabPos = [ false, false, false, false ]

				// Remove Classes
				resizingWindow.classList.remove("resizeY")
				resizingWindow.classList.remove("resizeX")
				resizingWindow.classList.remove("resizeXY1")
				resizingWindow.classList.remove("resizeXY2")

				// Emit the Resize End Event and remove the resize Target
				WINDOW_RESIZE_END.emit(getWindowInfo(resizingWindow))
				resizingWindow = null
			}
		}
	}
	constructor() {
		Utilities.events.LAUNCHER_CLICK.on([this.actions.basic.openWindow.bind(this)])
		Utilities.events.WINDOW_OPEN.on([this.actions.move.centerNewWindow])
		// Utilities.events.WINDOW_CLOSE.on([shiftWindowFocus])

		this.actions.move.updatePositionBasedOnViewportCollision.bind(this).onEvent(
			Utilities.events.WINDOW_RESIZE_END,
			Utilities.events.WINDOW_MOVE_END
		)

		this.actions.basic.focusWindow.bind(this).onEvent(
			Utilities.events.WINDOW_RESIZE,
			Utilities.events.WINDOW_MOVE,
			Utilities.events.WINDOW_OPEN
		)

		document.addEventListener("mousemove", moveWindow)
		document.addEventListener("mousemove", resizeWindow)

		document.addEventListener("mouseup", appWindowMovementEnd)
		document.addEventListener("mouseup", appWindowResizeEnd)

		window.addEventListener("resize", checkAllViewportCollisions)
	}
}

const AppDockManager = new class {

}

const UIManager = new class {

}