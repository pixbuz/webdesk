import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ResponseFormat } from '../../utils/BackendResponse';

@Injectable({ providedIn: 'root' })
export class FetchAppManifests {
	constructor(
		private http: HttpClient
	) {}

	getData(): Observable<ResponseFormat> {
		return this.http.get<ResponseFormat>('http://127.0.0.1:8000/getAppManifests');
	}
}
