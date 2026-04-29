let name: string, force: boolean

if (Deno.args.includes("--force")) {
	force = Deno.args.includes("--force")
}

const [ name ] = Deno.args
const path = `apps/${name}`
const force = 

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
} catch (e) { }

try {
	Deno.mkdir(path)

	const service = confirm("Is the app a service?")
	const index = prompt("Application index file name:", `${name}.html`)
	const style = prompt("Application style sheet file name:", `${name}.css`)
	const script = prompt("Application js script file name:", `${name}.js`)
	const icon = prompt("Application icon file name:", `${name}.png`)
	const titlebar = prompt("Application custom titlebar file name:", `${name}-titlebar.html`)
	
	if (titlebar !== "") { Deno.writeTextFile(`${path}/${titlebar}`, "") }
	if (index !== "") { Deno.writeTextFile(`${path}/${index}`, "") }
	if (style !== "") { Deno.writeTextFile(`${path}/${style}`, "") }
	if (script !== "") { Deno.writeTextFile(`${path}/${script}`, "") }
	
	let manifest = "{\n"
	manifest += `\t"service": ${service},\n`
	manifest += `\t"titlebar": "${titlebar}",\n`
	manifest += `\t"script": "${script}",\n`
	manifest += `\t"style": "${style}",\n`
	manifest += `\t"index": "${index}",\n`
	manifest += `\t"icon": "${icon}",\n`
	manifest += `\t"routes": {},\n`
	manifest += `\t"modules": [],\n`
	manifest += `\t"ignore": []\n`
	manifest += `}\n`

	Deno.writeTextFile(`${path}/manifest.json`, manifest)

	// TODO: Make this into a doc
	console.log("Done! Add the relative paths of files and folders you don't want exposed to the browser to ignore")
	console.log("Or change where some paths are exposed at with routes")
	console.log("And if you need any commands that run in the backend, write an exported function in a .ts file specified in the modules")
} catch (error) { console.log("Error!", (error as Error).message) }