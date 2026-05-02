// TODO: Hash checking to eliminate duplicate styles

const removeButton = document.querySelector("button.remove")
const removeAllButton = document.querySelector("button.removeAll")
const selectButton = document.querySelector("button.select")
const addButton = document.querySelector("button.add")
const addDialog = document.querySelector(".addDialog")
const gallery = document.querySelector(".gallery")
// const socket = new WebSocket("/api/sock")
let webdeskOrigin

function remove({ target }) {
	console.log(target)
}

function removeAll({ target }) {
	console.log(target)
}

function select({ target }) {
	console.log(target)
}

function add({ target }) {
	const closeButton = addDialog.querySelector(".close")
	const fileInput = addDialog.querySelector("input")

	closeButton.addEventListener("click", () => addDialog.style.display = "none")
	fileInput.addEventListener("change", uploadCustomization)

	addDialog.style.display = "flex"
}

function uploadCustomization({ target }) {
	Object.values(target.files).forEach(file => {
		if (file.type !== "application/json") return
		const reader = new FileReader()
		const name = file.name.substring(0, file.name.lastIndexOf("."))
		reader.onload = (load) => requestUpload(load, name)
		reader.readAsText(file)
	})
}

async function requestUpload({ target }, name) {
	const encoder = new TextEncoder()
	let custom, content
	
	try {
		content = target.result
		custom = JSON.parse(content)
		
		if (!custom.css || typeof custom.css !== "string" || custom.css === "") throw "no css"
		else if (!custom.palette || typeof custom.palette !== "object") throw "no palette"
	} catch (error) { return console.log(error) }
	
	// const cleanCustom = content.replaceAll(/\s+/g, "")
	// const bytes = encoder.encode(cleanCustom)
	// const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes))
	// const hash = Array.from(hashBytes).map(byte => byte.toString(16).padStart(2, "0")).join("")
	
	window.parent.postMessage({ command: "save_custom", data: { name, custom } }, webdeskOrigin)
}

function com({ data: message }) {
	switch(message.command) {
		case "init": {
			webdeskOrigin = message.data.origin
			initStyle(message.data)
			window.parent.postMessage({ command: "get_customs" }, webdeskOrigin)
			return
		}
		case "get_customs": {
			addPreviews(message.data)
			return
		}
		case "palette": { return initStyle(message.data) }
	}
}

async function addPreviews(palettes) {
	for (const [ name, custom ] of Object.entries(palettes).sort()) {
		const wrapper = document.createElement("div"),
			previewWrapper = document.createElement("div"),
			customName = document.createElement("p")
		
		const stringPalette = JSON.stringify(custom.palette)
		const previewRequest = await fetch(`/api/preview?${stringPalette}`)
		const preview = await previewRequest.text()

		previewWrapper.classList.add("preview")
		previewWrapper.innerHTML = preview

		customName.innerText = name

		wrapper.setAttribute("custom", name)
		wrapper.append(previewWrapper, customName)
		
		wrapper.addEventListener("click", () => loadCustom(name))
		gallery.append(wrapper)
	}
}

function initStyle({ palette }) {
	const paletteRules = [ ]
	for (const [ color, value ] of Object.entries(palette)) { paletteRules.push(`--${color}: ${value};`) }
	document.body.setAttribute("style", `${paletteRules.join("")}`)
}

function loadCustom(name) {
	console.log(name)
}

document.querySelectorAll("body nav button").forEach(button => {
	const buttonCallbacks = { remove, removeAll, select, add }
	const callback = button.classList[0]
	button.addEventListener("click", buttonCallbacks[callback])
})

window.addEventListener("message", com)