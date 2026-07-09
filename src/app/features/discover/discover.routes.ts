import { Route } from '@angular/router';

export const discoverRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./discover.component').then((m) => m.DiscoverComponent),
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./welcome/welcome.component').then((m) => m.WelcomeComponent),
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./onboarding/onboarding.component').then(
        (m) => m.OnboardingComponent
      ),
  },
];
