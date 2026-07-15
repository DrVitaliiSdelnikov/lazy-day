import { Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { AppShellComponent } from './core/layout/app-shell.component';
import { ProfileStore } from './core/stores/profile.store';
import { ProfileSyncService } from './core/services/profile-sync.service';

@Component({
  imports: [RouterModule, AppShellComponent],
  selector: 'app-root',
  template: `
    <app-shell>
      <router-outlet />
    </app-shell>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class App implements OnInit {
  private translate = inject(TranslateService);
  private profileStore = inject(ProfileStore);
  private profileSync = inject(ProfileSyncService); // init on app start
  private router = inject(Router);

  ngOnInit() {
    this.translate.addLangs(['ru', 'en', 'ka']);
    this.translate.use(this.profileStore.locale());
    this.applyTheme(this.profileStore.theme());

    // Update canonical URL on navigation
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: NavigationEnd) => {
      const link = document.getElementById('canonical-link') as HTMLLinkElement;
      if (link) link.href = 'https://lazigo.app' + e.urlAfterRedirects;
    });
  }

  private applyTheme(theme: string) {
    const html = document.documentElement;
    html.classList.remove('dark-mode', 'light-mode');
    if (theme === 'dark') {
      html.classList.add('dark-mode');
    } else if (theme === 'light') {
      html.classList.add('light-mode');
    }
  }
}
