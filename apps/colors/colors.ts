const appPath = `apps/colors`
const svgPreview = await Deno.readTextFile(`${appPath}/preview.svg`)

export function preview(request: Request) {
	const reqUrl = new URL(request.url)
	const paletteEncoded = reqUrl.search.substring(1)
	const paletteText = decodeURIComponent(paletteEncoded)
	const palette = JSON.parse(paletteText)
	const preview = svgPreview
		.replace("#f00", palette.canvas)
		.replace("#0f0", palette.content)
		.replace("#ff0", palette.error)
		.replace("#00f", palette.accent)
		.replace("#f0f", palette.success)
		.replace("#fff", palette.content)

	return { data: preview, type: "image/svg+xml" }
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