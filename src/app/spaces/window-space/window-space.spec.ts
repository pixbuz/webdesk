import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WindowSpace } from './window-space';

describe('WindowSpace', () => {
  let component: WindowSpace;
  let fixture: ComponentFixture<WindowSpace>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WindowSpace]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WindowSpace);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
