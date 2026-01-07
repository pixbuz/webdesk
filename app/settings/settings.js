const socket = new WebSocket("/")
const settingsTitle = document.querySelector(".CurrentSection")
const mainElement = document.querySelector("main")

let subCategories = []
let subTresholds = []

function updateTitle(event) {
	const scroll = event.target.scrollTop
	let subIndex

	for (let i in subTresholds) {
		if (scroll >= subTresholds[i] && scroll <= subTresholds[i + 1]) subIndex = i
	}

	settingsTitle.innerHTML = `${subCategories[subIndex].getAttribute("data-category")} <span>${subCategories[subIndex].getAttribute("data-subcategory")}</span>`
}

function resizeEvent() {
	subCategories = []
	subTresholds = []

	for (category of mainElement.getElementsByTagName("section")) {
		for (sub of category.getElementsByTagName("div")) {
			const subBoundingBox = sub.getBoundingClientRect()
			subTresholds.push(subBoundingBox.top)
			subCategories.push(sub)
		}
	}
}

window.addEventListener("resize", resizeEvent)
mainElement.addEventListener("scroll", updateTitle)

resizeEvent()