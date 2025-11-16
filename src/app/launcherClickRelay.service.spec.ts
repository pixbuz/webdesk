import { TestBed } from '@angular/core/testing';

import { LauncherClickRelay } from './launcherClickRelay.service';

describe('LauncherClickRelay', () => {
  let service: LauncherClickRelay;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LauncherClickRelay);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
