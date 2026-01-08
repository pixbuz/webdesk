const socket = new WebSocket("/")
const mainElement = document.querySelector("main")

let currentSubSection = mainElement.querySelector(`div[name="Colors"]`)

function serverQuery(message) {
	socket.send(message)

	return new Promise(resolve =>
		socket.addEventListener("message",
			response => resolve(response.data), { once: true }
		)
	)
}

function show(subSectionName) {
	const subSection = mainElement.querySelector(`div[name="${subSectionName}"]`)

	currentSubSection.style.display = "none"
	subSection.style.display = "block"

	currentSubSection = subSection
}

socket.addEventListener("open", async () => {
	const jsonStylingObject = await serverQuery("settings list")
	console.log(jsonStylingObject)
})