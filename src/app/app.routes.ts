import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'discover',
    pathMatch: 'full',
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
    path: '**',
    redirectTo: 'discover',
  },
];
