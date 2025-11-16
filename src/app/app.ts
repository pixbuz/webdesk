import { Component, signal } from '@angular/core';
// import { RouterOutlet } from '@angular/router';
import { AppSpace } from "./components/spaces/app-space/app-space";
import { WindowSpace } from "./components/spaces/window-space/window-space";
import { ErrorSpace } from "./components/spaces/error-space/error-space";
import { DesktopSpace } from "./components/spaces/desktop-space/desktop";

@Component({
	selector: 'root',
	imports: [DesktopSpace, AppSpace, WindowSpace, ErrorSpace],
	templateUrl: './app.html'
})
export class App {
	protected readonly title = signal('webdesk');
}
