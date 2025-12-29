import * as settings from "../server.settings.ts"
import { WebdeskApplication } from "./application.ts"

let websockets: WebSocket[] = []
const base: string = Deno.readTextFileSync("static/index.htm").replaceAll("\t", "")
const split: string[] = base.split("<!--Assets-->")
const appList: Record<string, WebdeskApplication> = {}
const _encoder: TextEncoder = new TextEncoder()
const _decoder: TextDecoder = new TextDecoder()
const _server = Deno.serve({
	port: settings.port,
	hostname: settings.hostname,
	handler: requestResponder
})

for await (const dir of Deno.readDir("app")) {
	const manifest: WebdeskApplication = JSON.parse(Deno.readTextFileSync(`app/${dir.name}/manifest.json`))
	appList[dir.name] = manifest
	appList[dir.name].iconPath = `app/${dir.name}/${manifest.iconPath}`
}

Deno.writeTextFileSync("temp/webdesk.htm", settings.comment, { append: false })
Deno.writeTextFileSync("temp/webdesk.htm", split[0], { append: true })
for await (const component of Deno.readDir("static/components")) {
	const HTML = Deno.readTextFileSync(`static/components/${component.name}`)
	Deno.writeTextFileSync("temp/webdesk.htm", `${ HTML.replaceAll("\t", "") }\n`, { append: true })
}
Deno.writeTextFileSync("temp/webdesk.htm", split[1], { append: true })

// const index = Deno.readFileSync("temp/webdesk.htm")
// const css = Deno.readFileSync("static/style.css")
// const js = Deno.readFileSync("static/script.js")
function requestResponder(request: Request, _connInfo: object) {
	const url = new URL(request.url)

	if (request.headers.get("upgrade") === "websocket") {
		const upgrade = Deno.upgradeWebSocket(request)
		
		upgrade.socket.addEventListener("close", event => { websockets = websockets.filter(socket => socket === (event.target as WebSocket)) })
		upgrade.socket.addEventListener("open", event => { websockets.push(event.target as WebSocket) })
		upgrade.socket.addEventListener("message", socketInterpreter)

		return upgrade.response
	}

	if (url.pathname.slice(1, 5) == "apps") return assetsManager(url.pathname)

	switch(url.pathname) {
		case "/": return new Response(Deno.readFileSync("temp/webdesk.htm"), { status: 200, headers: {"content-type": "text/html; charset=utf-8"} })
		case "/style.css": return new Response(Deno.readFileSync("static/style.css"), { status: 200, headers: {"content-type": "text/css; charset=utf-8"} })
		case "/script.js": return new Response(Deno.readFileSync("static/script.js"), { status: 200, headers: {"content-type": "text/js; charset=utf-8"} })

		default: return new Response("bruh", { status: 400 })
	}
}

function assetsManager(pathname: string) {
	const info = pathname.slice(6).split("/")
	const target = info[0]
	console.log(info)
	switch (info[1]) {
		case "icon": return new Response(Deno.readFileSync(appList[target].iconPath), { headers: {"content-type": "image/svg+xml"} })

		default: return new Response("brud", { status: 400 })
	}
}

function socketInterpreter(event: MessageEvent) {
	if (event.data[0] == "?") { console.log(`Request from Client: "${ event.data }"`) }
	switch (event.data.slice(1)) {
		case "apps": (event.target as WebSocket).send(`!${Object.keys(appList).toString()}`)
			break

		default: (event.target as WebSocket).send("!wym")
	}
}