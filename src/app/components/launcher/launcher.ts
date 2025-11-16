import { Component, Input,  } from '@angular/core';

import { LauncherClickRelay } from '../../launcherClickRelay.service';

@Component({
	selector: 'launcher',
	imports: [],
	templateUrl: './launcher.html',
})
export class Launcher {
	@Input() AppName!: string
	constructor(private events: LauncherClickRelay) {}

	onClick() { this.events.emitClick({ appName: this.AppName }) }
}
