// TODO: Improve backgrounds upload with a frontend element/thing informing about skips cuz duplicates
// TODO: Deprecate UI and have single elements do their styling
// TODO: FULL SEMANTIC SYSTEM AAAAAAA

import { WebdeskEvent, webdeskDB } from "./core"

const defaultPalette = {
	primary: "",

	secondary1: "",
	secondary2: "",

	tertiary1: "",
	tertiary2: "",
	tertiary3: "",

	general1: "rgb(8, 8, 8)",
	general2: "rgb(24, 24, 24)",
	general3: "rgb(128, 128, 128)",
	general4: "rgb(248, 248, 248)",
}

const customizationSheet = new CSSStyleSheet()
document.adoptedStyleSheets.push(customizationSheet)

function applyCustomizationEntry(cssVar, value) {
	const target = cssVar.substring(2, cssVar.indexOf("-", 3))
	const cssProprety = cssVar
		.substring(target.length + 3)
		.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
	return [ `[${target}]`, ` ${cssProprety}: var(${cssVar})` ]
}

function saveCustomizationEntry(cssVar, value) {
	const normalizedCssVar = cssVar.replace("---", "--")
	return `${normalizedCssVar}: ${value}`
}

function parseCustomization(customization) {
	const condensed = { ":root": [] }
	for (const [ cssVar, value ] of Object.entries(customization)) {
		condensed[":root"].push(saveCustomizationEntry(cssVar, value))

		if (!cssVar.startsWith("---")) {
			const [ target, proprety ] = applyCustomizationEntry(cssVar, value)
			
			if (!condensed[target]) { condensed[target] = [] }
			condensed[target].push(proprety)
		}
	}
	
	for (const [ target, proprieties ] of Object.entries(condensed)) {
		customizationSheet.insertRule(`${target} { ${proprieties.join(";\n")} }`)
		console.log(`${target} { ${proprieties.join(";\n")} }`)
	}
	
}

parseCustomization({
	"---animation-test": "test",

	"--window-height": "20vh",
	"--window-min-height": "2vh",
	"--window-width": "20vw",
	"--window-min-width": "2vw",
})