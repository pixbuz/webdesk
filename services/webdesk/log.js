const settings = {
	messageLevel: 0,
	timestamp: false,
	tagColors: {
		edge: "color: darkgray",
		0: "color: yellow",
		1: "color: gray",
		2: "color: cyan",
		3: "color: yellow",
		4: "color: red",
	},
	messageDecoration: {
		0: "font-style: italic; color: yellow",
		1: "color: gray",
		2: "",
		3: "text-decoration: underline; color: yellow",
		4: "font-weight: bold; text-decoration: underline; color: red",
	},
}

function getRelTime() {
	const now = performance.now()
	const passMills = now - startMills
	const secs = ( (passMills / 1000) % 60 ).toFixed(3).toString().padStart(6, "0")
	const mins = ( Math.floor(passMills / (60 * 1000)) % 60 ).toString().padStart(2, "0")
	const hour = ( Math.floor(passMills / (60 * 60 * 1000)) % 24 ).toString().padStart(2, "0")
	const days = ( Math.floor(passMills / (24 * 60 * 60 * 1000)) ).toString().padStart(3, "0")

	return `[${days}|${hour}:${mins}:${secs}]`
}

function getAbsTime() {
	const now = new Date()
	const day = now.getDate().toString().padStart(2, "0")
	const month = (now.getMonth() + 1).toString().padStart(2, "0")
	const year = now.getFullYear()

	const hours = now.getHours().toString().padStart(2, "0")
	const minutes = now.getMinutes().toString().padStart(2, "0")
	const seconds = now.getSeconds().toString().padStart(2, "0")
	const mills = now.getMilliseconds().toString().padStart(3, "0")

	return `[${year}/${month}/${day}]${padding}[${hours}:${minutes}:${seconds}.${mills}]`
}

function logLine(type, level, ...message) {
	if (settings.messageLevel > level) return

	const alignPadding = " ".repeat(7 - type.length)

	let logString = `%c[%c${type}%c]${alignPadding} %c%s`
	let absTime, relTime

	if (settings.timestamp) {
		absTime = getAbsTime()
		relTime = getRelTime()
	}

	if (settings.timestamp) logString = `%c${absTime}${padding}${relTime}${padding}${logString.substring(2)}`
	
	console.log(
		logString,
		settings.tagColors.edge,
		settings.tagColors[level],
		settings.tagColors.edge,
		settings.messageDecoration[level],
		...message
	)
}

function dbug(...message) { logLine("DEBUG", 0, ...message) }
function verb(...message) { logLine("VERBOSE", 1, ...message) }
function info(...message) { logLine("INFO", 2, ...message) }
function warn(...message) { logLine("WARNING", 3, ...message) }
function errr(...message) { logLine("ERROR", 4, ...message) }

const startMills = performance.now()
const padding = " ".repeat(2)

export const log = {
	dbug,
	verb,
	info,
	warn,
	errr
}

globalThis.addEventListener("error", errorEvent => {
	errr("Fatal error:", errorEvent.error.stack || errorEvent.message)
	errorEvent.preventDefault()
})

globalThis.addEventListener("unhandledrejection", errorEvent => {
	errr("Unhandled promise rejection:", errorEvent.reason.stack || errorEvent.reason)
	errorEvent.preventDefault()
})