const WindowsUIProprietiesTemplate = {
	"background": null,
	"border": null,
	"title": null,
	"dots": null,

	"buttons": {
		"close": null,
		"maximize": null,
		"minimize": null,
	},

	"focus": {
		"background": null,
		"border": null,
		"title": null,
		"dots": null,

		"buttons": {
			"close": null,
			"maximize": null,
			"minimize": null,
		},
	},
}

const WindowsBehaviorProprietiesTemplate = {
	"moveSmoothing": null,
	"resizeSmoothing": null,
	"maximizeSmoothing": null,
	"minimizeSmoothing": null,
	"closeSmoothing": null,
}

const AppDockUIProprietiesTemplate = {
	"background": null,
	"border": null,
	"text": null,

	"icons": {
		"iconBackground": null,

		"focus": {
			"iconBackground": null,
		},

		"mini": {
			"iconBackground": null,
		},

		"maximised": {
			"iconBackground": null,
		},
	},
}

const AppDockBehaviorProprietiesTemplate = {
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
	"colors": {
		"windows": {...WindowsUIProprietiesTemplate},
		"appDock": {...AppDockUIProprietiesTemplate},
	},

	"sizes": {
		"windows": {...WindowsUIProprietiesTemplate},
		"appDock": {...AppDockUIProprietiesTemplate},
	},

	"behavior": {
		"windows": {...WindowsBehaviorProprietiesTemplate},
		"appDock": {...AppDockBehaviorProprietiesTemplate},
	},
}

firstTimeInit()