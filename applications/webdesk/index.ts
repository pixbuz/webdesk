import { Applications, Compiles } from "@server/mod.ts"

const baseIndex = await Deno.readTextFile("./applications/webdesk/_index.html")

function returnIndex(_request: Request) {
	const preloads = Compiles.preloads()
	const modules = Compiles.modules()
	const importMap = Compiles.importMap()
	
	const lauchers = Object.values(Applications)
		.filter(app => app.frontend.launcher === true)
		.map(app => `<webdesk-launcher name="${app.name}" launcher="${app.domain}"></webdesk-launcher>`)
		.join("\n")

	const index = baseIndex
		.replace("<!-- INMAP -->", importMap)
		.replace("<!-- PRELOAD -->", preloads)
		.replace("<!-- MODULES -->", modules)
		.replace("<!-- LAUNCHERS -->", lauchers)

	return { content: index, mime: "text/html" }
}

function returnImportMap(_request: Request) {
	return { content: Compiles.importMap(), mime: "plain/text" }
}

export const map = {
	"/": returnIndex,
	"/importMap": returnImportMap,
} as const