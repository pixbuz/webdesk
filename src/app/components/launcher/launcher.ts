import { Component, Input } from '@angular/core';

import { LauncherClickRelay } from '../../launcherClickRelay.service';

@Component({
	selector: 'launcher',
	imports: [],
	templateUrl: './launcher.html',
})
export class Launcher {
	@Input() AppName!: string
	constructor(private events: LauncherClickRelay) {}

	onClick() {
		/* Everytime a app launcher gets clicked,
		the event is relayed to Window Space in
		order to spawn the associated Window */
		this.events.emitClick({ appName: this.AppName })
	}
}
