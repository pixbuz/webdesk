const appPath = `apps/colors`
const svgPreview = await Deno.readTextFile(`${appPath}/preview.svg`)

export function preview(request: Request) {
	const reqUrl = new URL(request.url)
	const paletteEncoded = reqUrl.search.substring(1)
	const paletteText = decodeURIComponent(paletteEncoded)
	const palette = JSON.parse(paletteText)
	let result = svgPreview

	console.log(palette)

	return { data: result, type: "image/svg+xml" }
}

export function sock(request: Request) {
	if (request.headers.get("origin")?.includes("://colors.localhost")) return
	const { socket, response } = Deno.upgradeWebSocket(request)
	socket.addEventListener("message", updatePalette)
	return response
}

function updatePalette(message: MessageEvent) {
	console.log(message)
}