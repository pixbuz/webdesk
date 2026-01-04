const port = 3720
const hostname = "localhost"
const ssl = false

const cssFilePath = "static/style.css"
const frontendScriptsPath = "static/scripts"
const backgroundPath = "static/desktop.svg"
const componentsPath = "static/components"
const serverDebugMode = true

export const config = Object.freeze({
	frontendScriptsPath,
	serverDebugMode,
	backgroundPath,
	componentsPath,
	cssFilePath,
	hostname,
	port,
	ssl,
} as const)