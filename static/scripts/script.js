// gng this may be a mistake but let's make it a worth while one
// - Event Driven
// attributes
// classes
// methods

const Utilities = new class {
	// Assets section containg all template elements
	assets = document.querySelector(".Assets")
	// Contains all the template objects for the events
	events = {
		templates: {
			LAUNCHER_EVENT: {
				app: null
			},
			WINDOW_EVENT: {
				id: null,
				app: null,
				target: null
			},
			CLOCK_EVENT: {
				target: [ ]
			}
		}
	}
	// Get the client start time
	initTime = new Date()
	// Clock and date values
	time = {}
	// Custom webdesk event constructor
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
	// Utility method to get the information of a window
	getWindowInfo(webdeskWindow) {
		const windowID = webdeskWindow.getAttribute("id")
		const appName = webdeskWindow.getAttribute("app")
	
		// Return the window ID, name and element
		return { id: windowID, target: webdeskWindow, app: appName }
	}
	// Updates the clock every second
	updateClock() {
		Utilities.time.seconds++ // Add a second to the current time

		// If the seconds hit 60
		if (Utilities.time.seconds >= 60) {
			// Set them to 0 and add a minute
			Utilities.time.seconds = 0
			Utilities.time.minutes++

			// Send the event
			Utilities.events.CLOCK_EVENT.emit({ target: ["seconds", "minutes"] })
		} else { Utilities.events.CLOCK_EVENT.emit({ target: ["seconds"] }) }

		// If the minutes hit 60
		if (Utilities.time.minutes >= 60) {
			// Set them to 0 and add an hour
			Utilities.time.minutes = 0
			Utilities.time.hours++

			// Send the event
			Utilities.events.CLOCK_EVENT.emit({ target: ["minutes", "hours"] })
		} else { Utilities.events.CLOCK_EVENT.emit({ target: ["minutes"] }) }

		// If the hours hit 24
		if (Utilities.time.hours >= 24) {
			// Set them to 0 and add a day
			Utilities.time.hours = 0
			Utilities.time.day++

			// Send the event
			Utilities.events.CLOCK_EVENT.emit({ target: ["hours", "day"] })
		} else { Utilities.events.CLOCK_EVENT.emit({ target: ["hours"] }) }
	}

	constructor() {
		Function.prototype.onEvent = function(...eventsList) {
			console.log(eventsList)
			eventsList.map((event) => {
				event.on([this])
			})
			return this
		}

		window.utilities = this

		this.time = {
			"seconds": this.initTime.getSeconds(),
			"minutes": this.initTime.getMinutes(),
			"hours": this.initTime.getHours(),

			"day": this.initTime.getDate(),
			"month": this.initTime.getMonth() + 1,
			"year": this.initTime.getFullYear()
		}

		// "Nullifies" the start time offset
		setTimeout(() => {
			// Run once at 0 ms
			updateClock()
			// Update the clock every second
			setInterval(updateClock, 1000)
		}, 1000 - this.initTime.getMilliseconds())

		this.events.LAUNCHER_CLICK = new this.WebdeskEvent("launcher_click", this.events.templates.LAUNCHER_EVENT)

		this.events.WINDOW_OPEN = new this.WebdeskEvent("window_open", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MOVE = new this.WebdeskEvent("window_move", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_CLOSE = new this.WebdeskEvent("window_close", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_INTERACTION = new this.WebdeskEvent("window_click_within", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_UPDATED_FOCUS = new this.WebdeskEvent("window_focus_update", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MAXIMISE = new this.WebdeskEvent("window_is_maximised", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MAXIMISE_END = new this.WebdeskEvent("window_was_maximised", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MINIMISE = new this.WebdeskEvent("window_is_minimised", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MINIMISE_END = new this.WebdeskEvent("window_was_minimised", this.events.templates.WINDOW_EVENT)

		this.events.CLOCK_UPDATE = new this.WebdeskEvent("clock_updated", this.events.templates.CLOCK_EVENT)
	}
}

const LauncherManager = new class {
	// Template element for adding launchers
	templateElement = Utilities.assets.querySelector(`[name="Launcher"]`)
	// Launchers space
	space = document.querySelector(".Launcher.Space")

	// Adds an application launcher to the desktop
	addLauncher(appName) {
		const newLauncher = this.templateElement.cloneNode(true)
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
	// Rolling id for windows
	rollingID = 0
	// Template element for new windows
	templateElement = Utilities.assets.querySelector(`[name="Window"]`)
	// Space for new windows
	space = document.querySelector(".Window.Space")
	// Position Tracking map for each window element
	windowsBoundryBoxes = new WeakMap()
	actions = {
		basic: {
			// Spawns a window and sets all the appropriate proprieties also maps the newly opened window in 'windowsBoundryBoxes'
			openWindow(details) {
				// Clone the window template
				const newWindow = WindowManager.templateElement.cloneNode(true)
				// Add the new window to the window space
				WindowManager.space.appendChild(newWindow)

				// Add the event listeners for the different window elements
				Utilities.events.WINDOW_UPDATED_FOCUS.on([(newWindow) => { WindowManager.updateZIndex(newWindow) }])
				newWindow.addEventListener("mosedown", WindowManager.actions.interaction.interactionManager)
				newWindow.querySelector(".Close").addEventListener("click", WindowManager.actions.basic.closeWindow)
				newWindow.querySelector(".Minimise").addEventListener("click", WindowManager.actions.basic.minimiseWindow)
				newWindow.querySelector(".Maximise").addEventListener("click", WindowManager.actions.basic.maximiseWindow)

				// Set the window attributes
				newWindow.setAttribute("app", details.app)
				newWindow.setAttribute("id", WindowManager.rollingID)
			
				// Set the icon and content window src and the app title
				newWindow.querySelector("iframe").src = `apps/${details.app}/?${WindowManager.rollingID}`
				newWindow.querySelector(".Icon").src = `apps/${details.app}/icon`
				newWindow.querySelector(".Title").innerText = details.app

				// Escalete the event with the new window information
				Utilities.events.WINDOW_OPEN.emit(Utilities.getWindowInfo(newWindow))
				// Send an open window event
				WindowManager.rollingID++

				// DEBUG !!! !!! !!!
				if (details.app == "settings") { newWindow.querySelector(".Maximise").dispatchEvent(new Event("click")) }
				// !!! !!! !!!
			},
			// Closes a window
			closeWindow(event) {
				// Get the target window
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
				// Get the target window
				const targetWindow = event.target.closest(`[name="Window"]`)

				// If the window is maximised
				if (targetWindow.classList.contains("maximised")) {
					// Remove the maximised class and send the end maximised event
					targetWindow.classList.remove("maximised")
					Utilities.events.WINDOW_MAXIMISE_END.emit(Utilities.getWindowInfo(targetWindow))
				} else {
					// Add the maximised class and send the start maximised event
					targetWindow.classList.add("maximised")
					Utilities.events.WINDOW_MAXIMISE.emit(Utilities.getWindowInfo(targetWindow))
				}
			},
			// Handles the minimising of windows
			minimiseWindow(event) {
				// Get the target window
				const targetWindow = event.target.closest(`[name="Window"]`)

				// If the window is minimised
				if (targetWindow.classList.contains("minimized")) {
					// Remove the minimised class and send the end minimised event
					targetWindow.classList.remove("minimized")
					Utilities.events.WINDOW_MINIMISE_END.emit(Utilities.getWindowInfo(targetWindow))
				} else {
					// Add the minimised class and send the start minimised event
					targetWindow.classList.add("minimized")
					Utilities.events.WINDOW_MINIMISE.emit(Utilities.getWindowInfo(targetWindow))
				}
			},
			// Makes a window the "active" window
			focusWindow(details) {
				// Change this logic
				const currentFocusedWindow = WindowManager.space.querySelector(".focus")

				if (details.target != currentFocusedWindow) {
					// for (openAppWindow of document.getElementsByName("Window")) {
					// 	openAppWindow.classList.remove("focus")
					// 	const zIndex = parseInt(openAppWindow.style.zIndex)
					// 	if (zIndex > 20) { openAppWindow.style.zIndex = zIndex - 1 }
					// }
				
					currentFocusedWindow.classList.remove("focus")
					details.target.classList.add("focus")
				
					Utilities.events.WINDOW_UPDATED_FOCUS.emit(details)
				}
			},
			// Runs everytime the focus shifts
			updateZIndex(targetWindow) {
				// Get the current z-index
				const zIndex = parseInt(targetWindow.style.zIndex)

				// If the window is in focus, max the z-index
				// If the z-index is greater that the min z-index, lower it
				if (targetWindow.classList.contains("focus")) { targetWindow.style.zIndex = 29 }
				else if (zIndex > 20) { openAppWindow.style.zIndex = zIndex - 1 }
			}
		},
		interaction: {
			// Bool that explicits if the user click directly the window
			directClick: false,
			// Contains the interaction target window
			window: null,
			// Contains the click offsets inside the window
			clickOffsets: [],
			// Saves the relevant information when the user clicks in a window
			interactionManager(event) {
				// If the user clicked on the window element, set direct click to true
				// If the user clicked on a button, ignore
				// If the user clicked on a maximised window, ignore
				// If the user click in the window element, set direct click to false
				if (event.target.getAttribute("name") == "Window") { WindowManager.actions.interaction.directClick = true }
				else if (event.target.tagName === "BUTTON") { return }
				else if (targetWindow.classList.contains("maximised")) { return }
				else { WindowManager.actions.interaction.directClick = false }

				// Save the window target
				WindowManager.actions.interaction.window = event.target.closest(`[name="Window"]`)
				// Save the click offsets
				WindowManager.actions.interaction.clickOffsets = [ event.x , event.y ]

				// Send the interaction event
				Utilities.events.WINDOW_INTERACTION.emit(Utilities.getWindowInfo(WindowManager.actions.interaction.window))
			}
		},
		move: {
			// Used to center a newly opened window
			centerWindow(details) {
				// Get the window bounding box
				const boundingBox = details.target.getBoundingClientRect()
				// Start tracking its position
				windowsBoundryBoxes.set(details.target, boundingBox)

				// Calculate the offsets to center the window in the viewport
				boundingBox.x = ( window.innerWidth - boundingBox.width ) / 2
				boundingBox.y = ( window.innerHeight - boundingBox.height ) / 2

				// Apply the transform
				details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
			},
			// Checks if a window for movement
			// This is going to need rework for custom titlebars
			checkEnable(details) {
				// If the user didn't click the window element, it HAD to click the titlebar
				if (!WindowManager.actions.interaction.directClick) {
					// Add the moving class to the window
					details.target.classList.add("moving")
					// Emit the Window Move Event
					Utilities.events.WINDOW_MOVE.emit(details)
				}
			},
			// Move a window
			moveBy(xMovement, yMovement) {
				const position = [ 0, 0 ]
				const transform = WindowManager.actions.interaction.window.style.transform
				const transformPosition = transform.substring(9)

				console.log(transformPosition.split(","))
			},
			// Moves a window using transform
			followCursor(moveEvent) {
				if (!movingWindow) return
			
				// Calculate the translate values of the move:
				// current mouse position - the click offset + the old position
				const xPos = moveEvent.x - clickOffsets[0] + windowsBoundryBoxes.get(movingWindow).x
				const yPos = moveEvent.y - clickOffsets[1] + windowsBoundryBoxes.get(movingWindow).y
			
				// Set the Translate values
				movingWindow.style.transform = `translate(${xPos}px,${yPos}px)`
			},
			// Ensures that the window is not clipped by the viewport
			updatePositionIfCollision(details) {
				// Get the target position
				const boundingBox = details.target.getBoundingClientRect()

				// If the window is beyond the right of the screen, move the window back to the edge
				// If the window is beyond the left of the screen, move the window back to the edge
				if (boundingBox.right > window.innerWidth) { boundingBox.x = (window.innerWidth - boundingBox.width) }
				else if (boundingBox.left < 0) { boundingBox.x = 0 }
			
				// If the window is beyond the bottom of the screen, move the window back to the edge
				// If the window is beyond the top of the screen, move the window back to the edge
				if (boundingBox.bottom > window.innerHeight) { boundingBox.y = (window.innerHeight - boundingBox.height) }
				else if (boundingBox.top < 0) { boundingBox.y = 0 }
			
				// Update the Window Translate values and Boundry Box
				details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
				windowsBoundryBoxes.set(details.target, boundingBox)
			},
			// When the viewport gets resized, update all the collisions and window sizes
			checkAllViewportCollisions() {
				// Cycle all the open windows and update the position if clipping the viewport
				for (appWindow of document.getElementsByName("Window")) { updatePositionIfCollision(appWindow) }
			},
			// Handles the end of a window movement
			movementEnd() {
				if (!movingWindow) return
			
				// Remove Classes
				movingWindow.classList.remove("moving")
			
				// Emit the Move End Event and remove the move Target
				WINDOW_MOVE_END.emit(getWindowInfo(movingWindow))
				movingWindow = null
			}
		},
		resize: {
			// Maybe resize needs an event driven rework
			// Margin on the edges of a window for triggering the resizing
			resizeMargin: 6,
			// Saves on which edge/s the user clicked
			grabPosition: [ ],
			// Explicits if a resizing is happening
			resizing: false,
			// Checks where the user clicked in a window and enables resizing
			checkEnable(details) {
				// If the user clicked on a window...
				if (WindowManager.actions.interaction.directClick) {
					// Get the window positon
					const boundingBox = windowsBoundryBoxes.get(details.target)

					// Calculate where inside the window the click happened
					const relClickX = WindowManager.actions.interaction.clickOffsets[0] - boundingBox.x
					const relClickY = WindowManager.actions.interaction.clickOffsets[1] - boundingBox.y

					// Update the window grab position
					WindowManager.actions.resize.grabPosition = [
						(relClickY <= resizeMargin), // Top
						(boundingBox.width - relClickX <= resizeMargin), // Left
						(boundingBox.height - relClickY <= resizeMargin), // Bottom
						(relClickX <= resizeMargin) // Right
					]

					// If the user clicked on the left or right Edge
					if (WindowManager.actions.resize.grabPosition[1] || WindowManager.actions.resize.grabPosition[3]) {
						details.target.classList.add("resizeX")
					}
					// If the user clicked on the top or bottom Edge
					else if (WindowManager.actions.resize.grabPosition[0] || WindowManager.actions.resize.grabPosition[2]) {
						details.target.classList.add("resizeY")
					}
					// If the user clicked on the top-right or the bottom-left
					if (WindowManager.actions.resize.grabPosition[0] && WindowManager.actions.resize.grabPosition[3] || WindowManager.actions.resize.grabPosition[1] && WindowManager.actions.resize.grabPosition[2]) {
						details.target.classList.add("resizeXY1")
					}
					// If the user clicked on the top-left or the bottom-right
					else if (WindowManager.actions.resize.grabPosition[0] && WindowManager.actions.resize.grabPosition[1] || WindowManager.actions.resize.grabPosition[2] && WindowManager.actions.resize.grabPosition[3]) {
						details.target.classList.add("resizeXY2")
					}

					// Add the resizing class to the target
					details.target.classList.add("resizing")
					// Send the resize event
					WINDOW_RESIZE.emit(details)
				}
			},
			// Interprets where a user clicked and runs the appropriate rescaling of a Window
			// NEEDS INSANE REWORK
			resizeWindow(event) {
				if (!WindowManager.actions.resize.resizing) { return }

				// Get the Resizing Window Boundry Box
				const boundingBox = windowsBoundryBoxes.get(WindowManager.actions.interaction.window)
			
				// If the user clicked on the top right corner...
				if (WindowManager.actions.resize.grabPosition[0] && WindowManager.actions.resize.grabPosition[3]) {
					WindowManager.actions.interaction.window.style.transform = `translate(${boundingBox.x + moveEvent.x - clickOffsets[0]}px,${boundingBox.y + moveEvent.y - clickOffsets[1]}px)`
					// need to make a move function
					WindowManager.actions.interaction.window.style.height = `${boundingBox.height - moveEvent.y + clickOffsets[1]}px`
					WindowManager.actions.interaction.window.style.width = `${boundingBox.width - moveEvent.x + clickOffsets[0]}px`
					return
				}
			
				// If the user clicked on the top edge...
				// If the user clicked on the bottom edge...
				if (WindowManager.actions.resize.grabPosition[0]) {
					WindowManager.actions.interaction.window.style.transform = `translate(${boundingBox.x}px,${boundingBox.y + moveEvent.y - clickOffsets[1]}px)`
					WindowManager.actions.move.moveBy()
					WindowManager.actions.interaction.window.style.height = `${boundingBox.height - moveEvent.y + clickOffsets[1]}px`
				} else if (WindowManager.actions.resize.grabPosition[2]) {
					WindowManager.actions.interaction.window.style.height = `${boundingBox.height + moveEvent.y - clickOffsets[1]}px`
				}

				// If the user clicked on the left edge...
				// If the user clicked on the right edge...
				if (WindowManager.actions.resize.grabPosition[3]) {
					WindowManager.actions.interaction.window.style.transform = `translate(${boundingBox.x + moveEvent.x - clickOffsets[0]}px,${boundingBox.y}px)`
					WindowManager.actions.interaction.window.style.width = `${boundingBox.width - moveEvent.x + clickOffsets[0]}px`
				} else if (WindowManager.actions.resize.grabPosition[1]) {
					WindowManager.actions.interaction.window.style.width = `${boundingBox.width + moveEvent.x - clickOffsets[0]}px`
				}
			},
			// Handles the End of a Window Resizing
			resizeEnd(event) {
				if (!WindowManager.actions.resize.resizing) return

				// Reset User Grab Position
				WindowManager.actions.resize.grabPosition = [ false, false, false, false ]

				// Remove Classes
				WindowManager.actions.interaction.window.classList.remove("resizeY")
				WindowManager.actions.interaction.window.classList.remove("resizeX")
				WindowManager.actions.interaction.window.classList.remove("resizeXY1")
				WindowManager.actions.interaction.window.classList.remove("resizeXY2")

				// Emit the Resize End Event and remove the resize Target
				WINDOW_RESIZE_END.emit(getWindowInfo(WindowManager.actions.interaction.window))
				WindowManager.actions.interaction.window = null
			}
		}
	}
	constructor() {
		Utilities.events.WINDOW_OPEN.on([this.actions.move.centerWindow.bind(this)])
		Utilities.events.LAUNCHER_CLICK.on([this.actions.basic.openWindow.bind(this)])
		Utilities.events.WINDOW_INTERACTION.on([this.actions.move.checkEnable.bind(this), this.actions.resize.checkEnable.bind(this)])
		// Utilities.events.WINDOW_CLOSE.on([shiftWindowFocus])

		console.log(Utilities.events.WINDOW_RESIZE_END)
		this.actions.move.updatePositionIfCollision.bind(this).onEvent(
			Utilities.events.WINDOW_RESIZE_END,
			Utilities.events.WINDOW_MOVE_END
		)

		this.actions.basic.focusWindow.bind(this).onEvent(
			Utilities.events.WINDOW_RESIZE,
			Utilities.events.WINDOW_MOVE,
			Utilities.events.WINDOW_OPEN
		)

		document.addEventListener("mousemove", this.actions.move.followCursor.bind(this))
		document.addEventListener("mousemove", this.actions.resize.resizeWindow.bind(this))

		document.addEventListener("mouseup", this.actions.move.movementEnd.bind(this))
		document.addEventListener("mouseup", this.actions.resize.resizeEnd.bind(this))

		// window.addEventListener("resize", this.actions.resize.resizeWindow.bind(this))
	}
}

const AppDockManager = new class {
	// Get the App Dock Element
	element = document.querySelector(".AppDock")
	// Get the Clock of inside App Dock
	clock = appDock.querySelector(".Clock")
	// Get the Open Windows element inside App Dock
	open = appDock.querySelector(".Open")
	// Template of the Open Window Icon Element
	dockIcon = Utilities.assets.getElementsByName("DockIcon")[0]
	// Map between an Open Window and a Open Window Icon Element
	dockIconMap = new WeakMap()

	updateClock() {
		// Runs every second, updating the Clock in the frontend
		clockTime[0]++ // Add a second to the current time

		// If the seconds hit 60
		if (clockTime[0] >= 60) {
			// Set them to 0 and add a minute
			clockTime[0] = 0
			clockTime[1]++

			// Update Seconds and Minutes
			appDockClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0)
			appDockClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
		} else { appDockClock.querySelector(".Seconds").innerText = `${clockTime[0]}`.padStart(2, 0) }

		// If the minutes hit 60
		if (clockTime[1] >= 60) {
			// Set them to 0 and add an hour
			clockTime[1] = 0
			clockTime[2]++

			// Update Minutes and Hours
			appDockClock.querySelector(".Minutes").innerText = `${clockTime[1]}`.padStart(2, 0)
			appDockClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)
		}

		// If the hours hit 24
		if (clockTime[2] >= 24) {
			// Set them to 0 and add a day
			clockTime[2] = 0
			clockTime[3]++

			// Update the Hours and Days
			appDockClock.querySelector(".Hours").innerText = `${clockTime[2]}`.padStart(2, 0)
			appDockClock.querySelector(".Day").innerText = `${clockTime[3]}`.padStart(2, 0)
		}
	}

	appDockUpdateOpenWindow(details) {
		// Spawn a Newly Opened Window's Dock Icon
		const dockIcon = assetsDockIcon.cloneNode(true)
		const appName = details.target.getAttribute("app")
		appDockOpenWindows.append(dockIcon)

		// Add the necessary event listeners
		dockIcon.addEventListener("click", focusLinkedWindow)

		// Set the values of the Dock Icon
		dockIcon.setAttribute("app", appName)
		dockIcon.querySelector(".Icon").src = `apps/${appName}/icon`

		// Link the new Dock Icon to its Window
		windowDockIconMap.set(details.target, dockIcon)
	}

	appDockUpdateClosedWindow(details) {
		// Delete a Just Closed Window's Dock Icon
		const dockIcon = windowDockIconMap.get(details.target)

		// Delete the Dock Icon and remove it from the Map
		dockIcon.remove()
		windowDockIconMap.delete(details.target)
	}

	appDockUpdateMinimizedWindow(details) {
		// Update an Minimized Window Dock Icon
		const dockIcon = windowDockIconMap.get(details.target)

		// Add the class
		dockIcon.classList.add("mini")
	}

	focusLinkedWindow(event) {
		// Shifts the Focus on the Linked Window of a Dock Icon
		const appName = event.target.closest(`[name="DockIcon"]`).getAttribute("app")
		const window = windowSpace.querySelector(`[app="${appName}"]`)

		// Removes classes for some reason
		window.classList.remove("minimized")
		window.classList.remove("maximised")
	}
	constructor() {
		initClock()

		WINDOW_OPEN.on([appDockUpdateOpenWindow])
		WINDOW_CLOSE.on([appDockUpdateClosedWindow])

		WINDOW_MINIMISE.on([appDockUpdateMinimizedWindow])
		WINDOW_MINIMISE_END.on([appDockUpdateMinimizedWindow])
	}
}

const UIManager = new class {

}