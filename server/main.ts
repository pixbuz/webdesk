import { config } from "../server.config.ts"
import { resources } from "./resourceMapper.ts"

let options = config.ssl ? {
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
async function requestHandler(browserRequest: Request, _connInfo: Deno.ServeHandlerInfo<Deno.NetAddr>): Promise<Response> {
	const requestURL: URL = new URL(browserRequest.url)
	const requestTree: string[] = requestURL.pathname.substring(1).split("/")

	switch(requestTree[0]) {
		case "": // return webdesk
		case "apps": return appsAssetsReplier(requestTree)
		case "api": return apiReplier(requestTree)
		default: return genErrorResponse(`Recived command tree: ${requestTree}\n${" ".repeat(22)}^ isn't a valid branch`)
	}
}

function appsAssetsReplier(requestTree: string[] ): Response {
	return new Response(`${requestTree}! apps`, { status: 200 })
}

function apiReplier(requestTree: string[] ): Response {
	return new Response(`${requestTree}! api`, { status: 200 })
}

function genErrorResponse(message: string) {
	return new Response(message, { status: 400 })
}

await resources.ready
console.log("ready")