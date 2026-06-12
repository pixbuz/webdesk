const settings = {
	messageLevel: 0,
	timestamp: false,
	folder: "logs",
	interactive: true,
	fileLogging: false,
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
} as const

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
	const year = (now.getFullYear())

	const hours = now.getHours().toString().padStart(2, "0")
	const minutes = now.getMinutes().toString().padStart(2, "0")
	const seconds = now.getSeconds().toString().padStart(2, "0")
	const mills = now.getMilliseconds().toString().padStart(3, "0")

	return `[${year}/${month}/${day}]${padding}[${hours}:${minutes}:${seconds}.${mills}]`
}

function log(type: string, level: number, ...message: unknown[]) {
	if (settings.messageLevel > level) return

	const tagKey = level as keyof typeof settings.tagColors
	const messageKey = level as keyof typeof settings.messageDecoration
	const alignPadding = " ".repeat(7 - type.length)

	let logString = `%c[%c${type}%c]${alignPadding} %c%s`
	let absTime, relTime

	if (settings.timestamp || logFile) {
		absTime = getAbsTime()
		relTime = getRelTime()
	}

	if (settings.timestamp) logString = `%c${absTime}${padding}${relTime}${padding}${logString.substring(2)}`
	
	console.log(
		logString,
		settings.tagColors.edge,
		settings.tagColors[tagKey],
		settings.tagColors.edge,
		settings.messageDecoration[messageKey],
		...message
	)

	if (logFile) {
		const fileStr = message.map(part => typeof part === "string" ? part : Deno.inspect(part)).join(" ")
		const line = `${absTime}${padding}${relTime}${padding}[${type}] ${fileStr}\n`
		logFile.write(encoder.encode(line))
	}
}

export function dbug(...message: unknown[]) { log("DEBUG", 0, ...message) }
export function verb(...message: unknown[]) { log("VERBOSE", 1, ...message) }
export function info(...message: unknown[]) { log("INFO", 2, ...message) }
export function warn(...message: unknown[]) { log("WARNING", 3, ...message) }
export function errr(...message: unknown[]) { log("ERROR", 4, ...message) }

const startMills = performance.now()
const padding = " ".repeat(2)

const startTime = new Date()
const logDate = `${startTime.getFullYear()}-${(startTime.getMonth() + 1).toString().padStart(2, "0")}-${startTime.getDate().toString().padStart(2, "0")}`
const encoder = new TextEncoder()

let logID: number
let logBaseName: string
let logFile: Deno.FsFile | undefined

if (settings.fileLogging) {
	try { Deno.statSync(settings.folder) }
	catch { Deno.mkdirSync(settings.folder) }

	logID = Deno.readDirSync(settings.folder)
		.toArray()
		.length
	logBaseName = `${settings.folder}/${logDate} ${logID}.txt`
	logFile = Deno.openSync(logBaseName, { append: true, create: true })
}