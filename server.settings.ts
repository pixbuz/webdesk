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
const frontendScriptPath = "static/script.js"
const compiledIndexPath = "temp/webdesk.htm"

export const config = Object.freeze({
	port,
	hostname,
	ssl,
	comment,
	cssFilePath,
	frontendScriptPath,
	compiledIndexPath
} as const)