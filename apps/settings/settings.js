const mainElement = document.querySelector("main")
const webdeskDB = window.parent.webdeskDB
const UIManager = window.parent.UIManager
let currentSubSection = mainElement.children[0]

function show(button) {
	const subSectionName = button.getAttributeNames().at(0)
	const subSection = mainElement.querySelector(`div[${subSectionName}]`)

	currentSubSection.style.display = "none"
	subSection.style.display = "block"
	currentSubSection = subSection
}

async function managebgUpload(event) {
	for (let i = 0; i < event.target.files.length; i++) {
		const file = event.target.files[i]
		const reader = new FileReader()

		reader.addEventListener("error", () => { console.log("Error while reading file") })
		reader.addEventListener("load", processImage)

		if (!file.type.startsWith("image/")) { continue }
		else if (file.type == "image/svg+xml") { processSVG(await file.text()) }
		else { reader.readAsDataURL(file) }
	}
}

async function processSVG(event) {
	const background = event
	const uploadedBGID = await uploadToDB(background)

	UIManager.loadBackground(uploadedBGID)
}

async function processImage(ReaderLoadEvent) {
	const background = `<img src="${event.target.result}" />`
	const uploadedBGID = await uploadToDB(background)

	UIManager.loadBackground(uploadedBGID)
}

async function uploadToDB(uploadedBG) {
	const backgroundID = await webdeskDB.get("_backgrounds", "last-ID")
	const savedBackgrounds = await webdeskDB.getAll("_backgrounds")

	if (savedBackgrounds.includes(uploadedBG)) { return savedBackgrounds.indexOf(uploadedBG) }

	await webdeskDB.set("_backgrounds", (backgroundID + 1), uploadedBG)
	await webdeskDB.set("_backgrounds", "last-ID", (backgroundID + 1))

	return (backgroundID + 1)
}

mainElement.querySelector("[bgUpload]").addEventListener("input", managebgUpload)