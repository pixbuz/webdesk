import { log } from "@webdesk/"
import { ApplicationsDomainToName, ApplicationsDomainToIconUrl } from "@launchers/"

class Notification extends HTMLElement {
	static customElementTag = "webdesk-notification"

	titleElement = document.createElement("p")
	title = ""
	messageElement = document.createElement("p")
	message = ""
	iconElement = document.createElement("img")
	icon = ""
	callerElement = document.createElement("p")
	caller = ""
	
	wrapperElement = document.createElement("div")

	connectedCallback() {
		this.titleElement.innerText = this.title ?? ""
		this.titleElement.setAttribute("heading", "")
		
		this.callerElement.innerText = this.caller
		this.callerElement.setAttribute("caller", "")
		
		this.messageElement.innerText = this.message ?? ""
		this.messageElement.setAttribute("message", "")

		this.wrapperElement.setAttribute("textwrapper", "")
		this.wrapperElement.append(this.callerElement, this.titleElement, this.messageElement)

		this.iconElement.src = this.icon
		this.iconElement.setAttribute("icon", "")

		this.append(this.iconElement, this.wrapperElement)
		this.setAttribute("notification", "")
	}

	constructor() {
		super()
	}
}

export function showNotification(title, message, time = 5000, caller = getCallerDomain(), iconSrc = ApplicationsDomainToIconUrl[caller]) {
	const notification = document.createElement("webdesk-notification")
	log.verb(`Showing notification "${title}" (from caller "${caller}") for ${time} milliseconds`)
	notification.title = title
	notification.caller = ApplicationsDomainToName[caller] ?? caller
	notification.message = message
	notification.icon = iconSrc
	space.appendChild(notification)
	setTimeout(() => {
		// notification.remove()
		log.verb(`Hidden notification "${title}" (from caller "${caller}")`)
	}, time)
}

function getCallerDomain() {
	const err = new Error()
	const stack = err.stack.split('\n')
	const callerUrl = stack.at(-1)
	const callerDomain = callerUrl.match(/\/srv\/([^\/]+)\//)
	if (!callerDomain) return callerUrl.trim().substring(window.location.href.length)
	return callerDomain[1]
}

const space = document.createElement("section")
space.setAttribute("space", "notification")
customElements.define(Notification.customElementTag, Notification)

document.body.appendChild(space)
log.verb("Notifications ready")