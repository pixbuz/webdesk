import { Component, Input } from '@angular/core';

@Component({
	selector: 'window',
	imports: [],
	templateUrl: './window.html',
})
export class Window {
	@Input() test!: any
}
