import { Component, ViewChild, ViewContainerRef, ComponentRef } from '@angular/core';

import { Window } from '../../window/window';
import { LauncherClickRelay } from '../../../launcherClickRelay.service';

@Component({
	selector: 'window-space',
	imports: [],
	templateUrl: './window-space.html'
})
export class WindowSpace {
	@ViewChild('windows', { read: ViewContainerRef, static: true }) container!: ViewContainerRef

	constructor(private events: LauncherClickRelay) {}

	ngOnInit() {
		this.events.clicked$.subscribe(data => this.spawnWindow(data))
	}

	spawnWindow(stuff: any) {
		console.log(stuff)
		const spawnedWindow: ComponentRef<Window> = this.container.createComponent(Window)
		spawnedWindow.instance.test = stuff.appName
	}
}
