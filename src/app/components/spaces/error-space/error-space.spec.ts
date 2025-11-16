import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorSpace } from './error-space';

describe('ErrorSpace', () => {
  let component: ErrorSpace;
  let fixture: ComponentFixture<ErrorSpace>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorSpace]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ErrorSpace);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
