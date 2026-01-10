const databaseOpenRequest = indexedDB.open("webdesk")
const broadcastChannel = new BroadcastChannel("settings")

databaseOpenRequest.addEventListener("success", () => { console.log(databaseOpenRequest.result) }, { once: true })
broadcastChannel.postMessage("lmao")

function testFunction() {
	console.log("aight")
}