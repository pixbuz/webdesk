const socket = new WebSocket("http://localhost:3720")
let lastQuery = ""

socket.addEventListener("open", requestApplications)
socket.addEventListener("message", socketInterpreter)

function requestApplications() {
	socket.send(lastQuery = "?apps")
}

function socketInterpreter(event) {
	switch(lastQuery.slice(1)) {
		case "apps":
			initializeDesktop(event.data.slice(1))
			break
	}
}

function initializeDesktop(apps) {
	for (name of apps.split(",")) {
		addLauncher(name)
	}
}

function addLauncher(appName) {
	const assetsLauncher = document.getElementsByName("Launcher")[0]
	const launcherSpace = document.getElementsByClassName("Launcher")[0]

	const launcher = assetsLauncher.cloneNode(true)
	launcherSpace.appendChild(launcher)

	launcher.querySelector(".Name").innerText = appName
	launcher.querySelector(".Icon").src = `apps/${appName}/icon`
}