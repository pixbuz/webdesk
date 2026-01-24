const mainElement = document.querySelector("main")
const ThemeUpdateChannel = new BroadcastChannel("theme")

let currentSubSection = mainElement.querySelector(`div[name="Colors"]`)
let varToTheme = {}

let theme

function show(subSectionName) {
	// Show a Section when clicking on the Aside menu Entry
	const subSection = mainElement.querySelector(`div[name="${subSectionName}"]`)

	currentSubSection.style.display = "none"
	subSection.style.display = "block"
	currentSubSection = subSection
}

const cssVars = []
function mapCssVars(root, prefix = "") {
	for (const key of Object.keys(root)) {
		if (root[key] instanceof Object) { mapCssVars(root[key], `${prefix ? prefix + "-" : ""}${key}`) }
		else {
			cssVars[`${prefix}-${key}`] = root[key]
			varToTheme[`${prefix}-${key}`] = root
		}
	}
}

function previewTheme(target, value) {
	const cssVar = target.getAttribute("name")

	window.parent.document.documentElement.style.setProperty(`--${cssVar}`, value)
}

function updateTheme(target, value) {
	const cssVar = target.getAttribute("name")

	varToTheme[cssVar][cssVar.split("-").at(-1)] = value
	theme.customName = "undefined"
	localStorage.setItem("customization", JSON.stringify(theme))
	ThemeUpdateChannel.postMessage("theme updated")
}

function initColorsSection() {
	const section = document.querySelector(`div[name="Colors"]`)
	const customization = localStorage.getItem("customization")

	theme = JSON.parse(customization)
	mapCssVars(theme["colors"], null)

	for (const colorPicker of section.querySelectorAll(`input[type="color"]`)) {
		colorPicker.setAttribute("value", cssVars[colorPicker.getAttribute("name")])
		colorPicker.addEventListener("input", (event) => { previewTheme(event.target, event.target.value) })
		colorPicker.addEventListener("change", (event) => { updateTheme(event.target, event.target.value) })
	}
}

function init() {
	initColorsSection()
}

ThemeUpdateChannel.addEventListener("message", init)

init()