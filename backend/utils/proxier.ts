// deno-lint-ignore no-explicit-any
export function proxyIt<T extends object>(target: T): T extends any[] ? ReadonlyArray<T[number]> : Readonly<T> {
	return new Proxy(target, {
		set(_target, prop) {
			throw new Error(`[Security Violation] Cannot modify property '${String(prop)}'.`)
		},
		deleteProperty(_target, prop) {
			throw new Error(`[Security Violation] Cannot delete property '${String(prop)}'.`)
		},
		get(target, prop, receiver) {
			if (Array.isArray(target)) {
				const blocklisted = ["push", "pop", "shift", "unshift", "splice", "fill", "reverse", "sort"]
				if (blocklisted.includes(prop as string)) return () => { throw new Error(`[Security Violation] Method .${String(prop)}() is blocked.`) }
			}
			return Reflect.get(target, prop, receiver)
		}
	// deno-lint-ignore no-explicit-any
	}) as any
}