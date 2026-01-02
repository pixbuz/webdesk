const port = 3720
const hostname = "localhost"
const ssl = false
let comment: string = ""

comment += "<!--┌────────────────────────────────────────────┐-->\n"
comment += "<!--│ ALT! This is the Compiled Webdesk Index.   │-->\n"
comment += "<!--│      Any modification of this file will be │-->\n"
comment += "<!--│      discarted at the next initialization. │-->\n"
comment += "<!--└────────────────────────────────────────────┘-->\n"

const cssFilePath = "static/style.css"
const frontendScriptsPath = "static/scripts"
const compiledScriptPath = "temp/script.js"
const compiledIndexPath = "temp/webdesk.htm"
const backgroundPath = "static/desktop.svg"
const componentsPath = "static/components"
const serverDebugMode = true

export const config = Object.freeze({
	frontendScriptsPath,
	compiledScriptPath,
	compiledIndexPath,
	serverDebugMode,
	backgroundPath,
	componentsPath,
	cssFilePath,
	hostname,
	comment,
	port,
	ssl,
} as const)