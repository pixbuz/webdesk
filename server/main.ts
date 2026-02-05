import { resourceUsage } from "node:process";
import { config } from "../server.config.ts"
import { resources } from "./resourceMapper.ts"
import { contentType, allExtensions, getCharset } from "@std/media-types";

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
		case "/": return new Response(resources.webdesk.index, { status: 200, headers: { "content-type": "text/html, charset=UTF-8" } })
		case "/style": return new Response(resources.webdesk.css, { status: 200, headers: { "content-type": "text/css, charset=UTF-8" } })
		case "/script": return new Response(resources.webdesk.script, { status: 200, headers: { "content-type": "text/javascript, charset=UTF-8" } })
		default: return genErrorResponse(`Recived request: ${request}\n${" ".repeat(17)}^ isn't a valid webdesk file`)
	}
}
// Returns the contents of an app's asset
function appsAssetsReplier(request: URL): Response {
	if (resources.assets[request.pathname]) {
		return new Response(resources.assets[request.pathname], { status: 200, headers: { "content-type": `${contentType(request.pathname.split(".").at(-1)!)}, charset=UTF-8` } })
	} else { return genErrorResponse(`Recived asset request: ${request.pathname}\n${" ".repeat(23)}^isn't a valid asset`) }
}
// Runs and returns a server function
function apiReplier(request: URL): Response {
	// If the command requested doesn't exist, return an error
	if (!resources.commands[request.pathname]) { return genErrorResponse(`Recived api request: ${request.pathname}\n${" ".repeat(23)}^isn't a valid command`) }

	// Sandbox the function, in case return the error
	try {
		const result: [computed: unknown, type: string] = resources.commands[request.pathname](request.search.substring(1).split("&"))
		return new Response(result[0] as BodyInit, { status: 200, headers: { "content-type": result[1] } })
	}
	catch(error) { return new Response(`${(error as Error).stack}`, { status: 500 }) }
}

function genErrorResponse(message: string) {
	return new Response(message, { status: 400 })
}