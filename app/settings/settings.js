const roomID = document.location.search.slice(1)
const socket = new WebSocket(`/${roomID}`)

socket.addEventListener("message", event => {
	console.log(event.data)
})

socket.addEventListener("open", () => {
	socket.send("client get settings")
})