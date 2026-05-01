import { Marked, Token } from "https://esm.sh/marked@18.0.0"

type EntryData = {
	html: string,
	cover: string,
	coverType: string,
	extract: string,
	date: string,
	link?: string
}

const marked = new Marked({
	walkTokens(token: Token) {
		if (token.type === 'text' || token.type === 'codespan') {
			token.text = token.text
				.replace(/&#39;/g, "'")
				.replace(/&quot;/g, '"')
				.replace(/&amp;/g, '&')
		}
	}
})

const appPath = "apps/blog"
const entries: Record<string, EntryData> = {}
const svgFallbackCover = await Deno.readTextFile(`${appPath}/images/card.svg`)
const postHtmlBase = await Deno.readTextFile(`${appPath}/viewer/viewer.html`)

async function processEntry(name: string) {
	if (name.includes("..") || name.includes("/")) { return }
	
	const filePath = `${appPath}/entries/${name}`
	
	let content: string, stats: Deno.FileInfo
	try {
		content = await Deno.readTextFile(filePath)
		stats = await Deno.stat(filePath)
	} catch { /* Error stuff */ }
	
	const contentFragment = await marked.parse(content!)
	const entryHTML = postHtmlBase.replace("you shouldn't see this but props if you do", contentFragment)

	const imgMatch = contentFragment.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
	const pMatch = contentFragment.match(/<p[^>]*>(.*?)<\/p>/is)
	
	const link = imgMatch ? imgMatch[1] : undefined
	let imageCover = imgMatch ? imgMatch[0] : ""
	let imageCoverType = "image/png"
	
	const firstParagraph = pMatch ? pMatch[1]
		.replace(/<[^>]+>/g, "")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.trim() : ""
	
	const creationDate = stats!.mtime!
	const creationString = `${creationDate.getDate().toString().padStart(2, "0")}/${(creationDate.getMonth() + 1).toString().padStart(2, "0")}/${creationDate.getFullYear()}`
	
	if (!imageCover) {
		let svgCover = svgFallbackCover
		svgCover = svgCover.replace("Example Title", name.replace(".md", ""))
		svgCover = svgCover.replace("00/00/0000", creationString)
		imageCover = svgCover
		imageCoverType = "image/svg+xml"
	}
	
	entries[name] = { html: entryHTML, cover: imageCover, coverType: imageCoverType, extract: firstParagraph, date: creationString, link: link }
}

async function updateEntries() {
	for await (const entry of Deno.readDir(`${appPath}/entries`)) {
		if (entry.isFile && entry.name.endsWith(".md")) {
			await processEntry(entry.name)
		}
	}
}

export function getEntries(_request: Request) {
	return { data: JSON.stringify(entries), type: "application/json" }
}

export async function cover(request: Request) {
	const requestURL = new URL(request.url)
	const post = decodeURIComponent(requestURL.search.substring(1))
	const entry = entries[post]
	
	if (!entry) return { data: "not found", type: "text/plain" }
	else if (entry.coverType === "image/svg+xml") { return { data: entry.cover, type: entry.coverType } }
	else if (entry.link) {
		if (entry.link.includes("..")) { return { data: "forbidden", type: "text/plain" } }
		
		const cleanLink = entry.link.startsWith("/") ? entry.link.substring(1) : entry.link
		const targetPath = `${appPath}/${cleanLink}`
		
		try {
			const imageContents = await Deno.readFile(targetPath)
			return { data: imageContents, type: entry.coverType }
		} catch { return { data: "not found", type: "text/plain" } }
	}
	
	return { data: "not found", type: "text/plain" }
}

export function entry(request: Request) {
	const requestURL = new URL(request.url)
	const post = decodeURIComponent(requestURL.search.substring(1))
	const targetEntry = entries[post]
	
	if (!post || !targetEntry) return { data: "not found", type: "text/plain" }
	
	return { data: targetEntry.html, type: "text/html" }
}

setInterval(updateEntries, 5 * 60 * 1000)
updateEntries()