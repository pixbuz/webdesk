Deno.serve({
	port: 8000,
	hostname: "0.0.0.0",
	handler: Server,
	onListen({ port, hostname }) {
		console.log(`Backend Ready at ${hostname}:${port}`);
	},
});

function Server(UserRequest: Request): Response {
	const RequestURL = new URL(UserRequest.url)

	switch (RequestURL.pathname) {
		case "/api":
		case "/api/":
			return new Response("This is the Webdesk Backend!");

		case "/api/getAppManifests":
		case "/api/getAppManifests/":
			return new Response("g")

		default: return new Response(`${RequestURL.pathname} is not mapped to any command`);
	}
}