// Window proprieties inside utilities replacing window boundry boxes and window dock icon map
// Backend compilation of index launchers
//

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
	// Time
	time = {
		// Get the client start time
		init: null,
		// Clock
		seconds: 0,
		minutes: 0,
		hours: 0,
		// Date
		day: 0,
		month: 0,
		year: 0,
		// Adds 1 second to the clock every second
		progress() {
			// Add a second
			Utilities.time.seconds++

			// If the seconds hit 60
			if (Utilities.time.seconds >= 60) {
				// Set them to 0 and add a minute
				Utilities.time.seconds = 0
				Utilities.time.minutes++

				// Send the event
				Utilities.events.CLOCK_UPDATE.emit({ target: ["seconds", "minutes"] })
			} else { Utilities.events.CLOCK_UPDATE.emit({ target: ["seconds"] }) }

			// If the minutes hit 60
			if (Utilities.time.minutes >= 60) {
				// Set them to 0 and add an hour
				Utilities.time.minutes = 0
				Utilities.time.hours++

				// Send the event
				Utilities.events.CLOCK_UPDATE.emit({ target: ["minutes", "hours"] })
			}

			// If the hours hit 24
			if (Utilities.time.hours >= 24) {
				// Set them to 0 and add a day
				Utilities.time.hours = 0
				Utilities.time.day++

				// Send the event
				Utilities.events.CLOCK_UPDATE.emit({ target: ["hours", "day"] })
			}
		}
	}
	// Simplifies IndexDB interactions
	webdeskDB = {
		// Helper for the main functions for interacting with the database
		async _run(tableName, mode, callback) {
			// Wait for no operations on the Database
			await Utilities.webdeskDB.updateLock
		
			// Get the newest connection for the Database
			const database = await Utilities.webdeskDB.ready
		
			// Return undefined if trying to access a table that doesn't exist
			if (!database.objectStoreNames.contains(tableName)) { return undefined }
		
			return new Promise((resolve, reject) => {
				try {
					const tx = database.transaction(tableName, mode == 0 ? "readonly" : "readwrite")
					const store = tx.objectStore(tableName)
					const request = callback(store)
				
					request.onsuccess = () => resolve(request.result)
					request.onerror = () => reject(request.error)
				} catch (err) { reject(err) }
			})
		},
		// Get a key's value from a table
		get(table, key) {
			return Utilities.webdeskDB._run(table, 0, (store) => { return store.get(key) })
		},
		// Get all the values from all the keys of a table
		getAll(table) {
			return Utilities.webdeskDB._run(table, 0, (store) => { return store.getAll() })
		},
		// Set the value of a key inside a table
		set(table, key, value) {
			return Utilities.webdeskDB._run(table, 1, (store) => { return store.put(value, key) })
		},
		// Delete a key inside a table
		delete(table, key) {
			return Utilities.webdeskDB._run(table, 1, (store) => { return store.delete(key) })
		},
		async createTable(tableName) {
			// Adds new Tables into the Database
			// Wait for the old operation lock and set the new operation lock to:
			Utilities.webdeskDB.updateLock = Utilities.webdeskDB.updateLock.then(async () => {
				// Wait for the database
				const database = await Utilities.webdeskDB.ready
				
				// If table exists do nothing
				if (database.objectStoreNames.contains(tableName)) return
			
				// Close the Database
				database.close()
				console.log(`Closing Database to create table "${tableName}"`)
			
				// Block any Database operations now that it is closed
				let resolveNewDb
				Utilities.webdeskDB.ready = new Promise((resolve) => { resolveNewDb = resolve })
			
				return new Promise((resolve, reject) => {
					// Up the Database version
					const req = indexedDB.open("webdesk", ++Utilities.webdeskDB.version)
				
					// Before the Database Opens, add the new table
					req.onupgradeneeded = (event) => {
						const database = event.target.result
					
						if (!database.objectStoreNames.contains(tableName)) { database.createObjectStore(tableName) }
					}
				
					// When the Database Opens, resolve all Promises
					req.onsuccess = (event) => {
						const database = event.target.result
						database.onversionchange = () => { database.close() }
						
						localStorage.setItem("db-version", Utilities.webdeskDB.version)
					
						resolveNewDb(database)
						resolve()
					}
				
					req.onblocked = req.onerror = (event) => reject(event)
				})
			})
		
			return Utilities.webdeskDB.updateLock
		}
	}
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
	inits = {
		// Allows registering functions to multiple events
		monkeyPatch() {
			Function.prototype.onEvent = function(...eventsList) {
				eventsList.map((event) => { event.on([this]) })
				return this
			}
		},
		// Initializes the time
		time() {
			// Save the start date object
			this.time.init = new Date()

			// Set the initial values for the clock
			this.time.seconds = this.time.init.getSeconds()
			this.time.minutes = this.time.init.getMinutes()
			this.time.hours = this.time.init.getHours()

			// Set the initial values for the date
			this.time.day = this.time.init.getDate()
			this.time.month = this.time.init.getMonth() + 1
			this.time.year = this.time.init.getFullYear()

			// "Nullify" the start time offset by updating the clock every 1s and 0ms
			setTimeout(() => {
				Utilities.time.progress()
				// Set an interval to update the clock every second
				setInterval(Utilities.time.progress, 1000)
			}, 1000 - this.time.init.getMilliseconds())
		},
		// Initialize the IndexDB database
		webdeskDB() {
			// Get the last version of the database
			const dbVersion = localStorage.getItem("db-version")
			// If there is no item in local storage called "db-version", initialize
			if (dbVersion == undefined) {
				this.webdeskDB.version = 1
				localStorage.setItem("db-version", 1)
			} else { this.webdeskDB.version = parseInt(dbVersion) }
		
			// Stops any db interaction in case of db updating
			this.webdeskDB.ready = new Promise((resolve, reject) => {
				// Send the db open request
				const req = indexedDB.open("webdesk", this.webdeskDB.version)
			
				// If successfull, update the status of the database connection
				req.onsuccess = () => {
					// When adding new tables, automatically close the database
					req.result.onversionchange = () => { req.result.close() }
					resolve(req.result)
				}
			
				// On error, report it
				req.onblocked = req.onerror = (event) => reject(event)
			})
		
			// Used to not overlap operations to the Database
			this.webdeskDB.updateLock = Promise.resolve()
		},
	}
	// Utility method to get the information of a window
	getWindowInfo(webdeskWindow) {
		const windowID = webdeskWindow.getAttribute("id")
		const appName = webdeskWindow.getAttribute("app")
	
		// Return the window ID, name and element
		return { id: windowID, target: webdeskWindow, app: appName }
	}

	constructor() {
		window.utilities = this

		for (const initFunction of Object.values(this.inits)) { initFunction.bind(this)() }

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
		this.events.WINDOW_RESIZE = new this.WebdeskEvent("window_is_resizing", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_RESIZE_END = new this.WebdeskEvent("window_was_resizing", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MOVE = new this.WebdeskEvent("window_is_moving", this.events.templates.WINDOW_EVENT)
		this.events.WINDOW_MOVE_END = new this.WebdeskEvent("window_was_moving", this.events.templates.WINDOW_EVENT)

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
	// Tracks the position of every window element
	boundryBoxes = new WeakMap()
	basic = {
		// Spawns a window with all the appropriate proprieties and tracks it's position
		openWindow(details) {
			// Clone the window template
			const newWindow = WindowManager.templateElement.cloneNode(true)
			// Add the new window to the window space
			WindowManager.space.appendChild(newWindow)

			// Add the event listeners for the different window elements
			Utilities.events.WINDOW_UPDATED_FOCUS.on([() => { WindowManager.basic.updateZIndex(newWindow) }])	// When the focus is shifted, update own z index
			newWindow.addEventListener("mousedown", WindowManager.interaction.manage)	// When a click happens inside a window, manage the interaction

			newWindow.querySelector(".Close").addEventListener("click", WindowManager.basic.closeWindow)	// When clicking the close button, close the window
			newWindow.querySelector(".Minimise").addEventListener("click", WindowManager.basic.minimiseWindow)	// When clicking the minimise button, maximise the window
			newWindow.querySelector(".Maximise").addEventListener("click", WindowManager.basic.maximiseWindow)	// When clicking the maximise button, minimise the window

			// Set the window attributes
			newWindow.setAttribute("app", details.app)	// Identify the app
			newWindow.setAttribute("id", WindowManager.rollingID)	// Give the window an id for window managment
			
			// Set the icon and content window src and the app title
			newWindow.querySelector("iframe").src = `apps/${details.app}/?${WindowManager.rollingID}`
			newWindow.querySelector(".Icon").src = `apps/${details.app}/icon`
			newWindow.querySelector(".Title").innerText = details.app

			// Escalate the event (LAUNCHER_CLICKED -> WINDOW_OPEN) with the new window information
			Utilities.events.WINDOW_OPEN.emit(Utilities.getWindowInfo(newWindow))
			// Update the rolling id
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
			WindowManager.boundryBoxes.delete(targetWindow)
			
			// Removes the window
			// setTimeout(() => { targetWindow.remove() }, 100)
			targetWindow.remove()
		
			// Send the close a event
			Utilities.events.WINDOW_CLOSE.emit(Utilities.getWindowInfo(targetWindow))
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
			// Get the focused window
			const currentFocusedWindow = WindowManager.space.querySelector(".focus")
			// If the focused window isn't the target window, update the focus
			if (currentFocusedWindow != details.target) {
				(currentFocusedWindow || details.target).classList.remove("focus")
				details.target.classList.add("focus")

				Utilities.events.WINDOW_UPDATED_FOCUS.emit(details)
			}
		},
		// Updates a window z-index, runs everytime the focus shifts
		updateZIndex(targetWindow) {
			// Get the current z-index
			const zIndex = parseInt(targetWindow.style.zIndex)

			// If the window is in focus, max the z-index
			// If the z-index is greater that the min z-index, lower it
			if (targetWindow.classList.contains("focus")) { targetWindow.style.zIndex = 29 }
			else if (zIndex > 20) { targetWindow.style.zIndex = zIndex - 1 }
		},
		shiftFocus(details) {
			const targetWindow = WindowManager.space.querySelector(`[style*="z-index: 28"]`)

			if (targetWindow) {
				targetWindow.classList.add("focus")
				Utilities.events.WINDOW_UPDATED_FOCUS.emit(details)
			}
		}
	}
	interaction = {
		// Bool that explicits if the user click directly the window
		directClick: false,
		// Contains the interaction target window
		window: null,
		// Contains the click offsets inside the window
		offsets: [],
		// Saves the relevant information when the user clicks in a window
		manage(event) {
			// Save the window target
			WindowManager.interaction.window = event.target.closest(`[name="Window"]`)
			// Save the click offsets
			WindowManager.interaction.offsets = [ event.x , event.y ]

			// If the user clicked on the window element, set direct click to true
			// If the user clicked on a button, ignore
			// If the user clicked on a maximised window, ignore
			// If the user click in the window element, set direct click to false

			if (event.target.getAttribute("name") == "Window") { WindowManager.interaction.directClick = true }
			else if (event.target.tagName === "BUTTON") { return }
			else if (WindowManager.interaction.window.classList.contains("maximised")) { return }
			// If everything looks good, send an interaction event
			Utilities.events.WINDOW_INTERACTION.emit(Utilities.getWindowInfo(WindowManager.interaction.window))
		},
		// Resets the interaction information on mouseup
		reset(event) {
			WindowManager.interaction.directClick = false
			WindowManager.interaction.window = null
			WindowManager.interaction.offsets = [ ]
		}
	}
	move = {
		// Used to center a newly opened window
		centerWindow(details) {
			// Get the window bounding box
			const boundingBox = details.target.getBoundingClientRect()
			// Start tracking its position
			WindowManager.boundryBoxes.set(details.target, boundingBox)

			// Calculate the offsets to center the window in the viewport
			boundingBox.x = ( window.innerWidth - boundingBox.width ) / 2
			boundingBox.y = ( window.innerHeight - boundingBox.height ) / 2

			// Apply the transform
			details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
		},
		// Enables movement for a window when conditions are met
		// This is going to need rework for custom titlebars
		checkEnable(details) {
			// If the user didn't click the window element then it has to be the titlebar
			if (!WindowManager.interaction.directClick) {
				// Add the moving class to the window
				details.target.classList.add("moving")
				// Emit the Window Move Event
				Utilities.events.WINDOW_MOVE.emit(details)
			}
		},
		// Move a window by x (and y) pixels
		moveBy(targetWindow, x, y) {
			const boundingBox = WindowManager.boundryBoxes.get(targetWindow)
			// const transform = WindowManager.interaction.window.style.transform.substring(10).split(",")
			// const position = [ parseFloat(transform[0]), parseFloat(transform[1]) ]

			targetWindow.style.transform = `translate(${ boundingBox.x + x }px,${ boundingBox.y + y }px)`
		},
		// Moves a window to the cursor
		followCursor(event) {
			const movingWindow = WindowManager.space.querySelector(".moving")
			if (!movingWindow) { return }

			// Calculate the translate values of the move:
			// current mouse position - the click offset + the old position
			const xPos = event.x - WindowManager.interaction.offsets[0] + WindowManager.boundryBoxes.get(movingWindow).x
			const yPos = event.y - WindowManager.interaction.offsets[1] + WindowManager.boundryBoxes.get(movingWindow).y

			// Set the Translate values
			movingWindow.style.transform = `translate(${xPos}px,${yPos}px)`
		},
		// Ensures that a window is not clipped by the viewport
		updatePositionIfCollision(details) {
			// Get the target position
			const boundingBox = details.target.getBoundingClientRect()
			WindowManager.boundryBoxes.set(details.target, boundingBox)

			// If the window is beyond the right of the screen, move the window back to the edge
			// If the window is beyond the left of the screen, move the window back to the edge
			if (boundingBox.right > window.innerWidth) { boundingBox.x = (window.innerWidth - boundingBox.width) }
			else if (boundingBox.left < 0) { boundingBox.x = 0 }
		
			// If the window is beyond the bottom of the screen, move the window back to the edge
			// If the window is beyond the top of the screen, move the window back to the edge
			if (boundingBox.bottom > window.innerHeight) { boundingBox.y = (window.innerHeight - boundingBox.height) }
			else if (boundingBox.top < 0) { boundingBox.y = 0 }
			
			// Translate the window to a safe spot
			details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
		},
		// When the viewport gets resized, update all the collisions and window sizes
		checkAllViewportCollisions() {
			// Cycle all the open windows and update the position if clipping the viewport
			for (appWindow of document.getElementsByName("Window")) { updatePositionIfCollision(appWindow) }
		},
		// Handles the end of a window movement
		reset(event) {
			const movingWindow = WindowManager.space.querySelector(".moving")
			if (!movingWindow) { return }
		
			// Remove the move classes
			movingWindow.classList.remove("moving")
			
			// Emit the move end event
			Utilities.events.WINDOW_MOVE_END.emit(Utilities.getWindowInfo(movingWindow))
		}
	}
	resize = {
		// Maybe resize needs an event driven rework
		// Margin on the edges of a window for triggering the resizing
		resizeMargin: 12,
		// Saves on which edge/s the user clicked
		grabPosition: [ ],
		// Checks where the user clicked in a window and enables resizing
		checkEnable(details) {
			// If the user clicked on a window...
			if (WindowManager.interaction.directClick) {
				// Get the window positon
				const boundingBox = WindowManager.boundryBoxes.get(details.target)

				// Calculate where inside the window the click happened
				const relClickX = WindowManager.interaction.offsets[0] - boundingBox.x
				const relClickY = WindowManager.interaction.offsets[1] - boundingBox.y

					// Update the window grab position
				WindowManager.resize.grabPosition = [
					(relClickY <= WindowManager.resize.resizeMargin), // Top
					(boundingBox.width - relClickX <= WindowManager.resize.resizeMargin), // Left
					(boundingBox.height - relClickY <= WindowManager.resize.resizeMargin), // Bottom
					(relClickX <= WindowManager.resize.resizeMargin) // Right
				]

				// If the user clicked on the left or right Edge
				if (WindowManager.resize.grabPosition[1] || WindowManager.resize.grabPosition[3]) {
					details.target.classList.add("resizeX", "resizing")
				}
				// If the user clicked on the top or bottom Edge
				else if (WindowManager.resize.grabPosition[0] || WindowManager.resize.grabPosition[2]) {
					details.target.classList.add("resizeY", "resizing")
				}
				// If the user clicked on the top-right or the bottom-left
				if (WindowManager.resize.grabPosition[0] && WindowManager.resize.grabPosition[3] || WindowManager.resize.grabPosition[1] && WindowManager.resize.grabPosition[2]) {
					details.target.classList.add("resizeXY1", "resizing")
				}
				// If the user clicked on the top-left or the bottom-right
				else if (WindowManager.resize.grabPosition[0] && WindowManager.resize.grabPosition[1] || WindowManager.resize.grabPosition[2] && WindowManager.resize.grabPosition[3]) {
					details.target.classList.add("resizeXY2", "resizing")
				}

				// Send the resize event
				Utilities.events.WINDOW_RESIZE.emit(details)
			}
		},
		// Interprets where a user clicked and runs the appropriate rescaling of a Window
		// NEEDS INSANE REWORK
		resizeWindow(event) {
			const resizingWindow = WindowManager.space.querySelector(".resizing")
			if (!resizingWindow) { return }

			// Get the Resizing Window Boundry Box
			const boundingBox = WindowManager.boundryBoxes.get(WindowManager.interaction.window)
		
			// If the user clicked on the top right corner...
			if (WindowManager.resize.grabPosition[0] && WindowManager.resize.grabPosition[3]) {
				WindowManager.move.moveBy(WindowManager.interaction.window, (event.x - WindowManager.interaction.offsets[0]), (event.y - WindowManager.interaction.offsets[1]))
				WindowManager.interaction.window.style.height = `${boundingBox.height - event.y + WindowManager.interaction.offsets[1]}px`
				WindowManager.interaction.window.style.width = `${boundingBox.width - event.x + WindowManager.interaction.offsets[0]}px`
				return
			}
			
			// If the user clicked on the top edge...
			// If the user clicked on the bottom edge...
			if (WindowManager.resize.grabPosition[0]) {
				WindowManager.move.moveBy(WindowManager.interaction.window, 0, (event.y - WindowManager.interaction.offsets[1]))
				WindowManager.interaction.window.style.height = `${boundingBox.height - event.y + WindowManager.interaction.offsets[1]}px`
			} else if (WindowManager.resize.grabPosition[2]) {
				WindowManager.interaction.window.style.height = `${boundingBox.height + event.y - WindowManager.interaction.offsets[1]}px`
			}

			// If the user clicked on the left edge...
			// If the user clicked on the right edge...
			if (WindowManager.resize.grabPosition[3]) {
				WindowManager.move.moveBy(WindowManager.interaction.window, (event.x - WindowManager.interaction.offsets[0]), 0)
				WindowManager.interaction.window.style.width = `${boundingBox.width - event.x + WindowManager.interaction.offsets[0]}px`
			} else if (WindowManager.resize.grabPosition[1]) {
				WindowManager.interaction.window.style.width = `${boundingBox.width + event.x - WindowManager.interaction.offsets[0]}px`
			}
		},
		// Handles the end of a window resizing
		reset(event) {
			const resizingWindow = WindowManager.space.querySelector(".resizing")
			if (!resizingWindow) { return }

			// Reset the grab position
			WindowManager.resize.grabPosition = [ false, false, false, false ]

			// Remove resize classes
			resizingWindow.classList.remove("resizeX", "resizeY", "resizeXY1", "resizeXY2", "resizing")

			// Emit the resize end event
			Utilities.events.WINDOW_RESIZE_END.emit(Utilities.getWindowInfo(resizingWindow))
		}
	}
	constructor() {
		Utilities.events.WINDOW_OPEN.on([this.move.centerWindow.bind(this)])
		Utilities.events.LAUNCHER_CLICK.on([this.basic.openWindow.bind(this)])
		Utilities.events.WINDOW_INTERACTION.on([this.move.checkEnable.bind(this), this.resize.checkEnable.bind(this)])
		Utilities.events.WINDOW_CLOSE.on([this.basic.shiftFocus.bind(this)])

		this.move.updatePositionIfCollision.bind(this).onEvent(
			Utilities.events.WINDOW_RESIZE_END,
			Utilities.events.WINDOW_MOVE_END
		)

		this.basic.focusWindow.bind(this).onEvent(
			Utilities.events.WINDOW_RESIZE,
			Utilities.events.WINDOW_MOVE,
			Utilities.events.WINDOW_OPEN
		)

		document.addEventListener("mouseup", this.move.reset.bind(this))
		document.addEventListener("mouseup", this.resize.reset.bind(this))
		document.addEventListener("mouseup", this.interaction.reset.bind(this))

		document.addEventListener("mousemove", this.move.followCursor.bind(this))
		document.addEventListener("mousemove", this.resize.resizeWindow.bind(this))
	}
}

const AppDockManager = new class {
	// Get the App Dock Element
	element = document.querySelector(".AppDock")
	// Get the Clock of inside App Dock
	clock = this.element.querySelector(".Clock")
	// Get the Open Windows element inside App Dock
	open = this.element.querySelector(".Open")
	// Template of the Open Window Icon Element
	templateElement = Utilities.assets.querySelector(`[name="DockIcon"]`)[0]
	// Map between an Open Window and a Open Window Icon Element
	dockIconMap = new WeakMap()

	// Updates the clock (in the frontend)
	updateClockElement(details) {
		for (const piece of details.target) {
			AppDockManager.clock.querySelector(`.${piece}`).innerText = `${Utilities.time[piece]}`.padStart(2, 0)
		}
	}
	// Initialize the clock element
	initClockElement() {
		this.clock.querySelector(".seconds").innerText = `${Utilities.time.seconds}`.padStart(2, 0)
		this.clock.querySelector(".minutes").innerText = `${Utilities.time.minutes}`.padStart(2, 0)
		this.clock.querySelector(".hours").innerText = `${Utilities.time.hours}`.padStart(2, 0)

		this.clock.querySelector(".day").innerText = `${Utilities.time.day}`.padStart(2, 0)
		this.clock.querySelector(".month").innerText = `${Utilities.time.month}`.padStart(2, 0)
		this.clock.querySelector(".year").innerText = `${Utilities.time.year}`
	}
	icons = {
		// Create the icon for a newly opened window
		updateOpenWindow(details) {
			const dockIcon = assetsDockIcon.cloneNode(true)
			const appName = details.target.getAttribute("app")
			appDockOpenWindows.append(dockIcon)

			// Add the necessary event listeners
			dockIcon.addEventListener("click", focusLinkedWindow)

			// Set the values of the dock icon
			dockIcon.setAttribute("app", appName)
			dockIcon.querySelector(".Icon").src = `apps/${appName}/icon`

			// Link the new dock icon to its window
			windowDockIconMap.set(details.target, dockIcon)
		},
		// Removes an icon when the connected window is closed
		updateClosedWindow(details) {
			// Find the dock icon
			const dockIcon = windowDockIconMap.get(details.target)

			// Delete the dock icon and remove it from the Map
			dockIcon.remove()
			windowDockIconMap.delete(details.target)
		},
		// Updates an icon when the connected window is maximised
		updateMinimizedWindow(details) {
			// Update an Minimized Window Dock Icon
			const dockIcon = windowDockIconMap.get(details.target)

			// Add the class
			dockIcon.classList.add("mini")
		},
		// Focuses the window connected to a dock icon
		focusLinkedWindow(event) {
			// Shifts the Focus on the Linked Window of a Dock Icon
			const appName = event.target.closest(`[name="DockIcon"]`).getAttribute("app")
			const window = windowSpace.querySelector(`[app="${appName}"]`)

			// Removes classes for some reason
			window.classList.remove("minimized")
			window.classList.remove("maximised")
		}
	}
	constructor() {
		this.initClockElement()
		Utilities.events.CLOCK_UPDATE.on([this.updateClockElement])

		// Utilities.events.WINDOW_OPEN.on([appDockUpdateOpenWindow])
		// Utilities.events.WINDOW_CLOSE.on([appDockUpdateClosedWindow])

		// Utilities.events.WINDOW_MINIMISE.on([appDockUpdateMinimizedWindow])
		// Utilities.events.WINDOW_MINIMISE_END.on([appDockUpdateMinimizedWindow])
	}
}

const UIManager = new class {
	customID = 0
	backgroundID = 0
	backgroundWrapper = document.querySelector(".Background")

	behaviors = {
		windows: {
			moveSmoothing: null,
			resizeSmoothing: null,
			maximizeSmoothing: null,
			minimizeSmoothing: null,
			closeSmoothing: null,
		},
		launchers: { },
		appdock: {
			autoHide: {
				enabled: null,
				upTime: null,
				upDelay: null,
				downDelay: null,
			},

			hideOnMaximisedWindow: {
				enabled: null,
				upTime: null,
				upDelay: null,
				downDelay: null,
			}
		}
	}

	windows = {
		color: {
			background: "#D8DEE9",
			border: "#4C566A",
			title: "#2E3440",
			dots: "#2E3440",

			buttons: {
				"close": "#D08770",
				"maxi": "#EBCB8B",
				"mini": "#A3BE8C",
			},

			focus: {
				background: "#ECEFF4",
				border: "#2E3440",
				title: "#2E3440",
				dots: "#3B4252",

				buttons: {
					"close": "#D08770",
					"maxi": "#EBCB8B",
					"mini": "#A3BE8C",
				},
			},
		},
		appearance: {
			background: {
				width: null,
				height: null
			},
			titlebar: null,
			border: null,
			title: null,
			icon: null,
			dots: null,

			buttons: {
				close: null,
				maxi: null,
				mini: null,
			},
		}
	}

	launchers = {
		color: {
			text: "#2E3440",
		},
		appearance: {
			text: null
		}
	}

	appdock = {
		color: {
			background: "#4C566A",
			border: "#434C5E",
			text: "#D8DEE9",

			icons: {
				background: "transparent",
			
				focus: {
					background: "transparent",
				},
			
				mini: {
					background: "transparent",
				},
			
				maxi: {
					background: "transparent",
				},
			},
		},
		appearance: {
			border: {
				width: "none",
				style: "solid",
			}
		}
	}
	// Sets up themes in the database
	async firstTimeInit() {
		const theme = {
			windows: this.windows,
			appdock: this.appdock,
			launchers: this.launchers,
			behaviors: this.behaviors
		}

		localStorage.setItem("customization-id", 0)
		localStorage.setItem("backgrounds-id", 0)

		await Utilities.webdeskDB.createTable("_backgrounds")
		await Utilities.webdeskDB.set("_backgrounds", 0, `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="cool"><feTurbulence baseFrequency='0.01' numOctaves="1" result='noise' filterRes="1000"/><feDiffuseLighting in='noise' lighting-color='var(#D8DEE9)' surfaceScale='6'><feDistantLight azimuth='45' elevation='60' /></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#cool)" /></svg>`)

		await Utilities.webdeskDB.createTable("_customizations")
		await Utilities.webdeskDB.set("_customizations", 0, theme)
	}
	// Converts the color proprieties of a theme into css variables
	loadCssVars(root, prefix = "") {
		for (const key of Object.keys(root)) {
			if (root[key] instanceof Object) { this.loadCssVars(root[key], `${prefix ? prefix + "-" : ""}${key}`) }
			else { document.documentElement.style.setProperty(`--${prefix}-${key}`, root[key]) }
		}
	}

	constructor() { (async () => {
		this.customID = parseInt(localStorage.getItem("customization-id")) || 0
		let customization = await Utilities.webdeskDB.get("_customizations", this.customID)

		if (customization) {
			this.appdock = customization.appdock
			this.windows = customization.windows
			this.launchers = customization.launchers
			this.behaviors = customization.behaviors
		} else { await this.firstTimeInit() }

		this.loadCssVars(this.windows, "windows")
		this.loadCssVars(this.appdock, "appdock")
		this.loadCssVars(this.launchers, "launchers")

		this.backgroundID = parseInt(localStorage.getItem("background-id")) || 0
		const backgroundContents = await Utilities.webdeskDB.get("_backgrounds", this.backgroundID || 0)
		this.backgroundWrapper.innerHTML = backgroundContents
	})() }
}