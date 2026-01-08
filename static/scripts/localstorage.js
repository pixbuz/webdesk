socket.addEventListener("message", serverSocketResponder)

function serverSocketResponder(messageEvent) {
	const command = messageEvent.data.split(" ")
	switch(command) {
		case "get":
		case "set":
	}
}

function serverSocketGetHandler() {

}

function serverSocketSetHandler() {
	
}