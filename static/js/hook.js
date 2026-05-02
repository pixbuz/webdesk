let webdeskOrigin

function com({ data: message }) {
	switch(message.command) {
		case "init": { return initStyle(message.data) }
		case "palette": { return initStyle(message.data) }
	}
}

function initStyle({ palette }) {
	const paletteRules = [ ]
	for (const [ color, value ] of Object.entries(palette)) { paletteRules.push(`--${color}: ${value};`) }
	document.body.setAttribute("style", `${paletteRules.join("")}`)
}

window.addEventListener("message", com)