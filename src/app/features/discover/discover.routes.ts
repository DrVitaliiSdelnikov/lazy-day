import { Route } from '@angular/router';

export const discoverRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./discover.component').then((m) => m.DiscoverComponent),
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./onboarding/onboarding.component').then(
        (m) => m.OnboardingComponent
      ),
  },
];
