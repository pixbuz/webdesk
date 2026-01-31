const mainElement = document.querySelector("main")
let currentSubSection = mainElement.querySelector(`div[name="Colors"]`)

function show(subSectionName) {
	// Show a Section when clicking on the Aside menu Entry
	const subSection = mainElement.querySelector(`div[name="${subSectionName}"]`)

	currentSubSection.style.display = "none"
	subSection.style.display = "block"
	currentSubSection = subSection
}

console.log(window.parent.utilities)