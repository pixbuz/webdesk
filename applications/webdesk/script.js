(async () => {
const initResponse = await fetch(`/app/share/services`)
const services = await initResponse.json()

const scripts = []
const imports = { "@webdesk/": "/services/" }

for (const serviceLocation of services) {
	const script = document.createElement("script")
	const app = serviceLocation.split("/")[2]
	
	const routeKey = `@${app}/`
	const routeValue = `/app/${app}/`

	if (!imports[routeKey]) imports[routeKey] = routeValue

	const file = serviceLocation.slice(routeValue.length)

	script.type = "module"
	script.src = serviceLocation.startsWith("/app/webdesk") ? serviceLocation.slice(13) : serviceLocation
	scripts.push(script)
}

const importMap = document.createElement("script")
importMap.type = "importmap"
importMap.textContent = JSON.stringify({ imports })

document.head.append(importMap)
document.head.append(...scripts)
})()