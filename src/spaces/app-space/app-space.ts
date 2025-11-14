import { Component, signal } from '@angular/core';
import { Launcher } from "../../components/launcher/launcher";
import { ResponseFormat, Manifest} from "../../../utils/utils";

@Component({
	selector: 'app-space',
	imports: [Launcher],
	templateUrl: './app-space.html'
})

export class AppSpace {
	async ngOnInit() {
		const BackendResponseRAW: Response = await fetch("http://127.0.0.1:8000/api/getAppManifests")
		const BackendResponseJSON: ResponseFormat = await BackendResponseRAW.json()
		console.log(BackendResponseJSON)
		BackendResponseJSON.message.forEach((manifest: Manifest) => {
			console.log(manifest)
			fetch(`http://127.0.0.1:8000/api/getAppIndex?name=${manifest.name}`).then(
				async (resp) => { console.log(await resp.json()) }
			)
		})
	}
}

