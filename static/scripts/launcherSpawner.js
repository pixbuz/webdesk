/* 
 * Responsible for spawning the different
 * app launchers at page load
*/

const launcherSpace = document.querySelector(".Launcher.Space")
const assetsLauncher = document.getElementsByName("Launcher")[0]

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