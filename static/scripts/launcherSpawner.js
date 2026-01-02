const socket = new WebSocket("http://localhost:3720")
const launcherSpace = document.querySelector(".Launcher.Space")
const assetsLauncher = document.getElementsByName("Launcher")[0]

async function addLauncher(appName) {
	const launcher = assetsLauncher.cloneNode(true)
	const description = await serverQuery(`app desc ${appName}`)
	launcherSpace.appendChild(launcher)

	launcher.setAttribute("app", appName)
	launcher.setAttribute("title", description == "undefined" ? "" : description)

	launcher.querySelector(".Name").innerText = appName
	launcher.querySelector(".Icon").src = `apps/${appName}/icon`
}