import { log } from "/srv/log/"

function on(name, callback, addInFront = false) {
	if (addInFront) callbackMap[name] = [ callback, ...(callbackMap[name] || []) ]
	else callbackMap[name] = [ ...(callbackMap[name] || []), callback ]
	log.info(`Registered "${callback.name}" for "${name}" events`)
	return () => {
		callbackMap[name] = callbackMap[name].filter(cb => cb !== callback)
		log.info(`UnRegistered "${callback.name}" for "${name}" events`)
	}
}

// function emit(name, ...args) {
// 	const responder = callbackMap[name]?.at(0)
// 	const responseTimeout = 5000
// 	if (!responder) {
// 		log.info(`No callback for event ${name}`)
// 		return undefined
// 	}
// 	log.verb(`Triggered backend event ${name}, "${responder.name}" is the responder (${callbackMap[name].length - 1} additional callbacks)`)
// 	for (const callback of callbackMap[name].filter(callback => callback != responder)) callback(...args)
// 	return new Promise((res, rej) => {
// 		const timeout = setTimeout(() => {
// 			log.warn(`Event promise ${name} timed out`)
// 			rej("Timed out")
// 		}, responseTimeout)
// 		const reject = (reason) => {
// 			clearTimeout(timeout)
// 			rej(reason)
// 		}
// 		const resolve = (value) => {
// 			clearTimeout(timeout)
// 			res(value)
// 		}
// 		try { resolve(responder(...args)) }
// 		catch (error) { reject(error) }
// 	})
// }

function emit(name, ...args) {
	log.dbug(`Triggered backend event "${name}" (${ callbackMap[name]?.length ?? 0 } callbacks) with data:`, ...args)
	if (!callbackMap[name]) log.dbug(`No callback for event "${name}"`)
	callbackMap[name]?.forEach(callback => {
		try { callback(...args) }
		catch (error) { log.warn(`Exception from callback "${callback.name}" on event "${name}":\n${error.stack}`) }
	})
}

function get(_target, prop) {
	const actions = {
		on: on,
		emit: emit
	}
	if (typeof prop === "string" && prop in actions) return actions[prop]
	else return undefined
}

function apply(_target, _thisArg, [name, ...args]) {
	if (typeof name === "string") return emit(name, ...args)
	else return Promise.reject(new Error(`Invalid event name ${name}`))
}

const callbackMap = {}

export const WebdeskEvent = new Proxy(function() {}, {
	get,
	apply
})