// TODO: Improve backgrounds upload with a frontend element/thing informing about skips cuz duplicates

import { WebdeskEvent, webdeskDB } from "./core"

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
	behavior = {
		moveSmoothing: false,
		resizeSmoothing: true,
		maximizeSmoothing: true,
		minimizeSmoothing: true,
		closeSmoothing: false,
	}
}

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

const defaultAppDockCustomization = new class {
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
	behavior = {
		autoHide: {
			whenOverlapping: true,
			always: false,
			upTime: 5000,
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
		appdock: defaultAppDockCustomization,
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

/** @param {import("./core").CustomizationData} customizationData */
async function loadCustomization(customizationData) {
	if (!customizationData.object) { return }
	else if (!customizationData.force && customizationData.id == currentBackgroundID) { return }

	localStorage.setItem("customization-id", currentCustomizationID = customizationData.id)

	const launchers = computeCustomizationVars(customizationData.object.launchers, "launchers").join(" ")
	const windows = computeCustomizationVars(customizationData.object.windows, "windows").join(" ")
	const appdock = computeCustomizationVars(customizationData.object.appdock, "appdock").join(" ")

	document.documentElement.style.cssText = `${launchers}${windows}${appdock}`

	WebdeskEvent.CUSTOMIZATION_LOADED.emit({ id: currentCustomizationID, css: document.documentElement.style.cssText, object: customizationData.object })
}

/** @param {import("./core").BackgroundData} backgroundData */
async function loadBackground(backgroundData) {
	if (!backgroundData.background) { return }
	else if (!backgroundData.force && backgroundData.id == currentBackgroundID) { return }

	localStorage.setItem("background-id", currentBackgroundID = backgroundData.id)
	backgroundElement.innerHTML = backgroundData.background

	WebdeskEvent.BACKGROUND_LOADED.emit({ id: currentBackgroundID, background: backgroundData.background })
}

/** @param {import("./core").EmptyData} uploadData */
async function uploadBackgroundToDB(uploadData) {
	const savedBackgrounds = await webdeskDB.getAll("_backgrounds")
	if (!uploadData.background) { return }
	else if (savedBackgrounds.includes(uploadData.background)) { return }

	const ID = saveID++
	webdeskDB.set("_backgrounds", ID, uploadData.background)

	WebdeskEvent.BACKGROUND_LOAD.emit({ id: ID, background: uploadData.background })
	WebdeskEvent.BACKGROUND_UPLOADED.emit({ id: ID, background: uploadData.background })
}

/** @param {import("./core").ChangeData} changeData */
async function updateCustomizationToDB(changeData) {
	const customizationVar = changeData.css.substring(2)
	const varTree = customizationVar.split("-")
	const targetKey = varTree.pop()

	let indexer = currentCustomizationObject

	for (const leaf of varTree) { indexer = indexer[leaf] }

	indexer[targetKey] = changeData.value
	await webdeskDB.set("_customizations", currentCustomizationID, currentCustomizationObject)

	const launchers = computeCustomizationVars(currentCustomizationID.launchers, "launchers").join(" ")
	const windows = computeCustomizationVars(currentCustomizationID.windows, "windows").join(" ")
	const appdock = computeCustomizationVars(currentCustomizationID.appdock, "appdock").join(" ")

	WebdeskEvent.CUSTOMIZATION_CHANGE_SAVED.emit({ id: currentCustomizationID, css: `${launchers}${windows}${appdock}`, object: currentCustomizationObject })
}

/** @param {import("./core").ChangeData} changeData */
function previewCustomization(changeData) {
	console.log(changeData)
	document.documentElement.style.setProperty(changeData.css, changeData.value)
}

async function emptyBackgroundsDatabase() {
	for (let i = 1; i < saveID; i++) { await webdeskDB.delete("_backgrounds", i) }

	WebdeskEvent.BACKGROUND_LOAD.emit({ id: 0, background: await webdeskDB.get("_backgrounds", 0) })
}

async function init() {
	if (isNaN(currentCustomizationID)) { await newUserCustomizationInit() }
	if (isNaN(currentBackgroundID)) { await newUserBackgroundInit() }

	WebdeskEvent.CUSTOMIZATION_CHANGE_SAVE.on(updateCustomizationToDB)
	WebdeskEvent.CUSTOMIZATION_CHANGE.on(previewCustomization)
	WebdeskEvent.CUSTOMIZATION_LOAD.on(loadCustomization)

	console.log(WebdeskEvent.CUSTOMIZATION_CHANGE.callbacks)

	WebdeskEvent.BACKGROUND_REMOVE_ALL.on(emptyBackgroundsDatabase)
	WebdeskEvent.BACKGROUND_UPLOAD.on(uploadBackgroundToDB)
	WebdeskEvent.BACKGROUND_LOAD.on(loadBackground)
	
	WebdeskEvent.CUSTOMIZATION_LOAD.emit({ id: currentCustomizationID, css: null, object: currentCustomizationObject = (await webdeskDB.get("_customizations", currentCustomizationID)), force: true })
	WebdeskEvent.BACKGROUND_LOAD.emit({ id: currentBackgroundID, background: currentBackgroundImage = (await webdeskDB.get("_backgrounds", currentBackgroundID)), force: true })

	saveID = (await webdeskDB.getAll("_backgrounds")).length
}

init()