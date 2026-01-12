const windowCommandChannel = new BroadcastChannel("wm/commands")
const settingsCheck = new BroadcastChannel("settings/openAlreadyCheck")

const mainElement = document.querySelector("main")
const windowID = window.location.search.slice(1)
const settingsDB = openDB()

let currentSubSection = mainElement.querySelector(`div[name="Colors"]`)
let openFlag = false

function openDB() {
	// Accesses the Database
	const openRequest = indexedDB.open("webdesk")

	return new Promise((res) => {
		openRequest.onsuccess = () => { res(openRequest.result) }
	})
}

function show(subSectionName) {
	// Show a Section when clicking on the Aside menu Entry
	const subSection = mainElement.querySelector(`div[name="${subSectionName}"]`)

	currentSubSection.style.display = "none"
	subSection.style.display = "block"
	currentSubSection = subSection
}

function checkIfAlreadyOpen() {
	settingsCheck.onmessage = closeIfMessage
	settingsCheck.postMessage("open?")
	setTimeout(() => { settingsCheck.onmessage = messageIfMessage }, 1000)
}

function messageIfMessage() {
	windowCommandChannel.postMessage(`open`)
}

function closeIfMessage() {
	windowCommandChannel.postMessage(`close ${windowID}`)
}

window.addEventListener("load", async () => {
	await settingsDB
	checkIfAlreadyOpen()
})
