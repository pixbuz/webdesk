const WebdeskEvent = window.parent.WebdeskEvent
const webdeskDB = window.parent.webdeskDB

const mainElement = document.querySelector("main")
let currentSubSection = mainElement.children[0]

function show(button) {
	const subSectionName = button.getAttributeNames().at(0)
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

const AppDock = new class {
	constructor() {
		
	}
}

const Applications = new class {
	constructor() {
		
	}
}

const Colors = new class {
	constructor() {
		
	}
}

// TODO: Improve asyncing, rn it blocks the whole site when loading
const Background = new class {
	uploadButton = mainElement.querySelector("#upload")
	deleteButton = mainElement.querySelector("#removeAll")
	previewsWrapper = mainElement.querySelector(".wrapper")

	async manageUpload(event) {
		const backgrounds = []

		for (let i = 0; i < event.target.files.length; i++) {
			const file = event.target.files[i]

			// CAn be imrpoved with promises
			if (!file.type.startsWith("image/")) { continue }
			else if (file.type == "image/svg+xml") { backgrounds.push(Background.processSVG(await file.text())) }
			else {
				const reader = new FileReader()
				reader.addEventListener("load", (event) => { backgrounds.push(Background.processImage(event)) })
				// TODO: vvv Improve this
				reader.addEventListener("error", () => { console.log("Error while reading file") })

				reader.readAsDataURL(file)
			}
		}

		// NOTE: This can very easly become a progress bar
		while (backgrounds.length != event.target.files.length) {
			await new Promise(r => setTimeout(r))
			// console.log(backgrounds.length, event.target.files.length)
		}

		

		WebdeskEvent.BACKGROUND_UPLOAD.emit({ backgrounds: backgrounds })
	}
	processSVG(event) {
		return event
	}
	processImage(event) {
		return `<img src="${event.target.result}"/>`
	}
	async showAllBackgroundsPreviews() {
		const backgrounds = await webdeskDB.getAll("_backgrounds")

		for (let i = backgrounds.length - 1; i >= 0; i--) {
			Background.addPreview(i, backgrounds[i])
		}
	}
	addPreview(id, content, asFirst = false) {
		const preview = document.createElement("button")
		preview.classList.add("preview")
		preview.setAttribute("title", "Set this as the background")

		preview.innerHTML = content
		preview.setAttribute("bgID", id)
		preview.addEventListener("click", Background.loadBackground)

		if (asFirst) { this.previewsWrapper.prepend(preview) }
		else { this.previewsWrapper.append(preview) }
	}
	async loadBackground(event) {
		const backgroundID = parseInt(event.target.getAttribute("bgID"))
		const backgroundContent = await webdeskDB.get("_backgrounds", backgroundID)

		WebdeskEvent.BACKGROUND_LOAD.emit({ id: backgroundID, background: backgroundContent })
	}
	removeAllBackgrounds() {
		WebdeskEvent.BACKGROUND_REMOVE_ALL.emit({})
		// TODO: Remove all previews
	}

	constructor() {
		this.uploadButton.addEventListener("input", this.manageUpload)
		this.deleteButton.addEventListener("click", this.removeAllBackgrounds)

		this.showAllBackgroundsPreviews()

		webdeskDB.getAll("_backgrounds", "last-ID").then((backgrounds) => { Background.saveID = backgrounds.length - 1 })
	}
}

const Animations = new class {
	constructor() {
		
	}
}

/* BEBUGGGG BEBUUUUUGGG */
let subSection = mainElement.querySelector(`div[backgrounds]`)
currentSubSection.style.display = "none"
subSection.style.display = "flex"
currentSubSection = subSection