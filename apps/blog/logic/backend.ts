import { marked } from "https://esm.sh/marked@12.0.0"

type EntryData = { html: string, preview: string, extract: string }

const entries: Record<string, EntryData> = { }
const basePath = "apps/blog/entries"

async function processEntry(name: string) {
	const filePath = `${basePath}/${name}`
	const content = await Deno.readTextFile(filePath)
	const stats = await Deno.stat(filePath)
	const htmlFragment = await marked.parse(content)
	const html = `<!DOCTYPE html><html><head><link rel="stylesheet" href="/viewer.css"></head><body>${htmlFragment}</body></html>`
	entries[name] = { html, preview: `<div class="inner">${htmlFragment}</div>`, extract: "test" }
}

export async function getEntries(_request: Request) {
	for await (const entry of Deno.readDir(basePath)) { if (entry.isFile) { processEntry(entry.name) } }
	return { data: JSON.stringify(entries), type: "application/json" }
}

export function posts(request: Request) {
	const requestURL = new URL(request.url)
	const post = decodeURIComponent(requestURL.search.substring(1))

	if (!post || !entries[post]) { return { data: "not found", type: "text/plain" } }
	else { return { data: entries[post].html, type: "text/html" } }
}