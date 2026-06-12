import { log, WebdeskEvent } from "@webdesk/"

class Launcher extends HTMLElement {
	domain = ""
	name = ""
	iconURL = ""
	iconBlob
	nameElement = document.createElement("p")
	iconElement = document.createElement("img")

	#click() {
		WebdeskEvent("LAUNCHER CLICK", { domain: this.domain, name: this.name, icon: this.iconURL })
	}
	async #setupIcon() {
		const request = await fetch(`/app/${this.domain}/icon`)
		if (request.ok) {
			this.iconBlob = await request.blob()
			this.iconElement.src = this.iconURL = URL.createObjectURL(this.iconBlob)
		} else this.iconElement.remove()
	}

	connectedCallback() {
		this.domain = this.getAttribute("launcher")
		this.#setupIcon()
		
		this.nameElement.innerText = this.name = this.getAttribute("name")
		this.onclick = this.#click
		
		this.nameElement.classList.add("text")
		this.iconElement.classList.add("icon")
		this.append(this.iconElement, this.nameElement)
	}
	
	constructor() { super() }
}

customElements.define("webdesk-launcher", Launcher)

log.verb("Launchers ready")
