import { inject } from '@angular/core';
import { Router, Route } from '@angular/router';

function welcomeGuard() {
  if (typeof localStorage === 'undefined') return true;
  if (localStorage.getItem('ld_welcome_done')) return true;
  return inject(Router).createUrlTree(['/']);
}

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/ad-landing.component').then((m) => m.AdLandingComponent),
  },
  {
    path: 'en/tbilisi/today',
    loadComponent: () =>
      import('./features/landing/ad-landing.component').then((m) => m.AdLandingComponent),
    data: { lang: 'en' },
  },
  {
    path: 'ru/tbilisi/today',
    loadComponent: () =>
      import('./features/landing/ad-landing.component').then((m) => m.AdLandingComponent),
    data: { lang: 'ru' },
  },
  {
    path: 'ka/tbilisi/today',
    loadComponent: () =>
      import('./features/landing/ad-landing.component').then((m) => m.AdLandingComponent),
    data: { lang: 'ka' },
  },
  {
    path: 'discover',
    canActivate: [welcomeGuard],
    loadChildren: () =>
      import('./features/discover/discover.routes').then((m) => m.discoverRoutes),
  },
  {
    path: 'detail/:type/:id',
    loadComponent: () =>
      import('./features/detail/detail.component').then((m) => m.DetailComponent),
  },
  {
    path: 'saved',
    loadComponent: () =>
      import('./features/saved/saved.component').then((m) => m.SavedComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/privacy/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: 'dev/reco-lab',
    loadComponent: () =>
      import('./features/dev/reco-lab.component').then((m) => m.RecoLabComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
