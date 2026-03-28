import { WebdeskEvent } from "./core"

const space = document.querySelector(".Launcher.Space")

function addLauncher(appName, manifest) {
	const launcherWrapper = document.createElement("button"),
		title = document.createElement("span"),
		icon = document.createElement("img")

	icon.classList.add("icon")
	icon.src = `/apps/${appName}/${manifest.icon}`
	icon.setAttribute("fetchpriority", "high")
	icon.setAttribute("alt", `Application "${appName}"'s icon`)

	launcherWrapper.setAttribute("launcher", appName)
	launcherWrapper.setAttribute("title", manifest.description == "undefined" ? appName : manifest.description)
	launcherWrapper.append(icon, title)

	title.classList.add("name")
	title.innerText = appName

	space.appendChild(launcherWrapper)

	launcherWrapper.addEventListener("click", () => { WebdeskEvent.LAUNCHER_CLICK.emit({ app: appName }) })
}

/** @param {EmptyTemplate} manifests */
function queueLaunchers(manifests) {
	for (const appName of Object.keys(manifests).sort()) {
		if (manifests[appName].service) { continue }
		else { addLauncher(appName, manifests[appName]) }
	}
}

WebdeskEvent.MANIFESTS_READY.on(queueLaunchers)