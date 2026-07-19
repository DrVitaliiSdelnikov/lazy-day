import { ApplicationConfig, inject, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { HttpHandlerFn, HttpRequest, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { appRoutes } from './app.routes';
import { ProfileStore } from './core/stores/profile.store';

function deviceIdInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const store = inject(ProfileStore);
  const id = store.deviceId();
  if (id && req.url.includes('/v1/') && !req.headers.has('x-device-id')) {
    return next(req.clone({ setHeaders: { 'x-device-id': id } }));
  }
  return next(req);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([deviceIdInterceptor])),
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideTranslateService({ fallbackLang: 'ru' }),
    provideTranslateHttpLoader({ prefix: './assets/i18n/' }),
  ],
};
