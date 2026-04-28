const entriesContainer = document.querySelector(".latest")
const searchInput = document.querySelector(".hero input")

// 1. We keep a master list of all entries in memory
let masterEntries = []
let titlebarCom
let webdeskCom

async function init() {
	const res = await fetch("/api/getEntries")
	const data = await res.json()
	
	// Convert the object into an array of flat objects for easier sorting
	masterEntries = Object.entries(data).map(([name, details]) => ({
		name,
		...details
	}))

	// Sort by date (Newest first) initially
	sortByDate(masterEntries)
	renderEntries(masterEntries)
}

// 2. The Search Listener
searchInput.addEventListener("input", (e) => {
	const query = e.target.value.toLowerCase().trim()
	
	// If the search is empty, just show everything sorted by date again
	if (!query) {
		sortByDate(masterEntries)
		renderEntries(masterEntries)
		return
	}

	// Split the search query into individual words (ignoring extra spaces)
	const keywords = query.split(/\s+/)

	// 3. The Scoring Engine
	const scoredEntries = masterEntries.map(entry => {
		let score = 0
		// We search both the title and the extract for better results
		const textToSearch = (entry.name + " " + entry.extract).toLowerCase()
		
		for (const word of keywords) {
			// A fast way to count occurrences of a word in a string
			const occurrences = textToSearch.split(word).length - 1
			score += occurrences
		}

		// Return a new object that includes the calculated score
		return { ...entry, score }
	})

	// Filter out entries with 0 score, then rank them
	const results = scoredEntries
		.filter(entry => entry.score > 0)
		.sort((a, b) => {
			// Highest score goes to the top
			if (b.score !== a.score) {
				return b.score - a.score
			}
			// If there is a tie in score, sort by newest date
			return parseDate(b.date) - parseDate(a.date)
		})

	renderEntries(results)
})

// --- Helper Functions ---

function renderEntries(entriesArray) {
	// Clear the current grid
	entriesContainer.innerHTML = ""
	
	// Generate the new cards
	for (const entry of entriesArray) {
		addEntry(entry.name, entry.extract, entry.date)
	}
}

function parseDate(dateStr) {
	const [day, month, year] = dateStr.split("/")
	return new Date(`${year}-${month}-${day}`).getTime()
}

function sortByDate(array) {
	array.sort((a, b) => parseDate(b.date) - parseDate(a.date))
}

function addEntry(name, extract, date) {
	const element = document.createElement("a")
	const title = document.createElement("h1")
	const creationDate = document.createElement("p")
	const extractWrapper = document.createElement("p")
	const cover = document.createElement("img")
	const info = document.createElement("div")
	
	const safeName = encodeURIComponent(name)

	title.textContent = name.replace(".md", "")
	title.className = "title"
	
	creationDate.textContent = date
	creationDate.className = "date"
	
	extractWrapper.textContent = extract
	extractWrapper.className = "extract"

	info.className = "info"
	info.append(title, creationDate, extractWrapper)

	cover.src = `/api/cover?${safeName}`
	cover.className = "cover"
	cover.loading = "lazy"
	
	element.href = `/api/entry?${safeName}`
	element.className = "entry"
	element.append(cover, info)

	entriesContainer.append(element)
}

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

init()