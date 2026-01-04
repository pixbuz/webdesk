/* 
 * Responsible for spawning the different
 * app launchers at page load
*/

const socket = new WebSocket("http://localhost:3720")
const launcherSpace = document.querySelector(".Launcher.Space")
const assetsLauncher = document.getElementsByName("Launcher")[0]

function serverQuery(message) {
	// This is more of a util function
	// but it stays here for now
	// TODO: Make more robust using IDs, if necessary
	socket.send(message)

	return new Promise(resolve =>
		socket.addEventListener("message",
			response => resolve(response.data), { once: true }
		)
	)
}

async function addLauncher(appName) {
	// Add the launcher of a app
	const launcher = assetsLauncher.cloneNode(true)
	const description = await serverQuery(`app desc ${appName}`)
	launcherSpace.appendChild(launcher)

	launcher.setAttribute("app", appName)
	launcher.setAttribute("title", description == "undefined" ? "" : description)

	launcher.querySelector(".Name").innerText = appName
	launcher.querySelector(".Icon").src = `apps/${appName}/icon`
}