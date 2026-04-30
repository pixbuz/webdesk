let name: string, force: boolean

if (Deno.args.includes("--force")) {
	force = true
	name = Deno.args[1]
} else name = Deno.args[0]

const path = `apps/${name}`

if (Deno.args.length == 0) {
	console.log("Specify an app name!")
	Deno.exit(1)
}

try {
	await Deno.stat(path)
	if (!force) {
		console.log("The app exists! Use --force to overwrite!")
		Deno.exit(1)
	} else await Deno.remove(path, { recursive: true })
} catch (_e) { /*  */ }

try {
	Deno.mkdir(path)

	console.log("%cIs the app a %cservice%c?", "color: white;", "color: blue; font-weight: 1000;", "color: white;")
	const service = confirm()
	
	console.log("%cWhat's the app %cindex%c file name?", "color: white;", "color: blue; font-weight: 1000;", "color: white;")
	const index = prompt("", `${name}.html`)
	if (index !== "") Deno.writeTextFile(`${path}/${index}`, "")
	
	console.log("%cWhat's the app %cstyle sheet%c file name?", "color: white;", "color: blue; font-weight: 1000;", "color: white;")
	const style = prompt("", `${name}.css`)
	if (style !== "") Deno.writeTextFile(`${path}/${style}`, "")
	
	console.log("%cWhat's the app %cfrontend js script%c file name?", "color: white;", "color: blue; font-weight: 1000;", "color: white;")
	const script = prompt("", `${name}.js`)
	if (script !== "") Deno.writeTextFile(`${path}/${script}`, "")
	
	console.log("%cWhat's the app %cicon%c file name?", "color: white;", "color: blue; font-weight: 1000;", "color: white;")
	const icon = prompt("", `${name}.png`)
	
	console.log("%cWhat's the app %ccustom html titlebar%c file name?", "color: white;", "color: blue; font-weight: 1000;", "color: white;")
	const titlebar = prompt("", `${name}-titlebar.html`)
	if (titlebar !== "") Deno.writeTextFile(`${path}/${titlebar}`, "")
	
	let manifest = "{\n"
	manifest += `\t"icon": "${icon}",\n`
	manifest += `\t"index": "${index}",\n`
	manifest += `\t"style": "${style}",\n`
	manifest += `\t"ignore": [],\n`
	manifest += `\t"script": "${script}",\n`
	manifest += `\t"routes": {},\n`
	manifest += `\t"service": ${service},\n`
	manifest += `\t"modules": [],\n`
	manifest += `\t"titlebar": "${titlebar}"\n`
	manifest += `}\n`

	Deno.writeTextFile(`${path}/manifest.json`, manifest)

	// TODO: Make this into a doc
	console.log("Done! Add the relative paths of files and folders you don't want exposed to the browser to ignore")
	console.log("Or change where some paths are exposed at with routes")
	console.log("And if you need any commands that run in the backend, write an exported function in a .ts file specified in the modules")
} catch (error) { console.log("Error!", (error as Error).message) }