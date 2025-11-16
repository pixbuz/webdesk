import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class LauncherClickRelay {
	private clickSubject = new Subject<any>()
	clicked$ = this.clickSubject.asObservable()

	emitClick(data: any) {
		this.clickSubject.next(data)
	}
}
