import { Component, signal } from '@angular/core';
// import { RouterOutlet } from '@angular/router';
import { AppSpace } from "../spaces/app-space/app-space";
import { WindowSpace } from "../spaces/window-space/window-space";
import { ErrorSpace } from "../spaces/error-space/error-space";

@Component({
	selector: 'root',
	imports: [AppSpace, WindowSpace, ErrorSpace],
	templateUrl: './app.html'
})

export class App {
	protected readonly title = signal('webdesk');
}
