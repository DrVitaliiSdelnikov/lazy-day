import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Capture UTM/gclid BEFORE Angular router strips query params
// First-touch only — never overwrite (user may navigate within session)
(function captureFirstTouch() {
  if (localStorage.getItem('ld_first_touch')) return;
  const params = new URLSearchParams(window.location.search);
  const tracked = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid'];
  const captured: Record<string, string> = {};
  for (const key of tracked) {
    const val = params.get(key);
    if (val) captured[key] = val;
  }
  if (Object.keys(captured).length > 0) {
    captured['landing_url'] = window.location.href;
    captured['timestamp'] = new Date().toISOString();
    localStorage.setItem('ld_first_touch', JSON.stringify(captured));
  }
})();

bootstrapApplication(App, appConfig).then(() => {
  const splash = document.querySelector('.ld-splash');
  if (splash) {
    splash.classList.add('ld-splash--hide');
    splash.addEventListener('animationend', () => splash.remove());
  }
}).catch((err) =>
  console.error(err)
);
