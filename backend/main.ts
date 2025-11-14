import { ResponseFormat, Manifest } from "../utils/utils.ts";
import * as functions from "./functions.ts";

/* Run a Deno Server that acts as a backend for Angular */
Deno.serve({
	port: 8000,	// Prob will change
	hostname: "0.0.0.0",
	handler: Server,
	onListen({ port, hostname }) {
		console.log(`Backend Ready at ${hostname}:${port}`);
	}
})

async function Server(UserRequest: Request): Promise<Response> {
	/* Main Function that checks if the API request is a valid
	function and returns the response of said function */
	const RequestURL = new URL(UserRequest.url)	// Ez pathname isolation
	let reply: ResponseFormat = new ResponseFormat

	if (RequestURL.pathname.slice(5) in functions) {
		// If the function name exists then run it
		reply = functions[RequestURL.pathname.slice(5) as keyof typeof functions](reply)
	} else { // Otherwise send a error message
		reply.message = `${RequestURL.pathname.slice(5)} is not a Function`
		reply.returnedError = true
	}

	return new Response(JSON.stringify(await reply), {	// Ship "reply" as JSON as the response
		// ^ await is needed because the function that replies could be async
		status: (reply.returnedError ? 400 : 200),	// Nifty Error Code trick
		headers: { "Content-Type": "application/json" } // Specify that the response is JSON
	})
}

console.log("===================================================")
console.log(`Deno Current Working Directory: ${Deno.cwd()}`)
console.log("===================================================")