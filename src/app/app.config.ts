import { ApplicationConfig, inject, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { HttpHandlerFn, HttpRequest, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { appRoutes } from './app.routes';
import { ProfileStore } from './core/stores/profile.store';
import { NetworkStatusService } from './core/services/network-status.service';
import { tap, catchError, throwError, timeout } from 'rxjs';

function deviceIdInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const store = inject(ProfileStore);
  const id = store.deviceId();
  if (id && req.url.includes('/v1/') && !req.headers.has('x-device-id')) {
    return next(req.clone({ setHeaders: { 'x-device-id': id } }));
  }
  return next(req);
}

function networkStatusInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const network = inject(NetworkStatusService);
  // Only track API requests, not i18n/assets
  if (!req.url.includes('/v1/')) return next(req);

  return next(req).pipe(
    timeout(10000), // 10s timeout → degraded
    tap(() => network.reportSuccess()),
    catchError((err) => {
      if (err.name === 'TimeoutError') {
        network.reportTimeout();
      } else if (err.status === 0 || err.status === undefined) {
        // status 0 = no response (network error)
        network.reportNetworkError();
      }
      // Don't swallow — let the subscriber handle the error
      return throwError(() => err);
    }),
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([deviceIdInterceptor, networkStatusInterceptor])),
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideTranslateService({ fallbackLang: 'ru' }),
    provideTranslateHttpLoader({ prefix: './assets/i18n/' }),
  ],
};
