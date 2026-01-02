function serverQuery(message) {
	socket.send(message)
	return new Promise(resolve =>
		socket.addEventListener("message",
			response => resolve(response.data), { once: true }
		)
	)
}