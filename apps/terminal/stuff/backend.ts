const helpText: string = await Deno.readTextFile("apps/terminal/stuff/help")

export function command(request: Request) {
	const requestUrl: URL = new URL(request.url)
	const command: string[] = Array.from(requestUrl.searchParams.entries())
					.at(0)		// First Parameter Value Pair
					.at(0)		// First Parameter Value
					.split(" ")	// Get every command space

	switch(command[0]) {
		case "echo": return new Response((command.slice(1).join(" ") as BodyInit))
		default: return new Response(helpText)
	}
}