// TODO: Custom color pickers
// TODO: Improve read image error logic
// TODO: Improve Background loading, rn it blocks the whole site

// navigator.serviceWorker.register("/sw")
// .then((registration) => { registration.active.postMessage("checkHashes") })

const mainElement = document.querySelector("main")
let currentSubSection = mainElement.children[0]

const Messager = new class {
	#ready
	#port
	#titlebar
	#pending = new Map()

	#recieve({ data: { command, payload } }) {
		if (Messager.#pending.has(command)) {
			const { resolve, timeout } = Messager.#pending.get(command)
			Messager.#pending.delete(command)
			clearTimeout(timeout)

			return resolve(payload)
		} else {
			if (command === "event") {
				const { event, data } = payload

				if (event === "BACKGROUND_UPLOADED") {
					Background.previewFactory(data)
				}
			}
		}
	}

	#initPort({ ports }) {
		Messager.#port = ports[0]
		Messager.#titlebar = ports[1]

		Messager.#port.start()
		Messager.#titlebar.start()

		Messager.#port.addEventListener("message", Messager.#recieve)
		Messager.#titlebar.addEventListener("message", Messager.#recieve)
	}

	async send(command, data, toTitlebar = false) {
		await Messager.#ready
		let target = Messager.#port

		if (toTitlebar) { target = Messager.#titlebar }

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(reject, 30000)

			Messager.#pending.set(command, { resolve, timeout })
			target.postMessage({ command, data })
		})
	}

	constructor() {
		this.#ready = new Promise((resolve, reject) => {
			window.addEventListener("message", (event) => { resolve(this.#initPort(event)) }, { once: true })
		})
	}
}

function show(event) {
	const subSectionName = event.target.getAttributeNames().at(0)
	const subSection = mainElement.querySelector(`div[${subSectionName}]`)

	currentSubSection.style.display = "none"
	subSection.style.display = "flex"
	currentSubSection = subSection
}

const Launchers = new class {
	constructor() {

	}
}

const Windows = new class {
	constructor() {
		
	}
}

const Dock = new class {
	constructor() {
		
	}
}

const Applications = new class {
	constructor() {
		
	}
}

const Colors = new class {
	section = mainElement.querySelector(`[colors]`)
	sectionButton = document.querySelector(`.sectionOpener[colors]`)
	customID = 0

	updateInput(event) {
		if (event.type == "input") {
			const cssVar = event.target.name
			const newColor = event.target.value

			Messager.send("emit.event", { type: "CUSTOMIZATION_CHANGE", payload: { css: cssVar, value: newColor } })
		} else if (event.type == "change") {
			const cssVar = event.target.name
			const newColor = event.target.value

			Messager.send("emit.event", { type: "CUSTOMIZATION_CHANGE_SAVE", payload: { css: cssVar, value: newColor } })
		}
	}
	async init() {
		const { style: { launchers: launchersTextStyle, windows: windowsTextStyle, dock: dockTextStyle } } = await Messager.send("get.style", { target: "all" })

		const launchersStyleSheet = new CSSStyleSheet(),
		windowsStyleSheet = new CSSStyleSheet(),
		dockStyleSheet = new CSSStyleSheet()
		
		await launchersStyleSheet.replace(launchersTextStyle)
		await windowsStyleSheet.replace(windowsTextStyle)
		await dockStyleSheet.replace(dockTextStyle)

		const launchersStyle = launchersStyleSheet.cssRules[0],
		windowsStyle = windowsStyleSheet.cssRules[0],
		dockStyle = dockStyleSheet.cssRules[0]

		for (const input of Colors.section.querySelectorAll("input")) {
			const cssVar = input.name
			let value

			if (cssVar.startsWith("--dock")) { value = dockStyle.style.getPropertyValue(cssVar) }
			else if (cssVar.startsWith("--windows")) { value = windowsStyle.style.getPropertyValue(cssVar) }
			else if (cssVar.startsWith("--launchers")) { value = launchersStyle.style.getPropertyValue(cssVar) }

			input.value = value
		}
	}

	constructor() {
		this.sectionButton.addEventListener("click", this.init, { once: true })

		for (const input of this.section.querySelectorAll("input")) {
			input.addEventListener("change", this.updateInput.bind(this))
			input.addEventListener("input", this.updateInput.bind(this))
		}

		Messager.send("get.localstorage", { key: "customization-id" }).then((event) => { Colors.customID = event.value })
	}
}

const Background = new class {
	sectionButton = document.querySelector(`.sectionOpener[backgrounds]`)
	section = mainElement.querySelector(`[backgrounds]`)
	uploadButton = this.section.querySelector("#upload")
	deleteButton = this.section.querySelector("#removeAll")
	previewsWrapper = this.section.querySelector(".wrapper")

	async manageUpload(event) {
		for (let i = 0; i < event.target.files.length; i++) {
			const file = event.target.files[i]
			let background

			if (!file.type.startsWith("image/")) { continue }
			else if (file.type == "image/svg+xml") { background = await Background.processSVG(file.text()) }
			else { background = await Background.readImage(file) }

			Messager.send("emit.event", { type: "BACKGROUND_UPLOAD", payload: { background } })
		}
	}
	readImage(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()

			reader.onload = (event) => { resolve(Background.processImage(event.target.result)) }
			reader.onerror = (error) => { reject(error) }

			reader.readAsDataURL(file)
		})
	}
	processImage(encodedImage) {
		return `<img src="${event.target.result}"/>`
	}
	async processSVG(svgTextPromise) {
		const text = await svgTextPromise

		if (!text.startsWith("<svg")) { return undefined }
		else { return text }
	}
	async showAllBackgroundsPreviews() {
		const { value: backgrounds } = await Messager.send("getAll.db", { table: "_backgrounds" })
		const fragment = document.createDocumentFragment()

		backgrounds
			.reverse()
			.forEach(async (background, i) => {
				const preview = Background.previewFactory({ id: backgrounds.length - i - 1, background: background }, "return")
				fragment.appendChild(preview)
				await new Promise(r => setTimeout(r, 10))
			})

		Background.previewsWrapper.append(fragment)
	}
	previewFactory({ background, id }, mode) {
		const preview = document.createElement("button")

		preview.classList.add("preview")
		preview.setAttribute("title", "Set this as the background")

		preview.innerHTML = background
		preview.setAttribute("bgID", id)
		preview.addEventListener("click", Background.loadBackground)

		switch(mode) {
			case "return": return preview
			default: return Background.previewsWrapper.prepend(preview)
		}
	}
	async loadBackground(event) {
		const backgroundID = parseInt(event.target.getAttribute("bgID"))
		const { value: backgroundContent } = await Messager.send("get.db", { table: "_backgrounds", key: backgroundID })

		Messager.send("emit.event", { type: "BACKGROUND_LOAD", payload: { id: backgroundID, background: backgroundContent } })
	}
	removeAllBackgrounds() {
		Background.previewsWrapper.style = "none"
		Messager.send("emit.event", { type: "BACKGROUND_REMOVE_ALL", payload: { } })

		const previews = Array.from(Background.previewsWrapper.children)

		previews
			.slice(0, previews.length - 1)
			.forEach((preview) => { preview.remove() })

		Background.previewsWrapper.style = "flex"
	}

	init() {
		Background.showAllBackgroundsPreviews()
		Background.previewsWrapper.style = "flex"
	}

	constructor() {
		this.uploadButton.addEventListener("input", this.manageUpload)
		this.deleteButton.addEventListener("click", this.removeAllBackgrounds)
		this.sectionButton.addEventListener("click", this.init, { once: true })

		this.previewsWrapper.style = "none"
	}
}

const Animations = new class {
	section = mainElement.querySelector(`[animations]`)
	sectionButton = document.querySelector(`.sectionOpener[animations]`)
	something = this.section

	init() {
		
	}

	constructor() {
		this.sectionButton.addEventListener("click", this.init, { once: true })
	}
}

for (const button of document.querySelectorAll("button.sectionOpener")) {
	button.addEventListener("click", show)
}

/* BEBUGGGG BEBUUUUUGGG */
let subSection = mainElement.querySelector(`div[animations]`)
currentSubSection.style.display = "none"
subSection.style.display = "flex"
currentSubSection = subSection