import { Component, Input } from '@angular/core';

@Component({
	selector: 'launcher',
	imports: [],
	templateUrl: './launcher.html',
})
export class Launcher {
	@Input() AppName!: string
}
