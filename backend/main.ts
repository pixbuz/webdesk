Deno.serve({
	port: 8000,
	hostname: "0.0.0.0",
	handler: Server,
	onListen({ port, hostname }) {
		console.log(`Backend Ready at ${hostname}:${port}`);
	}
})

interface ResponseFormat {
	message: unknown,
	responseFunction: string,
	returnedError: boolean
}

interface Manifest {
	name: string,
	index: string
}

async function Server(UserRequest: Request): Promise<Response> {
	const RequestURL = new URL(UserRequest.url)
	let Reply: ResponseFormat = { message: null, responseFunction: "", returnedError: false }

	switch (RequestURL.pathname) {
		case "/api/":
		case "/api": Reply.message = "This is the Webdesk Backend!"; break

		case "/api/getAppManifests/":
		case "/api/getAppManifests": await getAppManifests(Reply); break

		default: 
			Reply.message = `${RequestURL.pathname} is not mapped to any command`;
			Reply.returnedError = true
	}

	return new Response(JSON.stringify(Reply), {
		status: (Reply.returnedError ? 400 : 200),
		headers: { "Content-Type": "application/json" }
	})
}

async function getAppManifests(Reply: ResponseFormat): Promise<ResponseFormat> {
	Reply.responseFunction = "getAppManifests"
	const ApplicationManifests: string[] = [];
	let WaitNum = 0

	try {
		for await (const Manifest of Deno.readDirSync("./applications/manifests")) {
			WaitNum++;
			Deno.readTextFile(`./applications/manifests/${Manifest.name}`)
				.then(ManifestText => ApplicationManifests.push(JSON.parse(ManifestText)))
		}

		while (ApplicationManifests.length != WaitNum) 
			await new Promise<void>(r => setTimeout(r))

		Reply.message = ApplicationManifests
	} catch(error) {
		Reply.returnedError = true
		Reply.message = JSON.stringify(error)
	} finally {
		// deno-lint-ignore no-unsafe-finally
		return Reply 
	}
}

console.log("===================================================")
console.log(`Deno Current Working Directory: ${Deno.cwd()}`)
console.log("===================================================")