const windowCommandChannel = new BroadcastChannel("wm/commands")
const mainElement = document.querySelector("main")

let currentSubSection = mainElement.querySelector(`div[name="Colors"]`)
let WebdeskDatabase

function show(subSectionName) {
	// Show a Section when clicking on the Aside menu Entry
	const subSection = mainElement.querySelector(`div[name="${subSectionName}"]`)

	currentSubSection.style.display = "none"
	subSection.style.display = "block"
	currentSubSection = subSection
}

function init() {
	const dbVersion = localStorage.getItem("db-version")
	const openRequest = indexedDB.open("webdesk", dbVersion)
	openRequest.onsuccess = () => {
		const transaction = openRequest.result.transaction("settings", "readonly")
		const store = transaction.objectStore("settings")
		const read = store.get("dbclass")
		read.onsuccess = () => {
			const RestoredClass = new Function("return " + read.result)()
			const WebdeskDatabase = new RestoredClass()
			console.log(WebdeskDatabase)
		}
	}
}

init()