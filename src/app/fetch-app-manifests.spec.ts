import { TestBed } from '@angular/core/testing';

import { FetchAppManifests } from './fetch-app-manifests';

describe('FetchAppManifests', () => {
  let service: FetchAppManifests;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FetchAppManifests);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
