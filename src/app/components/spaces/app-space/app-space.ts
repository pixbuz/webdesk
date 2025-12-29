import { Component, ViewChild, ViewContainerRef } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Launcher } from "../../launcher/launcher";
import { ResponseFormat } from "../../../../../utils/utils";
import { FetchAppManifests } from "../../../fetchAppsManifests.service"

@Component({
	selector: 'app-space',
	imports: [],
	templateUrl: './app-space.html'
})
export class AppSpace {
	@ViewChild('launchers', { read: ViewContainerRef, static: false }) container!: ViewContainerRef

	data: object[] = []

	constructor(private fetchAPI: FetchAppManifests) {}

	async ngOnInit() {
		/*  */
		const AppManifests: ResponseFormat = await firstValueFrom(this.fetchAPI.getData())
		
		this.container.clear()

		for (const manifest of AppManifests.message) {
			const AppLauncher = this.container.createComponent(Launcher)
			AppLauncher.instance.AppName = manifest.name
			AppLauncher.changeDetectorRef.detectChanges()
		}
	}
}
