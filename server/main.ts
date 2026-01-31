import { config } from "../server.config.ts"
import { resources } from "./resourceMapper.ts"

const options = config.ssl ? {
	cert: config.cert,
	key: config.key,
	port: config.port,
	hostname: config.hostname,
	handler: requestHandler
} : {
	port: config.port,
	hostname: config.hostname,
	handler: requestHandler
}

const _server = Deno.serve(options)

// Responds to the incoming browser requests for webdesk
function requestHandler(browserRequest: Request, _connInfo: Deno.ServeHandlerInfo<Deno.NetAddr>): Response {
	const requestURL: URL = new URL(browserRequest.url)
	const requestTree: string[] = requestURL.pathname.substring(1).split("/")

	switch(requestTree[0]) {
		case "apps": return appsAssetsReplier(requestURL)
		case "api": return apiReplier(requestURL)
		default: return webdeskReplier(requestURL)
	}
}
function webdeskReplier(request: URL) {
	switch(request.pathname) {
		case "/": return new Response(resources.index, { status: 200, headers: { "content-type": "text/html, charset=UTF-8" } })
		default: return genErrorResponse(`Recived request: ${request}\n${" ".repeat(17)}^ isn't a valid webdesk file`)
	}
}
// Returns the contents of an app's asset
function appsAssetsReplier(request: URL): Response {
	if (resources.assets[request.pathname]) {
		return new Response(resources.assets[request.pathname], { status: 200 })
	} else { return genErrorResponse(`Recived asset request: ${request.pathname}\n${" ".repeat(23)}^isn't a valid asset`) }
}
// todo: sandboxing
function apiReplier(request: URL): Response {
	if (!resources.commands[request.pathname]) { return genErrorResponse(`Recived api request: ${request.pathname}\n${" ".repeat(23)}^isn't a valid command`) }

	try {
		resources.commands[request.pathname](request.pathname.substring(1).split("/"))
		return new Response("ok", { status: 200 })
	} catch(error) {
		return new Response(`${(error as Error).stack}`, { status: 500 })
	}
}

function genErrorResponse(message: string) {
	return new Response(message, { status: 400 })
}