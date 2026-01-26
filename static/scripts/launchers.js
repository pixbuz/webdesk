const launcherSpace = document.querySelector(".Launcher.Space")
const assetsLauncher = document.getElementsByName("Launcher")[0]

function addLaunchers(appsManifests) {
	// Add the Launchers of all Installed Apps
	const appNames = Object.keys(appsManifests)
	
	// For every Installed App:
	appNames.sort().map((appName) => {
		// Add a Launcher to the Launcher Space
		const launcher = assetsLauncher.cloneNode(true)
		const description = appsManifests[appName].description
		launcherSpace.appendChild(launcher)

		// Add the Interaction Event Listener
		launcher.addEventListener("click", openWindow)

		// Set the appropriate Proprieties
		launcher.setAttribute("app", appName)
		launcher.setAttribute("title", description == "undefined" ? appName : description)
		launcher.querySelector(".Name").innerText = appName
		launcher.querySelector(".Icon").src = `apps/${appName}/icon`

		// !!! !!! !!!
		// DEBUG !!! !!! !!!
		if (appName == "settings") launcher.dispatchEvent(new Event("click"))
	})
}