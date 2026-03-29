// TODO: Custom color pickers
// TODO: Improve read image error logic
// TODO: Improve Background loading, rn it blocks the whole site

const mainElement = document.querySelector("main")
let currentSubSection = mainElement.children[0]
let port

window.addEventListener("message", com)

function com({ data: message, ports }) {
	if (!port) {
		port = ports[0]
		port.start()
	}

	console.log(data)

	switch(message.command) {
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
	customID = parseInt(localStorage.getItem("customization-id") || 0)

	updateInput(event) {
		if (event.type == "input") {
			const cssVar = event.target.name
			const newColor = event.target.value

			WebdeskEvent.CUSTOMIZATION_CHANGE.emit({ css: cssVar, value: newColor })
		} else if (event.type == "change") {
			const cssVar = event.target.name
			const newColor = event.target.value

			WebdeskEvent.CUSTOMIZATION_CHANGE_SAVE.emit({ css: cssVar, value: newColor })
		}
	}
	async init() {
		const customizationVars = window.parent.document.documentElement.style.cssText.split("; ")
		const launchersStyleVars = StyleSheets.launchers.cssRules[0]
		const windowsStyleVars = StyleSheets.windows.cssRules[0]
		const dockStyleVars = StyleSheets.dock.cssRules[0]

		for (const input of Colors.section.querySelectorAll("input")) {
			const cssVar = input.name
			let value

			if (cssVar.startsWith("--dock")) { value = dockStyleVars.style.getPropertyValue(cssVar) }
			else if (cssVar.startsWith("--windows")) { value = windowsStyleVars.style.getPropertyValue(cssVar) }
			else if (cssVar.startsWith("--launchers")) { value = launchersStyleVars.style.getPropertyValue(cssVar) }

			input.value = value
		}
	}

	constructor() {
		this.sectionButton.addEventListener("click", this.init, { once: true })

		for (const input of this.section.querySelectorAll("input")) {
			input.addEventListener("change", this.updateInput.bind(this))
			input.addEventListener("input", this.updateInput.bind(this))
		}
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

			WebdeskEvent.BACKGROUND_UPLOAD.emit({ background: background })
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
	processImage(encodedImage) { return `<img src="${event.target.result}"/>` }
	async processSVG(svgTextPromise) {
		const text = await svgTextPromise

		if (!text.startsWith("<svg")) { return undefined }
		else { return text }
	}
	async showAllBackgroundsPreviews() {
		const backgrounds = await webdeskDB.getAll("_backgrounds")
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
	previewFactory(details, mode) {
		const preview = document.createElement("button")

		preview.classList.add("preview")
		preview.setAttribute("title", "Set this as the background")

		preview.innerHTML = details.background
		preview.setAttribute("bgID", details.id)
		preview.addEventListener("click", Background.loadBackground)

		switch(mode) {
			case "return": return preview
			default: return Background.previewsWrapper.prepend(preview)
		}
	}
	async loadBackground(event) {
		const backgroundID = parseInt(event.target.getAttribute("bgID"))
		const backgroundContent = await webdeskDB.get("_backgrounds", backgroundID)

		WebdeskEvent.BACKGROUND_LOAD.emit({ id: backgroundID, background: backgroundContent })
	}
	removeAllBackgrounds() {
		Background.previewsWrapper.style = "none"
		WebdeskEvent.BACKGROUND_REMOVE_ALL.emit({})

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

		WebdeskEvent.BACKGROUND_UPLOADED.on(this.previewFactory)
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