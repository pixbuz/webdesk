const port = 8000
const hostname = "localhost"
const ssl = false

const cssFilePath = "static/style.css"
const indexFilePath = "static/index.htm"
const frontendScriptsPath = "static/scripts"
const componentsPath = "static/components"

export const config = Object.freeze({
	frontendScriptsPath,
	componentsPath,
	indexFilePath,
	cssFilePath,
	hostname,
	port,
	ssl,
} as const)