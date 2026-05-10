// TODO: Hash checking to eliminate duplicate styles
// TODO: Image resizing to eliminate load delay
// TODO: JSON objects that specify image type of background

const addDialog = document.querySelector(".addDialog")
const removeAllElement = document.querySelector(".removeAll")
const gallery = document.querySelector(".gallery")
// const socket = new WebSocket("/api/sock")
let webdeskOrigin

function remove({ target }) {
	window.sendWebdesk({ command: "remove_background" })
}

function removeAll(event) {
	window.sendWebdesk({ command: "reinit_background"})
	removeAllElement.classList.remove("visible")
}

function select({ target }) {
	const removeAllElement = document.querySelector(".removeAll")
	removeAllElement.addEventListener("click", removeAll)
	removeAllElement.classList.toggle("visible")
}

function download({ target }) {
	window.sendWebdesk({ command: "export_background" })
}

function downloadExportedBackground(data) {
	const backgroundName = Object.keys(data)[0]
	const backgroundData = Object.values(data)[0]

	let extension

	if (backgroundData.startsWith(`<img src="data:image/`)) {
		const content = backgroundData.substring(backgroundData.indexOf(`<img src="data:image/`) + 10, backgroundData.length - 4)
		downloadImage(backgroundName, content, content.substring(11, backgroundData.lastIndexOf(`;base64`) - 10))
	} else downloadSVG(backgroundName, backgroundData)
}

function downloadImage(name, data, extension) {
	const a = document.createElement("a")
	a.href = data
	a.download = `${name}.${extension}`
	a.click()
	console.log(a)
}

function downloadSVG(name, data) {
	const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")

	a.href = url
	a.download = `${name}.svg`

	document.body.appendChild(a)
	a.click()

	document.body.removeChild(a)
	URL.revokeObjectURL(url)
}

function add({ target }) {
	const closeButton = addDialog.querySelector(".close")
	const fileInput = addDialog.querySelector("input")

	closeButton.addEventListener("click", () => addDialog.style.display = "none")
	fileInput.addEventListener("change", uploadBackground)

	addDialog.style.display = "flex"
}

function uploadBackground({ target }) {
	Object.values(target.files).forEach(file => {
		if (!file.type.includes("image/")) return
		const reader = new FileReader()
		const name = file.name.substring(0, file.name.lastIndexOf("."))
		const extension = file.name.substring(file.name.lastIndexOf(".") + 1)

		if (extension.includes("svg")) {
			reader.onload = (load) => requestSVGUpload(load, name)
			reader.readAsText(file)
		}

		reader.onload = (load) => requestImageUpload(load, name)
		reader.readAsDataURL(file)
	})
	addDialog.style.display = "none"
}

async function requestSVGUpload({ target }, name) {
	const encoder = new TextEncoder()
	let background
	
	background = target.result
	
	window.sendWebdesk({ command: "save_background", data: { name, background } })
}

async function requestImageUpload({ target }, name) {
	const encoder = new TextEncoder()
	let background
	
	background = `<img src="${target.result}" />`
	
	window.sendWebdesk({ command: "save_background", data: { name, background } })
}

async function addPreviews(backgrounds) {
	for (const [ name, background ] of Object.entries(backgrounds).sort()) {
		if (name === "active") continue

		const wrapper = document.createElement("div"),
			previewWrapper = document.createElement("div"),
			customName = document.createElement("p")

		previewWrapper.classList.add("preview")
		previewWrapper.innerHTML = background

		customName.innerText = name

		wrapper.setAttribute("background", name)
		wrapper.append(previewWrapper, customName)
		
		wrapper.addEventListener("click", backgroundSelected)
		gallery.append(wrapper)
	}

	gallery.querySelector(`[background="${backgrounds.active}"]`).classList.add("active")
}

function backgroundSelected(event) {
	window.sendWebdesk({ command: "set_background", data: event.target.getAttribute("background") })
	gallery.querySelector(".active").classList.remove("active")
	event.target.classList.add("active")
}

function uploadedPreview(success) {
	if (!success) return
	gallery.innerHTML = ""
	window.sendWebdesk({ command: "get_backgrounds" })
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

window.sendWebdesk({ command: "get_backgrounds" })
window.onmessage = function({ data: message }) {
	switch (message.command) {
		case "get_backgrounds": { return addPreviews(message.data) }
		case "export_background": { return downloadExportedBackground(message.data) }
		case "save_background": { return uploadedPreview(message.data) }
		case "remove_background": { return uploadedPreview(message.data) }
		case "reinit_background": { return uploadedPreview(message.data) }
	}
}