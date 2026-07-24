import { log, IndexDB } from "@webdesk/"
import { showNotification } from "@notify/"

class Background extends HTMLElement {
	image = document.createElement("img")
	#activeURL = ""
	
	set(blob) {
		if (this.#activeURL && this.#activeURL !== "") URL.revokeObjectURL(this.#activeURL)
		this.image.src = this.#activeURL = URL.createObjectURL(blob)
	}

	connectedCallback() {
		this.appendChild(this.image)
		this.image.fetchPriority = "high"
		this.setAttribute("space", "background")
		this.classList.add("space")
	}

	constructor() { super() }
}

async function init() {
	const activeBG = await IndexDB.get(dbTable, "active")
	log.dbug(`Active background name:`, activeBG)
	if (activeBG) return loadBackground(activeBG)
	setup()
}

async function setup() {
	await IndexDB.deleteTable(dbTable)
	const createPromise = IndexDB.createTable(dbTable)
	const defaults = {
		original: fetch("/app/bg/defaults/original"),
		light: fetch("/app/bg/defaults/light"),
		dark: fetch("/app/bg/defaults/dark"),
	}
	let bgToLoad
	
	log.dbug(`Fetching backgrounds:`, defaults)
	for (const [ name, response ] of Object.entries(defaults)) {
		const fullfilled = await response
		
		if (!fullfilled.ok) {
			log.warn("Unable to fetch a default background, it will be unavailable until reset")
			continue
		}
		
		bgToLoad = name
		
		await createPromise
		await saveBackground(name, await fullfilled.blob())
	}

	loadBackground(bgToLoad)
}

async function saveBackground(name, blob) {
	const existing = await IndexDB.get(dbTable, name)
	if (existing) log.warn(`Overwriting background ${name}`)
	IndexDB.set(dbTable, name, blob)
}

async function loadBackground(name) {
	const backgroundBlob = await IndexDB.get(dbTable, name)
	log.verb(`Background "${name}" is ${backgroundBlob.size ?? "???"} bytes`)
	
	if (!backgroundBlob) {
		log.warn(`Skipping request to load an empty background "${name}"`)
		return
	}

	background.set(backgroundBlob)
	await IndexDB.set(dbTable, "active", name)
	background.style.opacity = "100%"
	log.verb(`Loaded background "${name}"`)
}

function getAll(source, _data) {
	IndexDB.getAll(dbTable, true).then(backgrounds => source.postMessage({
		type: "getAll",
		data: backgrounds,
	}, "*"))
}

async function download(source, name) {
	const backgroundBlob = await IndexDB.get(dbTable, name)
	log.dbug(`Donwloading background "${name}" is ${backgroundBlob.size ?? "???"} bytes`)

	if (!backgroundBlob) {
		log.warn(`Skipping request to donwload an empty background "${name}"`)
		return
	}

	const url = URL.createObjectURL(backgroundBlob)
	const temp = document.createElement("a")
	
	temp.style.display = "none"
	temp.href = url
	temp.download = name

	document.body.appendChild(temp)
	temp.click()
	document.body.removeChild(temp)

	URL.revokeObjectURL(url)
}

async function upload(source, file) {
	const { name, type } = file
	const backgroundBlob = new Blob([file], { type })
	const backgrounds = await IndexDB.getAll(dbTable, true)
	const existingNames = Object.keys(backgrounds)
	let baseName = name.replace(/\.[^/.]+$/, "")
	let counter = 1

	while (existingNames.includes(baseName + counter)) { counter++ }

	await IndexDB.set(dbTable, baseName + counter, backgroundBlob)
	log.verb(`Uploaded background "${name}" as "${baseName + counter}"`)

	source.postMessage({
		type: "upload",
		data: { name: baseName + counter, blob: backgroundBlob },
	}, "*")
}

async function deleteBackground(source, name) {
	await IndexDB.delete(dbTable, name)
}

function inbox({ data: { type, target, data }, source }) {
	if (target.toUpperCase() !== "BACKGROUND MANAGER") return
	switch(type) {
		case "getAll": return getAll(source, data)
		case "upload": return upload(source, data)
		case "delete": return deleteBackground(source, data)
		case "download": return download(source, data)
		case "set": return loadBackground(data)
		case "reinit": return setup()
	}
}

const background = document.createElement("webdesk-background")
const dbTable = "backgrounds"

customElements.define("webdesk-background", Background)
document.body.appendChild(background)

window.addEventListener("message", inbox)

init()