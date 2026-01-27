// const WindowsUIProprieties = {
// 	"background": "#D8DEE9",
// 	"border": "#4C566A",
// 	"title": "#2E3440",
// 	"dots": "#2E3440",

// 	"buttons": {
// 		"close": "#D08770",
// 		"maxi": "#EBCB8B",
// 		"mini": "#A3BE8C",
// 	},

// 	"focus": {
// 		"background": "#ECEFF4",
// 		"border": "#2E3440",
// 		"title": "#2E3440",
// 		"dots": "#3B4252",

// 		"buttons": {
// 			"close": "#D08770",
// 			"maxi": "#EBCB8B",
// 			"mini": "#A3BE8C",
// 		},
// 	},
// }

// const WindowsSizeProprieties = {
// 	"background": "",
// 	"titlebar": "",
// 	"border": "",
// 	"title": "",
// 	"icon": "",
// 	"dots": "",

// 	"buttons": {
// 		"close": "",
// 		"maxi": "",
// 		"mini": "",
// 	},
// }

// const WindowsBehaviorProprieties = {
// 	"moveSmoothing": null,
// 	"resizeSmoothing": null,
// 	"maximizeSmoothing": null,
// 	"minimizeSmoothing": null,
// 	"closeSmoothing": null,
// }

// const LaunchersUIProprieties = {
// 	"text": "#2E3440",
// }

// const LaunchersSizeProprieties = {
// 	"text": "",
// }

// const LaunchersBehavorProprieties = {

// }

// const LaunchersBehaviorProprieties = {

// }

// const AppDockUIProprieties = {
// 	"background": "#4C566A",
// 	"border": "#434C5E",
// 	"text": "#D8DEE9",

// 	"icons": {
// 		"background": "transparent",

// 		"focus": {
// 			"background": "transparent",
// 		},

// 		"mini": {
// 			"background": "transparent",
// 		},

// 		"maxi": {
// 			"background": "transparent",
// 		},
// 	},
// }

// const AppDockSizeProprieties = {
// 	"borderWidth": "none",
// 	"borderStyle": "solid",
// }

// const AppDockBehaviorProprieties = {
// 	"autoHide": {
// 		"enabled": null,
// 		"upTime": null,
// 		"upDelay": null,
// 		"downDelay": null,
// 	},

// 	"hideOnMaximisedWindow": {
// 		"enabled": null,
// 		"upTime": null,
// 		"upDelay": null,
// 		"downDelay": null,
// 	}
// }

// const CustomizationProprieties = {
// 	"customName": "nord",
// 	"customType": "light",
// 	"background": 0,

// 	"colors": {
// 		"windows": {...WindowsUIProprieties},
// 		"appDock": {...AppDockUIProprieties},
// 		"launchers": {...LaunchersUIProprieties}
// 	},

// 	"sizes": {
// 		"windows": {...WindowsSizeProprieties},
// 		"appDock": {...AppDockSizeProprieties},
// 		"launchers": {...LaunchersSizeProprieties}
// 	},

// 	"behavior": {
// 		"windows": {...WindowsBehaviorProprieties},
// 		"appDock": {...AppDockBehaviorProprieties},
// 		"launchers": {...LaunchersBehaviorProprieties}
// 	},
// }

// async function firstTimeUIInit() {
// 	localStorage.setItem("customization", JSON.stringify(CustomizationProprieties))
// 	localStorage.setItem("saved-customizations", JSON.stringify([CustomizationProprieties]))
// 	localStorage.setItem("backgrounds-last-id", 0)

// 	await WebdeskDB.createTable("_backgrounds")
// 	await WebdeskDB.set("_backgrounds", 0, `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="cool"><feTurbulence baseFrequency='0.01' numOctaves="1" result='noise' filterRes="1000"/><feDiffuseLighting in='noise' lighting-color='var(#D8DEE9)' surfaceScale='6'><feDistantLight azimuth='45' elevation='60' /></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#cool)" /></svg>`)
// }

// function loadCssVar(root, prefix = "") {
// 	for (const key of Object.keys(root)) {
// 		if (root[key] instanceof Object) { loadCssVar(root[key], `${prefix ? prefix + "-" : ""}${key}`) }
// 		else { document.documentElement.style.setProperty(`--${prefix}-${key}`, root[key]) }
// 	}
// }

// async function loadBackground(override) {
// 	const backgroundWrapper = document.querySelector(".Background")
// 	const backgroundID = JSON.parse(localStorage.getItem("customization") || JSON.stringify(CustomizationProprieties))["background"]

// 	const backgroundContents = await WebdeskDB.get("_backgrounds", override || backgroundID)
// 	backgroundWrapper.innerHTML = backgroundContents
// }

// function loadWebdeskCustomization() {
// 	const themeObject = JSON.parse(localStorage.getItem("customization") || JSON.stringify(CustomizationProprieties))

// 	loadCssVar(themeObject["colors"], null)
// 	loadBackground()
// }

// // Load the theme
// loadWebdeskCustomization()