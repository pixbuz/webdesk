/*
 * Interacts with the Indexed DB on the client side
*/

async function loadIndexDBChecks(appsJSON) {
	// Sets up the client browser in order to make webdesk work
	const appNames = Object.keys(appsJSON)
	const database = await openIndexDB(appNames)

	const transaction = database.transaction(["Global"], "readwrite")
	const store = transaction.objectStore("Global")

	store.get("userID").onsuccess = event => { if (event.target.result == undefined) { store.put(crypto.randomUUID(), "userID") } }
	store.get("userID").onsuccess = event => { if (event.target.result == undefined) { store.put(crypto.randomUUID(), "userID") } }
}

function initDB(database, appNames) {
	console.log("Upgrading Database")

	database.createObjectStore("Global")
	for (const app of appNames) { database.createObjectStore(app) }
}

function openIndexDB(appNames) {
	const databaseOpenRequest = indexedDB.open("webdesk")

	return new Promise((res, rej) => {
		databaseOpenRequest.addEventListener("success", () => { res(databaseOpenRequest.result) }, { once: true })
		databaseOpenRequest.addEventListener("upgradeneeded", () => { initDB(databaseOpenRequest.result, appNames) }, { once: true })

		databaseOpenRequest.addEventListener("error", event => { rej(event) }, { once: true })
		databaseOpenRequest.addEventListener("blocked", event => { rej(event) }, { once: true })
	})
}