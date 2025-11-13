import { Component, signal } from '@angular/core';
import { Launcher } from "../../components/launcher/launcher";

const modules = import.meta.glob('/src/applications/manifests/*', { eager: true });

console.log(import.meta.url);
console.log(modules)

@Component({
	selector: 'app-space',
	imports: [Launcher],
	templateUrl: './app-space.html'
})

export class AppSpace {

}
