const port = 3720
const hostname = "localhost"
const ssl = false

const cssFilePath = "static/style.css"
const frontendScriptsPath = "static/scripts"
const componentsPath = "static/components"

export const config = Object.freeze({
	frontendScriptsPath,
	componentsPath,
	cssFilePath,
	hostname,
	port,
	ssl,
} as const)