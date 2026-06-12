import { ThinResponse, WrappedRequest, log } from "@utils/mod.ts"
import { Applications, Services } from "@server/register.ts"

const settings = {
	https: false,
	keyFile: "",
	certFile: "",
	hostname: "0.0.0.0",
	port: 8000,
} as const

export class easyResponse extends Response {
	constructor(content: unknown, status: number = 200, mime: string = "text/plain", headers = {
		"Content-Type": mime,
	} as ThinResponse["headers"]) { super(content as BodyInit, { status, headers }) }
}

function reply(request: Request, connInfo: Deno.ServeHandlerInfo<Deno.Addr>) {
	log.verb(`Received request for ${request.url} from IP`, connInfo.remoteAddr)
	
	const url = new URL(request.url)
	const match = url.pathname.match(urlFullMatch)
	const routeType = match?.[1]
	const domain = match?.[2] || "webdesk"
	const appPathname = match ? "/" + (match[3] || "") : url.pathname

	// if (domain && appPathname === url.pathname && urlTrailingMatch.test(url.pathname)) {
	// 	url.pathname += "/"
	// 	log.verb(`Redirecting request to correct URL ${url.pathname} (with trailing /)`)
	// 	return Response.redirect(url, 301)
	// }

	const replyerArgs: WrappedRequest = { url, pathname: appPathname!, request }

	switch (routeType) {
		case "srv": return serviceReply(domain, replyerArgs)
		default: return applicationReply(domain, replyerArgs)
	}
}

async function applicationReply(domain: string, args: WrappedRequest) {
	const application = Applications[domain] ?? Applications["webdesk"]
	
	const response = application
		? await application.replyer(args)
		: { content: `No app on domain "${domain}"`, code: 400, mime: "text/plain" }
	
	if (response.bypass) return response.content as Response
	return new easyResponse(response.content, response.code, response.mime, response.headers)
}

async function serviceReply(domain: string, args: WrappedRequest) {
	const service = Services[domain] ?? Services["webdesk"]
	const response = await service.reply(args)
	return new easyResponse(response.content, response.code, response.mime, response.headers)
}

const options = settings.https ?
	{
		port: settings.port,
		hostname: settings.hostname,
		cert: await Deno.readTextFile(settings.certFile),
		key: await Deno.readTextFile(settings.keyFile),
	} :
	{
		port: settings.port,
		hostname: settings.hostname,
	}

const urlMatchRegex = /^\/(app|srv)/
const urlFullMatch = new RegExp(urlMatchRegex.source + /\/?([^/]+)(?:\/(.*))?$/.source)
const urlTrailingMatch = new RegExp(urlMatchRegex.source + /\/[^/]+\/?$/.source)

export const Server = Deno.serve({
	...options,
	onListen() { log.info(`${settings.https ? "HTTPS" : "HTTP" } server started on port ${settings.port}`) }
}, reply)