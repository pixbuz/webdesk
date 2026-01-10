/* 
 * Responsible for spawning the different
 * app launchers at page load
*/

const launcherSpace = document.querySelector(".Launcher.Space")
const assetsLauncher = document.getElementsByName("Launcher")[0]

function addLauncher(appName, description) {
	// Add the launcher of a app
	const launcher = assetsLauncher.cloneNode(true)
	launcherSpace.appendChild(launcher)

	launcher.setAttribute("app", appName)
	launcher.setAttribute("title", description == "undefined" ? appName : description)

	launcher.querySelector(".Name").innerText = appName
	launcher.querySelector(".Icon").src = `apps/${appName}/icon`
}