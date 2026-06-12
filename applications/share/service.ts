import { log } from "@utils/mod.ts"
import { Services } from "@server/mod.ts"

function index(_request: Request) {
	return { content: JSON.stringify(Services), mime: "application/json" }
}

export const map = {
	"/services": index
}