import { log, IndexDB, WebdeskEvent } from "@webdesk/"
import { activeWindows } from "@winman/"

async function init() {
	const activeUI = await IndexDB.get(dbTable, "active")
	log.dbug(`Active customization name:`, activeUI)
	if (activeUI) return loadCustomization(activeUI)
	setup()
}

async function setup() {
	await IndexDB.deleteTable(dbTable)
	const createPromise = IndexDB.createTable(dbTable)
	const defaults = {
		original: fetch("/app/ui/defaults/original"),
		light: fetch("/app/ui/defaults/light"),
		dark: fetch("/app/ui/defaults/dark"),
	}
	let customToLoad
	
	log.dbug(`Fetching customizations:`, defaults)
	for (const [ name, response ] of Object.entries(defaults)) {
		const fullfilled = await response
		
		if (!fullfilled.ok) {
			log.warn("Unable to fetch a default customization, it will be unavailable until reset")
			continue
		}
		
		customToLoad = name
		
		await createPromise
		await saveCustomization(name, await fullfilled.json())
	}

	loadCustomization(customToLoad)
}

async function saveCustomization(name, obj) {
	const existing = await IndexDB.get(dbTable, name)
	if (existing) log.warn(`Overwriting customization "${name}"`)
	IndexDB.set(dbTable, name, obj)
}

async function loadCustomization(name) {
	const customizationObj = await IndexDB.get(dbTable, name)
	log.dbug(`Customization to load:`, customizationObj)
	
	if (!customizationObj || !customizationObj.customCSS) {
		log.warn(`Skipping request to load an empty customization "${name}"`)
		return
	}
	
	activeCustom = customizationObj
	style.innerHTML = compileCssVars(customizationObj.palette) + "\n" + (customizationObj.customCSS || "")
	await IndexDB.set(dbTable, "active", name)
	WebdeskEvent("CUSTOMIZATION LOADED", customizationObj)
	log.verb(`Loaded customization "${name}"`)
}

function compileCssVars(palette) {
	let css = `:root {\n`
	for (const [ name, value ] of Object.entries(palette)) css += `\t--${name}: ${value};\n`
	css += `}\n`
	return css
}

async function download(name) {
	const customizationObj = await IndexDB.get(dbTable, name)
	log.dbug(`Downloading customization "${name}"`)
	
	if (!customizationObj) {
		log.warn(`Skipping request to download an empty customization "${name}"`)
		return
	}
	
	const blob = new Blob([JSON.stringify(customizationObj, null, "\t")], { type: "application/json" })
	const url = URL.createObjectURL(blob)
	const temp = document.createElement("a")
	
	temp.style.display = "none"
	temp.href = url
	temp.download = `${name}.json`

	document.body.appendChild(temp)
	temp.click()
	document.body.removeChild(temp)
	
	URL.revokeObjectURL(url)
}

async function upload(file) {
	try {
		const text = await file.text()
		const customizationObj = JSON.parse(text)
		
		const name = file.name.replace(/\.[^/.]+$/, "")
		await IndexDB.set(dbTable, name, customizationObj)
	} catch(error) { log.warn(`Failed to parse uploaded customization file:`, error) }
}

async function deleteCutomization(name) {
	await IndexDB.delete(dbTable, name)
}

async function getAll(source) {
	const customizations = await IndexDB.getAll(dbTable, true)
	source.postMessage({
		type: "getAll",
		data: customizations,
	}, "*")
}

function inbox({ data: { type, target, data }, source }) {
	if (target.toUpperCase() !== "INTERFACE MANAGER") return
	switch(type) {
		case "getAll": return getAll(source)
		case "upload": return upload(data)
		case "delete": return deleteCutomization(data)
		case "download": return download(data)
		case "set": return loadCustomization(data)
		case "reinit": return setup()
	}
}

function injectWindowStyle({ content, titlebar }) {
	const conentStyle = document.createElement("style")
	const titlebarStyle = document.createElement("style")
	
	conentStyle.innerHTML = titlebarStyle.innerHTML = compileCssVars(activeCustom.palette)
	conentStyle.innerHTML = titlebarStyle.innerHTML += activeCustom.windowCSS ?? ""

	content.contentDocument.head.appendChild(conentStyle)
	titlebar.contentDocument.head.appendChild(titlebarStyle)
}

function updateStyleOfOpenWindows({ palette, customCSS, windowCSS }) {
	activeWindows.values().forEach(appWindow => {
		const content = appWindow.contentElement
		const titlebar = appWindow.titlebarElement
		injectWindowStyle({ content, titlebar })
	})
}

const style = document.createElement("style")
const dbTable = "customizations"
let activeCustom

document.head.appendChild(style)
window.addEventListener("message", inbox)
WebdeskEvent.on("WINDOW LOADED", injectWindowStyle)
WebdeskEvent.on("CUSTOMIZATION LOADED", updateStyleOfOpenWindows)

init()
