// Biggest (possible) vulnerability ever in this OS

let originResolve
let webdeskOrigin = new Promise(res => originResolve = res)
let currentPalette = {}

function com({ data: message }) {
	switch(message.command) {
		case "init": { return init(message.data) }
		case "palette": { return saveStyle(message.data) }
	}
}

function init({ palette, origin }) {
	currentPalette = palette
	originResolve(origin)
}

function loadVars() {
	const paletteRules = [ ]
	for (const [ color, value ] of Object.entries(currentPalette)) { paletteRules.push(`--${color}: ${value};`) }
	document.body.setAttribute("style", `${paletteRules.join("")}`)
}

function saveStyle({ palette }) {
	if (document.readyState === "complete") loadVars()
	else (setTimeout(saveStyle, 100))
}

window.addEventListener("message", com)

window.sendWebdesk = async function(message) {
	window.parent.postMessage(message, (await webdeskOrigin))
}