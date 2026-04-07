import { ApplicationManifests, WebdeskEvent } from "./core"

const space = document.querySelector(".Launcher.Space")
let includeText = true

function addLauncher(appName, manifest) {
	const launcherWrapper = document.createElement("button"),
		title = document.createElement("span"),
		icon = document.createElement("img")

	icon.classList.add("icon")
	icon.src = `${window.location.protocol}//${appName}.${window.location.hostname}/icon`
	icon.setAttribute("fetchpriority", "high")
	icon.setAttribute("alt", `Application "${appName}"'s icon`)

	title.classList.add("name")
	title.innerText = appName

	launcherWrapper.setAttribute("launcher", appName)
	launcherWrapper.setAttribute("title", manifest.description == "undefined" ? appName : manifest.description)
	launcherWrapper.append(icon, title)

	space.appendChild(launcherWrapper)

	launcherWrapper.addEventListener("click", () => { WebdeskEvent.LAUNCHER_CLICK.emit({ app: appName }) })
}

/** @param {import("./core").CustomizationData} data */
function updateTitles({ object }) {
	includeText = object.launchers.appearance.text

	if (includeText) { space.classList.add("showTitles") }
	else { space.classList.remove("showTitles") }
}

/** @param {import("./core").CustomizationData} data */
function queueLaunchers({ object }) {
	includeText = object.launchers.appearance.text

	for (const appName of Object.keys(ApplicationManifests).sort()) {
		if (ApplicationManifests[appName].service) { continue }
		else { addLauncher(appName, ApplicationManifests[appName]) }
	}
}

WebdeskEvent.CUSTOMIZATION_LOADED.on(queueLaunchers, updateTitles)
WebdeskEvent.CUSTOMIZATION_CHANGE_SAVED.on(updateTitles)