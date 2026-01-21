const WindowsUIProprieties = {
	"background": "#D8DEE9",
	"border": "#4C566A",
	"title": "#2E3440",
	"dots": "#2E3440",

	"buttons": {
		"close": "#D08770",
		"maximize": "#EBCB8B",
		"minimize": "#A3BE8C",
	},

	"focus": {
		"background": "#ECEFF4",
		"border": "#2E3440",
		"title": "#2E3440",
		"dots": "#3B4252",

		"buttons": {
			"close": "#D08770",
			"maximize": "#EBCB8B",
			"minimize": "#A3BE8C",
		},
	},
}

const WindowsBehaviorProprieties = {
	"moveSmoothing": null,
	"resizeSmoothing": null,
	"maximizeSmoothing": null,
	"minimizeSmoothing": null,
	"closeSmoothing": null,
}

const AppDockUIProprieties = {
	"background": "#4C566A",
	"border": "#434C5E",
	"text": "#D8DEE9",

	"icons": {
		"iconBackground": "transparent",

		"focus": {
			"iconBackground": "transparent",
		},

		"mini": {
			"iconBackground": "transparent",
		},

		"maximised": {
			"iconBackground": "transparent",
		},
	},
}

const AppDockBehaviorProprieties = {
	"autoHide": {
		"enabled": null,
		"upTime": null,
		"upDelay": null,
		"downDelay": null,
	},

	"hideOnMaximisedWindow": {
		"enabled": null,
		"upTime": null,
		"upDelay": null,
		"downDelay": null,
	}
}

const CustomizationProprieties = {
	"customName": "nord",
	"customType": "light",

	"colors": {
		"windows": {...WindowsUIProprieties},
		"appDock": {...AppDockUIProprieties},
	},

	"sizes": {
		"windows": {...WindowsUIProprieties},
		"appDock": {...AppDockUIProprieties},
	},

	"behavior": {
		"windows": {...WindowsBehaviorProprieties},
		"appDock": {...AppDockBehaviorProprieties},
	},
}

function uiInit() {
	localStorage.setItem("customization", JSON.stringify(CustomizationProprieties))
	localStorage.setItem("saved-customizations", JSON.stringify([CustomizationProprieties]))
}

function loadCssVar(root, prefix = "") {
	for (const key of Object.keys(root)) {
		if (root[key] instanceof Object) { loadCssVar(root[key], key, `${prefix ? prefix + "-" : ""}${key}`) }
		else { document.documentElement.style.setProperty(`--${prefix}-${key}`, root[key]) }
	}
}

function loadWebdeskCustomization() {
	loadCssVar(CustomizationProprieties["colors"], null)
}

// !!! !!! !!! !!! !!!
// Debug !!! !!! !!!
webdeskFirstTimeInit()

loadWebdeskCustomization()