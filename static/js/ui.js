// TODO: Improve backgrounds upload with a frontend element/thing informing about skips cuz duplicates
// TODO: Deprecate UI and have single elements do their styling
// TODO: Make the style objects smarter and more detailed

import { WebdeskEvent, webdeskDB, StyleSheets } from "./core"

const defaultLaunchersCustomization = new class {
	color = {
		text: "#2E3440",
	}
	appearance = {
		text: true
	}
	behavior = {

	}
}

const defaultWindowsCustomization = new class {
	color = {
		background: "#D8DEE9",
		border: "#4C566A",
		dots: "#2E3440",
		focus: {
			background: "#ECEFF4",
			border: "#2E3440",
			dots: "#3B4252",
		},
		titlebar: {
			title: "#2E3440",
			buttons: {
				close: "#D08770",
				maxi: "#EBCB8B",
				mini: "#A3BE8C",
			},
			focus: {
				title: "#2E3440",
				buttons: {
					close: "#D08770",
					maxi: "#EBCB8B",
					mini: "#A3BE8C",
				},
			}
		},
	}
	appearance = {
		width: "37.5vmax",
		height: "37.5vmin",
		"min-width": "17.5vmax",
		"min-height": "17.5vmin",
		"max-width": "95vmax",
		"max-height": "95vmin",
		titlebar: "2.5vmin",
		border: "2px",
		padding: "4px",
		title: null,
		icon: null,
		dots: null,
		buttons: {
			close: null,
			maxi: null,
			mini: null,
		},
	}
	animations = {
		open: {
			speed: "50ms",
			function: "cubic-bezier(0.34, 1.56, 0.64, 1)",
		},
		close: {
			speed: "25ms",
			function: "cubic-bezier(0.4, 0, 1, 1)",
		},
		"to-maximised": {
			speed: "50ms",
			function: "cubic-bezier(0.4, 0, 1, 1)",
		},
		"from-maximised": {
			speed: "25ms",
			function: "cubic-bezier(0.4, 0, 1, 1)",
		},
		"to-minimised": {
			speed: "50ms",
			function: "cubic-bezier(0.4, 0, 1, 1)",
		},
		"from-minimised": {
			speed: "25ms",
			function: "cubic-bezier(0.4, 0, 1, 1)",
		},
	}
	behavior = {

	}
}

const defaultDockCustomization = new class {
	color = {
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
	}
	appearance = {
		border: {
			width: "none",
			style: "solid",
		}
	}
	animations = {
		up: {
			speed: "25ms",
			function: "cubic-bezier(0.2, 0.8, 0.2, 1)",
		},
		down: {
			speed: "50ms",
			function: "cubic-bezier(0.2, 0.8, 0.2, 1)",
		},
	}
	behavior = {
		autoHide: {
			mode: "overlap",	// never | overlap | always
			upDelay: 0,
			downDelay: 2000,
		},
		hideOnMaximisedWindow: {
			enabled: true,
			upTime: 5000,
			upDelay: 0,
			downDelay: 2000,
		},
		iconNames: false
	}
}

const backgroundElement = document.querySelector(".Background")

let currentCustomizationID = parseInt(localStorage.getItem("customization-id"))
let currentBackgroundID = parseInt(localStorage.getItem("background-id"))
let currentCustomizationObject
let currentBackgroundImage
let saveID = 1

async function newUserCustomizationInit() {
	const theme = {
		windows: defaultWindowsCustomization,
		dock: defaultDockCustomization,
		launchers: defaultLaunchersCustomization,
	}

	localStorage.setItem("customization-id", 0)
	await webdeskDB.createTable("_customizations")
	await webdeskDB.set("_customizations", 0, theme)

	currentCustomizationID = 0
}

async function newUserBackgroundInit() {
	localStorage.setItem("background-id", 0)
	await webdeskDB.createTable("_backgrounds")
	await webdeskDB.set("_backgrounds", 0, `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="cool"><feTurbulence baseFrequency='0.01' numOctaves="1" result='noise' filterRes="1000"/><feDiffuseLighting in='noise' lighting-color='#D8DEE9' surfaceScale='6'><feDistantLight azimuth='45' elevation='60' /></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#cool)" /></svg>`)

	currentBackgroundID = 0
}

function computeCustomizationVars(customizationObject, prefix) {
	const varList = []

	if (!customizationObject) { customizationObject = currentCustomizationObject[prefix] }

	for (const key of Object.keys(customizationObject)) {
		if (customizationObject[key] instanceof Object) { varList.push(...computeCustomizationVars(customizationObject[key], `${prefix + "-"}${key}`)) }
		else { varList.push(`--${prefix}-${key}: ${customizationObject[key]};`) }
	}

	return varList
}

/** @param {import("./core").CustomizationData} data */
async function loadCustomization({ id, css, object, force }) {
	if (!object) { return }
	else if (!force && id == currentBackgroundID) { return }

	localStorage.setItem("customization-id", currentCustomizationID = id)

	const launchers = computeCustomizationVars(object.launchers, "launchers").join(" ")
	const windows = computeCustomizationVars(object.windows, "windows").join(" ")
	const dock = computeCustomizationVars(object.dock, "dock").join(" ")

	StyleSheets.launchers.replace(`:root {${launchers}}`)
	StyleSheets.windows.replace(`:root {${windows}}`)
	StyleSheets.dock.replace(`:root {${dock}}`)

	document.adoptedStyleSheets = Object.values(StyleSheets)

	currentCustomizationObject = object

	WebdeskEvent.CUSTOMIZATION_LOADED.emit({ id: currentCustomizationID, css: `${launchers}${windows}${dock}`, object: object })
}

/** @param {import("./core").BackgroundData} data */
async function loadBackground({ id, background, force }) {
	if (!background) { return }
	else if (!force && id == currentBackgroundID) { return }

	localStorage.setItem("background-id", currentBackgroundID = id)
	backgroundElement.innerHTML = background

	WebdeskEvent.BACKGROUND_LOADED.emit({ id: currentBackgroundID, background: background })
}

/** @param {import("./core").EmptyData} uploadData */
async function uploadBackgroundToDB(uploadData) {
	const savedBackgrounds = await webdeskDB.getAll("_backgrounds")
	if (!uploadData.background) { return }
	else if (savedBackgrounds.includes(uploadData.background)) { return }

	console.log(uploadData)

	const ID = saveID++
	webdeskDB.set("_backgrounds", ID, uploadData.background)

	WebdeskEvent.BACKGROUND_LOAD.emit({ id: ID, background: uploadData.background })
	WebdeskEvent.BACKGROUND_UPLOADED.emit({ id: ID, background: uploadData.background })
}

/** @param {import("./core").ChangeData} data */
async function updateCustomizationToDB({ css, value }) {
	const customizationVar = css.substring(2)
	const varTree = customizationVar.split("-")
	const targetKey = varTree.pop()

	let indexer = currentCustomizationObject

	for (const leaf of varTree) { indexer = indexer[leaf] }

	indexer[targetKey] = value
	await webdeskDB.set("_customizations", currentCustomizationID, currentCustomizationObject)

	const launchers = computeCustomizationVars(currentCustomizationID.launchers, "launchers").join(" ")
	const windows = computeCustomizationVars(currentCustomizationID.windows, "windows").join(" ")
	const dock = computeCustomizationVars(currentCustomizationID.dock, "dock").join(" ")

	WebdeskEvent.CUSTOMIZATION_CHANGE_SAVED.emit({ id: currentCustomizationID, css: `${launchers}${windows}${dock}`, object: currentCustomizationObject })
}

/** @param {import("./core").ChangeData} data */
function previewCustomization({ css, value }) {
	document.documentElement.style.setProperty(css, value)
}

async function emptyBackgroundsDatabase() {
	for (let i = 1; i < saveID; i++) { await webdeskDB.delete("_backgrounds", i) }

	WebdeskEvent.BACKGROUND_LOAD.emit({ id: 0, background: await webdeskDB.get("_backgrounds", 0) })
}

async function init() {
	console.log("Initing")
	if (isNaN(currentCustomizationID)) { await newUserCustomizationInit() }
	if (isNaN(currentBackgroundID)) { await newUserBackgroundInit() }

	console.log("Checked if new user")
	WebdeskEvent.CUSTOMIZATION_CHANGE_SAVE.on(updateCustomizationToDB)
	WebdeskEvent.CUSTOMIZATION_CHANGE.on(previewCustomization)
	WebdeskEvent.CUSTOMIZATION_LOAD.on(loadCustomization)

	console.log("Added Customization listeners")
	WebdeskEvent.BACKGROUND_REMOVE_ALL.on(emptyBackgroundsDatabase)
	WebdeskEvent.BACKGROUND_UPLOAD.on(uploadBackgroundToDB)
	WebdeskEvent.BACKGROUND_LOAD.on(loadBackground)
	
	console.log("Added background Listeners")
	WebdeskEvent.CUSTOMIZATION_LOAD.emit({ id: currentCustomizationID, css: null, object: currentCustomizationObject = (await webdeskDB.get("_customizations", currentCustomizationID)), force: true })
	WebdeskEvent.BACKGROUND_LOAD.emit({ id: currentBackgroundID, background: currentBackgroundImage = (await webdeskDB.get("_backgrounds", currentBackgroundID)), force: true })

	console.log("Ran custom and background loads")
	saveID = (await webdeskDB.getAll("_backgrounds")).length
	console.log("save ID got")
}

init()