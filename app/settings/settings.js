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

async function init() {
	// Connect to the Webdesk Database using the class
	const dbVersion = localStorage.getItem("db-version")
	const openRequest = indexedDB.open("webdesk", dbVersion)

	openRequest.onsuccess = () => {
		// Do all the things to read webdesk -> settings/dbclass
		const transaction = openRequest.result.transaction("settings", "readonly")
		const store = transaction.objectStore("settings")
		const read = store.get("dbclass")

		// Once red, create the Database Class
		read.onsuccess = async () => {
			const WebdeskDatabasePrototype = new Function(read.result)()
			WebdeskDatabase = new WebdeskDatabasePrototype()
		}
	}

	// Wait for the Database to be available
	while(!WebdeskDatabase) { await new Promise((res) => setTimeout(res)) }

	console.log(WebdeskDatabase)
}

init()