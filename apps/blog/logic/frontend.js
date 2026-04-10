const entries = document.querySelector(".latest")

async function init() {
	const entriesRequest = await fetch("/api/getEntries")
	const entriesText = await entriesRequest.text()
	const entries = JSON.parse(entriesText)

	for (const [ name, { html, preview, extract } ] of Object.entries(entries)) {
		addEntry(name, html, preview, extract)
	}
}

function addEntry(name, html, preview, extract) {
	const element = document.createElement("a"),
		title = document.createElement("h1"),
		extractWrapper = document.createElement("p"),
		previewWrapper = document.createElement("div"),
		info = document.createElement("div")
	
	title.innerText = name
	extractWrapper.innerText = extract

	info.append(title, extractWrapper)
	info.classList.add("info")

	previewWrapper.innerHTML = preview
	previewWrapper.classList.add("preview")
	
	element.setAttribute("href", `/api/posts?${name}`)
	element.append(previewWrapper, info)
	element.classList.add("entry")
	entries.appendChild(element)
}

init()