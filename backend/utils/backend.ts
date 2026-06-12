import { log, EventFunction } from "@utils/mod.ts"

export function emit(name: string, data: object) {
	const cleanName = name.toUpperCase().trim()
	const callbacks = ledger[cleanName]
	
	log.verb(`Triggering callbacks for event "${name}" (${callbacks.length} callbacks)`)
	
	for (const callback of callbacks) {
		log.dbug(`Triggered ${callback.name}`)
		callback(data)
	}
}

export function register(name: string, callback: EventFunction) {
	const cleanName = name.toUpperCase().trim()
	log.dbug(`Registred ${callback.name} for "${cleanName}" events`)
	ledger[cleanName] = [ ...(ledger[cleanName] || []), callback ]
}

const ledger: Record<string, EventFunction[]> = {}

globalThis.addEventListener("error", errorEvent => {
	log.errr("Fatal error:", errorEvent.error.stack || errorEvent.message)
	errorEvent.preventDefault()
})

globalThis.addEventListener("unhandledrejection", errorEvent => {
	log.errr("Unhandled promise rejection:", errorEvent.reason.stack || errorEvent.reason)
	errorEvent.preventDefault()
})