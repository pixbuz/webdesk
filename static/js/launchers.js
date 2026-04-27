import { WebdeskEvent, ApplicationManifests } from "./core"

const space = document.querySelector(".Launcher.Space")
let includeText = true

function addLauncher(name, manifest) {
	const launcherWrapper = document.createElement("button"),
		title = document.createElement("span"),
		icon = document.createElement("img")

	icon.classList.add("icon")
	icon.setAttribute("fetchpriority", "high")
	icon.setAttribute("alt", `Application ${name}'s icon`)
	icon.src = `${window.location.protocol}//${name}.${window.location.hostname}/icon`

	title.classList.add("name")
	title.innerText = name

	launcherWrapper.setAttribute("launcher", name)
	launcherWrapper.setAttribute("title", manifest.description == "undefined" ? name : manifest.description)
	launcherWrapper.append(icon, title)

	space.appendChild(launcherWrapper)
}

function queueLaunchers(manifests) {
	for (const [ name, manifest ] of Object.entries(manifests).sort()) {
		if (manifest.service) { continue }
		else { addLauncher(name, manifest) }
	}
}

/** @param {Event} data */
function launcherClicked({ target }) {
	const launcher = target.closest("[launcher]")
	const app = launcher.getAttribute("launcher")
	const manifest = ApplicationManifests[app]
	WebdeskEvent.LAUNCHER_CLICK.emit({ app, manifest })
}

WebdeskEvent.MANIFESTS_READY.on(queueLaunchers)
space.addEventListener("click", launcherClicked)