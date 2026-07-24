class Preview extends HTMLElement {
	static #active

	static set active(value) {
		if (Preview.#active) Preview.#active.classList.remove("active")
		Preview.#active = value
		Preview.#active.classList.add("active")
	}

	name
	palette
	customCSS
	customWindowsCSS
	image = document.createElement("img")

	#onClick() {
		window.parent.postMessage({
			target: "INTERFACE MANAGER",
			type: "set",
			data: this.name,
		}, "*")
		Preview.active = this
	}

	connectedCallback() {
		this.setAttribute("preview", this.name)
		this.onclick = this.#onClick
		this.append(generateScene(this.palette, this.customCSS))
	}

	disconnectedCallback() {
		URL.revokeObjectURL(this.url)
	}

	constructor() { super() }
}

class Menu extends HTMLElement {
	deleteButton = document.createElement("button")
	downloadButton = document.createElement("button")
	uploadButton = document.createElement("button")
	resetButton = document.createElement("button")

	#open({ x, y, target }) {
		if (target.closest("[menu]")) return
		else if (target.attributes.getNamedItem("preview")) {
			menu.classList.add("onPreview")
			previewTarget = target
		} else menu.classList.remove("onPreview")

		event.preventDefault()
		const elWidth = menu.offsetWidth
		const elHeight = menu.offsetHeight

		const maxX = window.innerWidth - elWidth
		const maxY = window.innerHeight - elHeight

		const safeX = Math.max(0, Math.min(x, maxX))
		const safeY = Math.max(0, Math.min(y, maxY))

		menu.style.left = `${safeX}px`
		menu.style.top = `${safeY}px`

		menu.classList.add("visible")
	}
	#close() {
		menu.classList.remove("visible")
	}
	#setupButtonAppearance() {
		this.uploadButton.setAttribute("upload", "")
		this.downloadButton.setAttribute("download", "")
		this.deleteButton.setAttribute("delete", "")
		this.resetButton.setAttribute("deleteAll", "")

		this.uploadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="lucide-file-up"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M12 12v6"/><path d="m15 15-3-3-3 3"/></svg><span>Upload</span>`
		this.downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="lucide-file-down"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg><span>Download</span>`
		this.deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="lucide-shredder"><path d="M4 13V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v5"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 22v-5"/><path d="M14 19v-2"/><path d="M18 20v-3"/><path d="M2 13h20"/><path d="M6 20v-3"/></svg><span>Delete</span>`
		this.resetButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="lucide-trash-2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>Reset</span>`

		this.append(
			this.uploadButton,
			this.downloadButton,
			this.deleteButton,
			this.resetButton
		)
	}

	connectedCallback() {
		this.setAttribute("menu", "")
		this.#setupButtonAppearance()

		window.addEventListener("contextmenu", this.#open)
		window.addEventListener("click", this.#close)

		this.deleteButton.onclick = async () => {
			const choice = await dialog.show("Delete customization?")
			if (!choice) return log.verb("User canceled customization deletion")
			sendMessageToService("delete", previewTarget.name)
			previewTarget.remove()
		}

		this.downloadButton.onclick = () => {
			sendMessageToService("download", previewTarget.name)
		}

		this.uploadButton.onclick = () => {
			const input = document.createElement("input")
			input.type = "file"
			input.accept = "application/json"
		
			input.onchange = (event) => {
				const file = event.target.files[0]
				if (!file) return
				sendMessageToService("upload", file)
			}
		
			input.click()
		}

		this.resetButton.onclick = async () => {
			const choice = await dialog.show("Reset all customizations?")
			if (!choice) return log.verb("User canceled customizations reset")
			sendMessageToService("reinit")
			setTimeout(() => sendMessageToService("getAll"), 100)
		}
	}

	constructor() { super() }
}

class Dialog extends HTMLElement {
	text = document.createElement("p")
	choice = document.createElement("div")
	confirm = document.createElement("button")
	cancel = document.createElement("button")
	close = document.createElement("button")
	#clickRes
	#click = new Promise(res => this.#clickRes = res)

	#setupButtons() {
		this.confirm.setAttribute("confirm", "")
		this.confirm.innerHTML = "Ok"

		this.cancel.setAttribute("cancel", "")
		this.cancel.innerHTML = "Cancel"

		this.close.setAttribute("close", "")
		this.close.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`

		this.addEventListener("click", event => this.#clickHandler(event))
	}
	#clickHandler({ target }) {
		if (!target.closest("[choices]")) return
		if (target.hasAttribute("confirm")) this.#clickRes(true)
		else this.#clickRes(false)
		this.#click = new Promise(res => this.#clickRes = res)
	}
	
	async show(message) {
		this.text.innerText = message
		this.classList.add("visible")

		const choice = await this.#click
		this.classList.remove("visible")
		return choice
	}

	connectedCallback() {
		this.setAttribute("dialog", "")
		this.choice.setAttribute("choices", "")

		this.#setupButtons()

		this.choice.append(this.confirm, this.cancel)
		this.append(this.close, this.text, this.choice)
	}

	constructor() {
		super()
	}
}

function setup(backgrounds) {
	const previews = [ ]
	
	for (const [ key, object ] of Object.entries(backgrounds)) {
		if (key === "active") continue
		const preview = createPreview(key, object)
		previews.push(preview)
		if (key === backgrounds.active) Preview.active = preview
	}
	
	gallery.innerHTML = ""
	gallery.append(...previews)
}

async function inbox({ data: { type, data }, source }) {
	switch(type) {
		case "getAll": return setup(data)
		case "upload": return upload(data)
	}
}

function createPreview(name, { palette, customCSS, customWindowsCSS }) {
	const preview = document.createElement("ui-preview")
	preview.name = name
	preview.palette = palette
	preview.customCSS = customCSS
	preview.customWindowsCSS = customWindowsCSS
	return preview
}

function upload({ name, customization }) {
	const preview = createPreview(name, customization)
	gallery.prepend(preview)
}

function compilePalette(palette) {
	const result = []
	for (const [ name, value ] of Object.entries(palette)) result.push(`--${name}: ${value}`)
	return result.join(";\n")
}

function generateScene(palette, css) {
	const iframe = document.createElement("iframe")
	iframe.src = `scene/html`
	iframe.onload = () => {
		const styleElement = iframe.contentDocument.head.querySelector("style")
		styleElement.innerHTML = `:root {\n${compilePalette(palette)}\n}\n`
		styleElement.innerHTML += css
	}
	return iframe
}

function sendMessageToService(type, data = {}) {
	window.parent.postMessage({
		target: "INTERFACE MANAGER",
		type,
		data,
	}, "*")
}

const gallery = document.querySelector("[gallery]")
const menu = document.createElement("preview-menu")
const dialog = document.createElement("ui-dialog")
const sceneStyle = await (await fetch("/app/ui/scene/style")).text()

let previewTarget = null

customElements.define("ui-preview", Preview)
customElements.define("preview-menu", Menu)
customElements.define("ui-dialog", Dialog)

document.body.appendChild(menu)
document.body.appendChild(dialog)

window.onmessage = inbox

sendMessageToService("getAll")