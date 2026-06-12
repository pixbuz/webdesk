import { log, WebdeskEvent } from "@webdesk/"

class Time {
	static syncInterval = 1000 * 60 * 5 // 5 Minutes

	startMills = 0
	seconds = 0
	minutes = 0
	hours = 0
	day = 0
	month = 0
	year = 0

	sync = () => {
		const dateObj = new Date()
		this.seconds = dateObj.getSeconds()
		this.minutes = dateObj.getMinutes()
		this.hours = dateObj.getHours()
		this.day = dateObj.getDate()
		this.month = dateObj.getMonth() + 1
		this.year = dateObj.getFullYear()
		this.startMills = dateObj.getMilliseconds()
		
		WebdeskEvent("TIME UPDATED", this)
	}
	advance = () => {
		const totalSeconds = this.seconds + 1
		const totalMinutes = this.minutes + Math.floor(totalSeconds / 60)
		const totalHours = this.hours + Math.floor(totalMinutes / 60)
		
		this.seconds = totalSeconds % 60
		this.minutes = totalMinutes % 60
		this.hours = totalHours % 24

		if (totalHours >= 24) this.sync()
		else WebdeskEvent("TIME UPDATED", this)
	}

	constructor() {
		this.sync()
		
		setTimeout(() => {
			this.advance()
			setInterval(this.advance, 1000)
		}, 1000 - this.startMills)
		setInterval(this.sync, Time.syncInterval)
	}
}

class Dock extends HTMLElement {
	openAppsElement = document.createElement("div")
	timeWrapper = document.createElement("div")
	timeElement = document.createElement("p")
	dateElement = document.createElement("p")

	updateClock({ seconds, minutes, hours, day, month, year }) {
		dock.timeElement.innerText = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
		dock.dateElement.innerText = `${day.toString().padStart(2, "0")}/${month.toString().padStart(2, "0")}/${year}`
	}
	setupClock() {
		WebdeskEvent.on("TIME UPDATED", dock.updateClock)
		this.time = new Time()
		this.timeWrapper.setAttribute("time", "")
		this.timeWrapper.append(this.timeElement, this.dateElement)
	}
	setupOpenApp() {
		WebdeskEvent.on("LAUNCHER CLICK", dock.addApp)
		WebdeskEvent.on("WINDOW CLOSE", dock.removeApp)

		this.openAppsElement.setAttribute("open", "")
	}
	addApp({ domain, icon }) {
		if (openApps.includes(domain)) return
		const iconElement = document.createElement("img")
		openApps.push(domain)
		iconElement.src = icon
		iconElement.setAttribute("icon", domain)
		iconElement.onclick = iconClick
		dock.openAppsElement.append(iconElement)
	}
	removeApp({ domain }) {
		const icon = dock.openAppsElement.querySelector(`[icon="${domain}"]`)
		openApps.splice(openApps.indexOf(domain), 1)
		if (icon) icon.remove()
	}

	connectedCallback() {
		this.setAttribute("dock", "")
		this.setupClock()
		this.setupOpenApp()
		
		this.append(
			this.openAppsElement,
			this.timeWrapper,
		)
	}

	constructor() { super() }
}

function iconClick({ target }) {
	const appName = target.getAttribute("icon")
	const appWindow = document.querySelector(`[window="${appName}"]`)
	if (appWindow.classList.contains("minimise")) return appWindow.resume()
	appWindow.suspend()
}

const dock = document.createElement("webdesk-dock")
const openApps = [ ]

customElements.define("webdesk-dock", Dock)

document.body.appendChild(dock)

log.verb("Dock ready")