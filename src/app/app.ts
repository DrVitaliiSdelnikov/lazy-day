import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AppShellComponent } from './core/layout/app-shell.component';
import { ProfileStore } from './core/stores/profile.store';

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

  ngOnInit() {
    this.translate.addLangs(['ru', 'en']);
    this.translate.use(this.profileStore.locale());
    this.applyTheme(this.profileStore.theme());
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
