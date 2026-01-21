const port = 8000
const hostname = "localhost"
const ssl = false

const indexFilePath = "static/index.htm"
const frontendScriptsPath = "static/scripts"
const cssStylesPath = "static/css"
const componentsPath = "static/components"

export const config = Object.freeze({
	frontendScriptsPath,
	componentsPath,
	indexFilePath,
	cssStylesPath,
	hostname,
	port,
	ssl,
} as const)