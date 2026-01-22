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

const WindowsSizeProprieties = {
	"background": "",
	"titlebar": "",
	"border": "",
	"title": "",
	"icon": "",
	"dots": "",

	"buttons": {
		"close": "",
		"maximize": "",
		"minimize": "",
	},
}

const WindowsBehaviorProprieties = {
	"moveSmoothing": null,
	"resizeSmoothing": null,
	"maximizeSmoothing": null,
	"minimizeSmoothing": null,
	"closeSmoothing": null,
}

const LaunchersUIProprieties = {
	"text": "#2E3440",
}

const LaunchersSizeProprieties = {
	"text": "",
}

const LaunchersBehavorProprieties = {

}

const LaunchersBehaviorProprieties = {

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

const AppDockSizeProprieties = {
	"borderWidth": "none",
	"borderStyle": "solid",
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
		"launchers": {...LaunchersUIProprieties}
	},

	"sizes": {
		"windows": {...WindowsSizeProprieties},
		"appDock": {...AppDockSizeProprieties},
		"launchers": {...LaunchersSizeProprieties}
	},

	"behavior": {
		"windows": {...WindowsBehaviorProprieties},
		"appDock": {...AppDockBehaviorProprieties},
		"launchers": {...LaunchersBehaviorProprieties}
	},
}

function uiInit() {
	localStorage.setItem("customization", JSON.stringify(CustomizationProprieties))
	localStorage.setItem("saved-customizations", JSON.stringify([CustomizationProprieties]))
}

function loadCssVar(root, prefix = "") {
	for (const key of Object.keys(root)) {
		console.log(prefix, root)
		if (root[key] instanceof Object) { loadCssVar(root[key], `${prefix ? prefix + "-" : ""}${key}`) }
		else { document.documentElement.style.setProperty(`--${prefix}-${key}`, root[key]) }
	}
}

function loadWebdeskCustomization() {
	loadCssVar(CustomizationProprieties["colors"], null)
}

// !!! !!! !!! !!! !!!
// Debug !!! !!! !!!
webdeskFirstTimeInit()

// Load the theme
loadWebdeskCustomization()