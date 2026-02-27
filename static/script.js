/// <reference lib="dom" />

// Window proprieties inside utilities replacing window boundry boxes and window dock icon map
// Customization for the Titlebar compiler's event listeners and callback functions

var newUser = false

const Utilities = new class {
	// App manifests
	manifests
	// Contains all the template objects for the events
	events = {
		templates: {
			LAUNCHER_EVENT: {
				app: null,
			},
			WINDOW_READY_EVENT: {
				element: null,
				titlebar: null,
				iframe: null,
			},
			WINDOW_OPEN_EVENT: {
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
			// Track what changed to smartly update the elements
			const changed = [ "seconds" ]
			// Add a second
			Utilities.time.seconds++

			// If the seconds hit 60
			if (Utilities.time.seconds >= 60) {
				// Set them to 0 and add a minute
				Utilities.time.seconds = 0
				Utilities.time.minutes++

				// Track the change for the event
				changed.push("minutes")
			}

			// If the minutes hit 60
			if (Utilities.time.minutes >= 60) {
				// Set them to 0 and add an hour
				Utilities.time.minutes = 0
				Utilities.time.hours++

				// Track the change for the event
				changed.push("hours")
			}

			// If the hours hit 24
			if (Utilities.time.hours >= 24) {
				// Set them to 0 and add a day
				Utilities.time.hours = 0
				Utilities.time.day++

				// Track the change for the event
				changed.push("day")
			}

			// Send the event
			Utilities.events.CLOCK_UPDATE.emit({ target: changed })
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
				if (database.objectStoreNames.contains(tableName)) { return }
			
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
		// Binds multiple functions to a webdesk event
		on(callBackFunctions = [], oneTime = false) {
			// For every function passed
			callBackFunctions.map((callBackFunction) => {
				// Add an event listener for the event
				window.addEventListener(this.name, (event) => { callBackFunction(event.detail) }, { once: oneTime })
			})
		}
	}
	inits = {
		// Allows registering functions to multiple events
		monkeyPatch() {
			// Binds a function to multiple webdesk events
			Function.prototype.onEvent = function(...eventsList) {
				// For every event passed, register the function to it
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

			// "Nullify" the start time offset by updating the clock every 1.000s
			setTimeout(() => {
				// Progress the time by 1 second
				Utilities.time.progress()
				// Set an interval to progress the clock every second
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
				newUser = true
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
		// Fetches all the application manifests
		// TODO: Auto cache manifests to service woerker level(?)
		apps() {
			fetch("/api/_/manifest").then(async (response) => {
				this.manifests = await response.json()
				Utilities.events.MANIFESTS_READY.emit(this.manifests)
			})
		}
	}
	// Utility method to get the information of a window
	getWindowInfo(webdeskWindow) {
		return { id: webdeskWindow.getAttribute("id"), target: webdeskWindow, app: webdeskWindow.getAttribute("app") }
	}

	constructor() {
		window.utilities = this

		for (const initFunction of Object.values(this.inits)) { initFunction.bind(this)() }

		this.events.MANIFESTS_READY = new this.WebdeskEvent("manifests_fetched", this.manifests)

		this.events.LAUNCHER_CLICK = new this.WebdeskEvent("launcher_click", this.events.templates.LAUNCHER_EVENT)

		this.events.WINDOW_READY = new this.WebdeskEvent("window_ready", this.events.templates.WINDOW_READY_EVENT)

		this.events.WINDOW_OPEN = new this.WebdeskEvent("window_open", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_MOVE = new this.WebdeskEvent("window_move", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_CLOSE = new this.WebdeskEvent("window_close", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_INTERACTION = new this.WebdeskEvent("window_click_within", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_UPDATED_FOCUS = new this.WebdeskEvent("window_focus_update", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_MAXIMISE = new this.WebdeskEvent("window_is_maximised", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_MAXIMISE_END = new this.WebdeskEvent("window_was_maximised", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_MINIMISE = new this.WebdeskEvent("window_is_minimised", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_MINIMISE_END = new this.WebdeskEvent("window_was_minimised", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_RESIZE = new this.WebdeskEvent("window_is_resizing", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_RESIZE_END = new this.WebdeskEvent("window_was_resizing", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_MOVE = new this.WebdeskEvent("window_is_moving", this.events.templates.WINDOW_OPEN_EVENT)
		this.events.WINDOW_MOVE_END = new this.WebdeskEvent("window_was_moving", this.events.templates.WINDOW_OPEN_EVENT)

		this.events.CLOCK_UPDATE = new this.WebdeskEvent("clock_updated", this.events.templates.CLOCK_EVENT)
	}
}

const LauncherManager = new class {
	// Launchers space
	space = document.querySelector(".Launcher.Space")

	// Adds an app launcher to the desktop
	addLauncher(appName, manifest) {
		// Create the new launcher element
		const launcher = document.createElement("button")
		// Create the name element
		const title = document.createElement("span")
		// Create the icon element
		const icon = document.createElement("img")

		// Set the app the launcher opens
		launcher.setAttribute("launcher", appName)
		// Set the hover description of the launcher
		launcher.setAttribute("title", manifest.description == "undefined" ? appName : manifest.description)

		// Add the name element class
		title.classList.add("name")
		// Set the launcher name
		title.innerText = appName

		// Add the icon element class
		icon.classList.add("icon")
		// Set the launcher icon
		icon.src = `/apps/${appName}/${manifest.icon}`

		// Add the name and icon to the launcher
		launcher.append(icon, title)
		// Add the new launcher to the desktop
		this.space.appendChild(launcher)

		// When clicked, dispatch the LAUNCHER_CLICK event
		launcher.addEventListener("click", () => { Utilities.events.LAUNCHER_CLICK.emit({app: appName}) })
	}
	// Adds every installed app launcher once the manifests load
	initLaunchers(details) {
		// Sort the keys to have the same app order every visit
		for (const appName of Object.keys(details).sort()) {
			LauncherManager.addLauncher(appName, details[appName])
		}
	}

	constructor() {
		Utilities.events.MANIFESTS_READY.on([this.initLaunchers])
	}
}

const WindowManager = new class {
	// Space for new windows
	space = document.querySelector(".Window.Space")
	// Tracks the position of every window element
	boundryBoxes = new WeakMap()
	create = {
		// Assembles a webdesk window
		async skeletonizeWindow(details, emit = true) {
			// Contains the application manifest
			const appManifest = Utilities.manifests[details.app]

			// Make the wrapping element for the window
			const windowSkeleton = document.createElement("article")
			// Make the iframe wrapper element
			const contentWrapper = document.createElement("section")
			// Make the titlebar element
			const titlebarWrapper = document.createElement("header")
			// Make the app content iframe
			const content = document.createElement("iframe")
			// 创建标题栏 iframe
			const titlebar = document.createElement("iframe")

			// Fix the aesthetic of the iframes
			content.setAttribute("frameborder", 0)
			titlebar.setAttribute("frameborder", 0)

			content.src = `/apps/${details.app}/${appManifest.index}`

			if (appManifest.titlebar.path != "") { titlebar.src = `/apps/${details.app}/${appManifest.titlebar.path}` }
			else { titlebar.src = `/api/_/titlebar` }

			if (appManifest.titlebar.dynamic) {
				titlebar.addEventListener("load", () => {
					const title = titlebar.querySelector(".title")
					if (title) { title.innerText = content.document.title } 
				})
			}

			// Wrap the iframes
			contentWrapper.append(content)
			titlebarWrapper.append(titlebar)

			// Add the iframes classes
			content.classList.add("content")
			titlebar.classList.add("titlebar")

			// Nest the titlebar and content wrapper in the window
			windowSkeleton.append(titlebarWrapper, contentWrapper)

			// Add the event listeners for the different window elements
			Utilities.events.WINDOW_UPDATED_FOCUS.on([() => { WindowManager.basic.updateZIndex(windowSkeleton) }])	// When the focus is shifted, update own z index
			windowSkeleton.addEventListener("mousedown", WindowManager.interaction.manage)	// When a click happens inside a window, manage the interaction

			// Set the app name
			windowSkeleton.setAttribute("app", details.app)

			// Add the window to the window space
			WindowManager.space.appendChild(windowSkeleton)

			// Dispatch the event
			// TODO: make sure it works for the intro window
			if (emit) { Utilities.events.WINDOW_OPEN.emit({ app: details.app, target: windowSkeleton }) }
			else { return windowSkeleton }
		},
	}
	basic = {
		// Closes a window
		closeWindow(event) {
			// Get the target window
			const targetWindow = event.target.closest("[app]")
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
			const targetWindow = event.target.closest("[app]")
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
			const targetWindow = event.target.closest("[app]")
			// Remove the maximised class
			targetWindow.classList.remove("maximised")
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
				// Hack when there is only one window open and it needs the focus
				(currentFocusedWindow || details.target).classList.remove("focus")
				// Add focus class
				details.target.classList.add("focus")
				// Emit focus update event
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
		// When a window is closed, ensure there is one in focus
		shiftFocus(details) {
			// If there is a window in focus, ignore the event call
			if (WindowManager.space.querySelector(".focus")) { return }

			// Target the window with z-index to 28
			const targetWindow = WindowManager.space.querySelector(`[style*="z-index: 28"]`)

			// If there is a window, focus it
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
			WindowManager.interaction.window = event.target.closest("[app]")
			// Save the click offsets
			WindowManager.interaction.offsets = [ event.x , event.y ]

			// If the user clicked on the window element, set direct click to true
			// If the user clicked on a button, ignore
			// If the user clicked on a maximised window, ignore
			if (event.target.getAttribute("app")) { WindowManager.interaction.directClick = true }
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
				// Emit the window move event
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
			// current mouse position - the click offset + the old position (before starting the movement)
			const xPos = event.x - WindowManager.interaction.offsets[0] + WindowManager.boundryBoxes.get(movingWindow).x
			const yPos = event.y - WindowManager.interaction.offsets[1] + WindowManager.boundryBoxes.get(movingWindow).y

			// Set the Translate values
			movingWindow.style.transform = `translate(${xPos}px,${yPos}px)`
		},
		// Ensures that a window is not clipped by the viewport
		updatePositionIfCollision(details) {
			// Get the target position
			const boundingBox = details.target.getBoundingClientRect()
			// Link by reference the window box
			WindowManager.boundryBoxes.set(details.target, boundingBox)

			// If the window is beyond the right of the screen, move the window back to the edge
			if (boundingBox.right > window.innerWidth) { boundingBox.x = (window.innerWidth - boundingBox.width) }
			// If the window is beyond the left of the screen, move the window back to the edge
			else if (boundingBox.left < 0) { boundingBox.x = 0 }
			// If the window is beyond the bottom of the screen, move the window back to the edge
			if (boundingBox.bottom > window.innerHeight) { boundingBox.y = (window.innerHeight - boundingBox.height) }
			// If the window is beyond the top of the screen, move the window back to the edge
			else if (boundingBox.top < 0) { boundingBox.y = 0 }

			// Translate the window to a safe spot
			details.target.style.transform = `translate(${boundingBox.x}px,${boundingBox.y}px)`
		},
		// When the viewport gets resized, update all the collisions and window sizes
		checkAllViewportCollisions() {
			// For all open windows, update the position if clipping the resized viewport
			for (const openWindow of document.querySelectorAll("[app]")) { updatePositionIfCollision(openWindow) }
		},
		// Handles the end of a window movement
		reset(event) {
			// Get the current moving window
			const movingWindow = WindowManager.space.querySelector(".moving")
			// If there is no moving window, ignore the mouse up event
			if (!movingWindow) { return }
			// Remove the move classes
			movingWindow.classList.remove("moving")
			// Emit the move end event
			Utilities.events.WINDOW_MOVE_END.emit(Utilities.getWindowInfo(movingWindow))
		}
	}
	resize = {
		// Margin on the edges of a window for triggering the resizing
		resizeMargin: 12,
		// Saves on which edge/s the user clicked
		grabPosition: [ ],
		// Checks where the user clicked in a window and enables resizing
		checkEnable(details) {
			// If the user clicked on a window
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

				// If the user clicked on the left or right edge
				if (WindowManager.resize.grabPosition[1] || WindowManager.resize.grabPosition[3]) {
					details.target.classList.add("resizeX", "resizing")
				}
				// If the user clicked on the top or bottom edge
				else if (WindowManager.resize.grabPosition[0] || WindowManager.resize.grabPosition[2]) {
					details.target.classList.add("resizeY", "resizing")
				}
				// If the user clicked on the top-right or the bottom-left corners
				if (WindowManager.resize.grabPosition[0] && WindowManager.resize.grabPosition[3] || WindowManager.resize.grabPosition[1] && WindowManager.resize.grabPosition[2]) {
					details.target.classList.add("resizeXY1", "resizing")
				}
				// If the user clicked on the top-left or the bottom-right corners
				else if (WindowManager.resize.grabPosition[0] && WindowManager.resize.grabPosition[1] || WindowManager.resize.grabPosition[2] && WindowManager.resize.grabPosition[3]) {
					details.target.classList.add("resizeXY2", "resizing")
				}

				// Send the resize event
				Utilities.events.WINDOW_RESIZE.emit(details)
			}
		},
		// Interprets where a user clicked and runs the appropriate rescaling of a window
		// NEEDS INSANE REWORK(?) (aint gonna happen i guess)
		resizeWindow(event) {
			// Target the current resizing window
			const resizingWindow = WindowManager.space.querySelector(".resizing")
			// If none, ignore the mouse move
			if (!resizingWindow) { return }

			// Get the current window box
			const boundingBox = WindowManager.boundryBoxes.get(WindowManager.interaction.window)
		
			// If the user clicked on the top left corner
			if (WindowManager.resize.grabPosition[0] && WindowManager.resize.grabPosition[3]) {
				// Move the window to the bottom right
				WindowManager.move.moveBy(WindowManager.interaction.window, (event.x - WindowManager.interaction.offsets[0]), (event.y - WindowManager.interaction.offsets[1]))
				// Resize the window according to the user movement
				WindowManager.interaction.window.style.height = `${boundingBox.height - event.y + WindowManager.interaction.offsets[1]}px`
				WindowManager.interaction.window.style.width = `${boundingBox.width - event.x + WindowManager.interaction.offsets[0]}px`
				// Ignore the next checks
				return
			}
			
			// If the user clicked on the top edge
			if (WindowManager.resize.grabPosition[0]) {
				// Move the window to the bottom
				WindowManager.move.moveBy(WindowManager.interaction.window, 0, (event.y - WindowManager.interaction.offsets[1]))
				// Resize the window height
				WindowManager.interaction.window.style.height = `${boundingBox.height - event.y + WindowManager.interaction.offsets[1]}px`
			}
			// If the user clicked on the bottom edge
			else if (WindowManager.resize.grabPosition[2]) {
				// Resize the window
				WindowManager.interaction.window.style.height = `${boundingBox.height + event.y - WindowManager.interaction.offsets[1]}px`
			}

			// If the user clicked on the left edge
			if (WindowManager.resize.grabPosition[3]) {
				// Move the window to the left
				WindowManager.move.moveBy(WindowManager.interaction.window, (event.x - WindowManager.interaction.offsets[0]), 0)
				// Resize the window height
				WindowManager.interaction.window.style.width = `${boundingBox.width - event.x + WindowManager.interaction.offsets[0]}px`
			}
			// If the user clicked on the right edge
			else if (WindowManager.resize.grabPosition[1]) {
				// Resize the window width
				WindowManager.interaction.window.style.width = `${boundingBox.width + event.x - WindowManager.interaction.offsets[0]}px`
			}
		},
		// Handles the end of a window resizing
		reset(event) {
			// Target the resizing window
			const resizingWindow = WindowManager.space.querySelector(".resizing")
			// If no resizing window, ignore the mouse up event
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
		// VVVV uuhhhhh stranghe call susadora (should be an animation thing) (maybe am trippin, there's no animation) VVVVVV
		Utilities.events.WINDOW_OPEN.on([this.move.centerWindow.bind(this)])
		Utilities.events.WINDOW_CLOSE.on([this.basic.shiftFocus.bind(this)])

		Utilities.events.WINDOW_INTERACTION.on([
			this.move.checkEnable.bind(this),
			this.resize.checkEnable.bind(this)
		])

		Utilities.events.LAUNCHER_CLICK.on([
			this.create.skeletonizeWindow.bind(this)
		])

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

	// Updates the clock (in the frontend)
	updateClockElement(details) {
		// When the clock is updated
		for (const piece of details.target) {
			// Update only the time elements that need updating
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
	// Contains all methods for icon managment
	icons = {
		// Add the maximised propriety to an icon
		maximised: {
			add(details) { AppDockManager.open.querySelector(`[icon=${details.app}]`).classList.add("maximised") },
			remove(details) { AppDockManager.open.querySelector(`[icon=${details.app}]`).classList.remove("maximised") }
		},
		// Add the minimised propriety to an icon
		minimised: {
			add(details) { AppDockManager.open.querySelector(`[icon=${details.app}]`).classList.add("minimised") },
			remove(details) { AppDockManager.open.querySelector(`[icon=${details.app}]`).classList.remove("minimised") }
		},
		// Create the icon for a newly opened window
		async add(details) {
			// Create the new icon for the window
			const icon = document.createElement("button")
			const image = document.createElement("img")
			const name = document.createElement("p")

			// Assemble the dock icon element
			icon.append(name, image)

			// Add it to the app dock
			AppDockManager.open.append(icon)

			// Add the necessary event listeners
			icon.addEventListener("click", AppDockManager.icons.focusLinkedWindow)
			// Set the values of the dock icon
			icon.setAttribute("icon", details.app)	// App name
			image.src = `apps/${details.app}/${(await Utilities.manifests)[details.app].icon}`	// App icon
			name.innerText = details.app
		},
		// Removes an icon when the connected window is closed
		updateClosedWindow(details) {
			// Delete the dock icon and remove it from the map
			AppDockManager.open.querySelector(`[icon=${details.app}]`).remove()
		},
		// Updates an icon when the connected window is maximised
		updateMinimisedWindow(details) {
			// Add the class
			AppDockManager.open.querySelector(`[icon=${details.app}]`).classList.add("mini")
		},
		// Focuses the window connected to a dock icon
		focusLinkedWindow(event) {
			// Shifts the Focus on the Linked Window of a Dock Icon
			const appName = event.target.closest(`[icon]`).getAttribute("icon")
			const window = WindowManager.space.querySelector(`[app="${appName}"]`)

			// Removes classes for some reason
			window.classList.remove("minimized")
			window.classList.remove("maximised")
		}
	}
	constructor() {
		this.initClockElement()
		Utilities.events.CLOCK_UPDATE.on([this.updateClockElement])

		Utilities.events.WINDOW_OPEN.on([this.icons.add])
		Utilities.events.WINDOW_CLOSE.on([this.icons.updateClosedWindow])

		Utilities.events.WINDOW_MINIMISE.on([this.icons.minimised.add])
		Utilities.events.WINDOW_MINIMISE_END.on([this.icons.maximised.remove])

		Utilities.events.WINDOW_MAXIMISE.on([this.icons.maximised.add])
		Utilities.events.WINDOW_MAXIMISE_END.on([this.icons.maximised.remove])
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

// Manages the service worker
// TODO: Add a versioning system that empties the cache if any server asset is updated
const ServiceWorkerManager = new class {
	// Displays the size of the cache
	loadInformation() {
		navigator.storage.estimate().then(({ usage, quota }) => {
			const usedMB = (usage / 1024 ** 2).toFixed(2)
			const totalMB = (quota / 1024 ** 2).toFixed(2)
			const percentUsed = ((usage / quota) * 100).toFixed(2)

			console.log(`Using ${usedMB} MB out of ${totalMB} MB (${percentUsed}%)`)
		})
	}

	constructor() {
		// Log the service worker information
		this.loadInformation()
		// Register the sw script as the service worker
		navigator.serviceWorker.register("/sw")
			.then((registration) => { console.log("Service Worker registered successfully!", registration) })
			.catch((error) => { console.error(error) })
	}
}

// Intros the user to webdesk
// TODO: move to titlebar fetching
if (newUser) {
	const introWindow = WindowManager.basic.skeletonizeWindow({app: "intro"}, false)
	const closeButton = document.createElement("button")
	const buttonsContainer = document.createElement("div")
	const title = document.createElement("h5")

	title.innerText = "Welcome!"

	buttonsContainer.classList.add("buttons")
	buttonsContainer.append(closeButton)
	introWindow.querySelector(".titlebar").append(title, buttonsContainer)

	closeButton.classList.add("close")
	closeButton.addEventListener("click", WindowManager.basic.closeWindow)

	WindowManager.move.centerWindow({target: introWindow})
	WindowManager.basic.focusWindow({target: introWindow})
	introWindow.querySelector("iframe").src = "/api/_/intro"
}