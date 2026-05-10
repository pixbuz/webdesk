// TODO: Hash checking to eliminate duplicate styles

const addDialog = document.querySelector(".addDialog")
const removeAllElement = document.querySelector(".removeAll")
const gallery = document.querySelector(".gallery")
// const socket = new WebSocket("/api/sock")
let webdeskOrigin

function remove({ target }) {
	window.sendWebdesk({ command: "remove_custom" })
}

function removeAll(event) {
	window.sendWebdesk({ command: "reinit_custom"})
	removeAllElement.classList.remove("visible")
}

function select({ target }) {
	const removeAllElement = document.querySelector(".removeAll")
	removeAllElement.addEventListener("click", removeAll)
	removeAllElement.classList.toggle("visible")
}

function download({ target }) {
	window.sendWebdesk({ command: "export_custom" })
}

function downloadExportedCustom(data) {
	const customName = Object.keys(data)[0]
	const customData = Object.values(data)[0]

	const json = JSON.stringify(customData)
	const blob = new Blob([json], { type: "application/json" })
	const url = URL.createObjectURL(blob)
	
	const a = document.createElement('a')
	a.href = url
	a.download = `${customName}.json`
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
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
	addDialog.style.display = "none"
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
	
	window.sendWebdesk({ command: "save_custom", data: { name, custom } })
}

async function addPreviews(palettes) {
	for (const [ name, custom ] of Object.entries(palettes).sort()) {
		if (name === "active") continue

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
		if (custom.active) wrapper.classList.add("active")
		
		wrapper.addEventListener("click", customSelected)
		gallery.append(wrapper)
	}

	gallery.querySelector(`[custom="${backgrounds.active}"]`).classList.add("active")
}

function customSelected(event) {
	window.sendWebdesk({ command: "set_custom", data: event.target.getAttribute("custom") })
	gallery.querySelector(".active").classList.remove("active")
	event.target.classList.add("active")
}

function uploadedPreview(success) {
	if (!success) return
	gallery.innerHTML = ""
	window.sendWebdesk({ command: "get_customs" })
}

function initStyle({ palette }) {
	const paletteRules = [ ]
	for (const [ color, value ] of Object.entries(palette)) { paletteRules.push(`--${color}: ${value};`) }
	document.body.setAttribute("style", `${paletteRules.join("")}`)
}

document.querySelectorAll("body nav button").forEach(button => {
	const buttonCallbacks = { remove, removeAll, select, add, download }
	const callback = button.classList[0]
	button.addEventListener("click", buttonCallbacks[callback])
})

window.sendWebdesk({ command: "get_customs" })
window.onmessage = function({ data: message }) {
	switch (message.command) {
		case "get_customs": { return addPreviews(message.data) }
		case "export_custom": { return downloadExportedCustom(message.data) }
		case "save_custom": { return uploadedPreview(message.data) }
		case "remove_custom": { return uploadedPreview(message.data) }
		case "reinit_custom": { return uploadedPreview(message.data) }
	}
}