import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppSpace } from './app-space';

describe('AppSpace', () => {
	let component: AppSpace;
	let fixture: ComponentFixture<AppSpace>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AppSpace]
		})
		.compileComponents();

		fixture = TestBed.createComponent(AppSpace);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
