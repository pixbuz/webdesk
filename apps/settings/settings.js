const webdeskDB = window.parent.webdeskDB

const mainElement = document.querySelector("main")
let currentSubSection = mainElement.children[0]

function show(button) {
	const subSectionName = button.getAttributeNames().at(0)
	const subSection = mainElement.querySelector(`div[${subSectionName}]`)

	currentSubSection.style.display = "none"
	subSection.style.display = "block"
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

const Background = new class {
	reader = new FileReader()
	button = mainElement.querySelector("#bgUpload")
	saveID = 0

	async manageUpload(event) {
		for (let i = 0; i < event.target.files.length; i++) {
			const file = event.target.files[i]

			if (!file.type.startsWith("image/")) { continue }
			else if (file.type == "image/svg+xml") { processSVG(await file.text()) }
			else { Background.reader.readAsDataURL(file) }
		}
	}
	processSVG(event) {
		const background = event
		Background.uploadBackgroundToDB(background)
	}
	processImage(event) {
		const background = `<img src="${event.target.result}"/>`
		Background.uploadBackgroundToDB(background)
	}
	async uploadBackgroundToDB(uploadedBG) {
		const savedBackgrounds = await webdeskDB.getAll("_backgrounds")
		const ID = Background.saveID += 1

		if (savedBackgrounds.includes(uploadedBG)) { return savedBackgrounds.indexOf(uploadedBG) }

		await webdeskDB.set("_backgrounds", ID, uploadedBG)
		await webdeskDB.set("_backgrounds", "last-ID", ID)

		const event = new CustomEvent("newBackground", { detail: { id: Background.saveID, content: uploadedBG }})
		window.parent.dispatchEvent(event)
		console.log("evented")
	}

	constructor() {
		this.reader.addEventListener("load", this.processImage)
		this.reader.addEventListener("error", () => { console.log("Error while reading file") })

		this.button.addEventListener("input", this.manageUpload)

		webdeskDB.get("_backgrounds", "last-ID").then((lastID) => { Background.saveID = lastID })
	}
}

const Animations = new class {
	constructor() {
		
	}
}

/* BEBUGGGG BEBUUUUUGGG */
let subSection = mainElement.querySelector(`div[backgrounds]`)
currentSubSection.style.display = "none"
subSection.style.display = "block"
currentSubSection = subSection