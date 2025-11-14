import { ResponseFormat, Manifest } from "../../utils/utils.ts";

export async function getAppManifests(Reply: ResponseFormat): Promise<ResponseFormat> {
	/* This function helps with getting all the apps manifests allowing
	the app-space component to spawn the right amount of app launchers */
	const ApplicationManifests: Manifest[] = [];
	let WaitNum = 0

	try {
		for await (const Manifest of Deno.readDirSync("./applications/manifests")) {
			WaitNum++;
			Deno.readTextFile(`./applications/manifests/${Manifest.name}`)
				.then(ManifestText => ApplicationManifests.push(JSON.parse(ManifestText)))
		}

		while (ApplicationManifests.length != WaitNum) await new Promise<void>(r => setTimeout(r))

		Reply.message = ApplicationManifests
	} catch(error) {
		Reply.returnedError = true
		Reply.message = JSON.stringify(error)
	} finally {
		// deno-lint-ignore no-unsafe-finally
		return Reply 
	}
}