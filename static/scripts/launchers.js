/* 
 * Responsible for spawning the different
 * app launchers at page load
*/

const launcherSpace = document.querySelector(".Launcher.Space")
const assetsLauncher = document.getElementsByName("Launcher")[0]

function addLaunchers(appsManifests) {
	// Add the launcher of all installed webdesk apps
	const appNames = Object.keys(appsManifests)
	
	appNames.sort().map((appName) => {
		const launcher = assetsLauncher.cloneNode(true)
		const description = appsManifests[appName].description
		launcherSpace.appendChild(launcher)

		launcher.setAttribute("app", appName)
		launcher.setAttribute("title", description == "undefined" ? appName : description)

		launcher.querySelector(".Name").innerText = appName
		launcher.querySelector(".Icon").src = `apps/${appName}/icon`
	})
}