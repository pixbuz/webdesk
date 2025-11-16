import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { appConfig } from './app.config';
import { serverRoutes } from '../routes/app.routes.server';

const serverConfig: ApplicationConfig = {
	providers: [
		provideServerRendering(withRoutes(serverRoutes)),
		provideHttpClient(withFetch())
	]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
