import { Component } from '@angular/core';

@Component({
  selector: 'app-privacy',
  standalone: true,
  template: `
    <div class="privacy">
      <button class="privacy__back" aria-label="Go back" (click)="goBack()">← Back</button>

      <h1>Privacy Policy</h1>
      <p class="privacy__updated">Last updated: July 9, 2026</p>

      <h2>What is LaziGo?</h2>
      <p>LaziGo (lazigo.app) is a contextual leisure discovery service that helps you find places and events matched to your interests, company, and time.</p>

      <h2>What data do we collect?</h2>

      <h3>Automatically (without consent)</h3>
      <ul>
        <li><strong>Device identifier</strong> — anonymous UUID generated on your device, stored locally. We don't know who you are.</li>
        <li><strong>Selected preferences</strong> — interests, company type, pet flag, locale. Stored on your device only.</li>
        <li><strong>Location</strong> — only when you grant permission. Used to find places near you. Not stored on our servers.</li>
      </ul>

      <h3>With your consent (personalization)</h3>
      <p>If you accept personalization, we additionally collect:</p>
      <ul>
        <li><strong>Clicks</strong> — which places/events you open</li>
        <li><strong>Saves</strong> — what you save to favorites</li>
        <li><strong>Hides</strong> — what you dismiss</li>
        <li><strong>Session context</strong> — what filters were active when you searched</li>
      </ul>
      <p>This data is linked to your anonymous device ID (not your name, email, or phone). We use it to improve recommendations for you.</p>

      <h3>What we do NOT collect</h3>
      <ul>
        <li>Name, email, phone number, or any personal identity</li>
        <li>Precise location history (we use location only for the current request)</li>
        <li>Data from other apps on your device</li>
        <li>Advertising identifiers</li>
      </ul>

      <h2>How do we use your data?</h2>
      <ul>
        <li>Show you relevant places and events based on your interests</li>
        <li>Improve recommendation quality over time (with consent)</li>
        <li>Aggregate anonymous statistics (e.g., "parks are popular on weekends")</li>
      </ul>

      <h2>Data storage and retention</h2>
      <ul>
        <li>Preferences — stored on your device (localStorage). We don't have access.</li>
        <li>Interaction data (with consent) — stored on our servers for up to 180 days, then deleted or aggregated.</li>
        <li>Aggregated statistics — kept indefinitely (no personal data).</li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li><strong>Decline personalization</strong> — the app works without it, just with more generic recommendations.</li>
        <li><strong>Withdraw consent</strong> — change your choice anytime in Settings.</li>
        <li><strong>Delete your data</strong> — reset the app or clear browser data. Your device ID changes, all history is lost.</li>
      </ul>

      <h2>Third-party services</h2>
      <ul>
        <li><strong>Google Places API</strong> — we use it to enrich venue data (hours, ratings). Google receives your search coordinates but not your identity.</li>
        <li><strong>Analytics</strong> — we use privacy-friendly analytics (no cookies, no personal tracking).</li>
      </ul>

      <h2>Cookies</h2>
      <p>We do not use cookies. All data is stored in localStorage on your device.</p>

      <h2>Children</h2>
      <p>LaziGo is not directed at children under 16. We do not knowingly collect data from children.</p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy. The "last updated" date at the top will change. Continued use after changes means you accept the updated policy.</p>

      <h2>Contact</h2>
      <p>Questions about privacy? Email us at <a href="mailto:privacy@lazigo.app">privacy&#64;lazigo.app</a></p>
    </div>
  `,
  styles: `
    .privacy {
      max-width: 700px;
      margin: 0 auto;
      padding: var(--ld-space-lg);
      padding-bottom: 80px;
      line-height: 1.6;
      color: var(--ld-text);
    }

    .privacy__back {
      background: none;
      border: none;
      color: var(--ld-text-2);
      cursor: pointer;
      padding: 8px 0;
      font-size: 14px;
      margin-bottom: var(--ld-space-md);
    }

    .privacy__updated {
      color: var(--ld-text-2);
      font-size: 13px;
      margin-bottom: var(--ld-space-xl);
    }

    h1 { font-size: 24px; font-weight: 600; margin-bottom: var(--ld-space-md); }
    h2 { font-size: 18px; font-weight: 600; margin-top: var(--ld-space-xl); margin-bottom: var(--ld-space-sm); }
    h3 { font-size: 15px; font-weight: 600; margin-top: var(--ld-space-md); margin-bottom: var(--ld-space-xs); }
    p { margin-bottom: var(--ld-space-md); font-size: 14px; }
    ul { padding-left: 20px; margin-bottom: var(--ld-space-md); font-size: 14px; }
    li { margin-bottom: var(--ld-space-xs); }
    a { color: var(--ld-primary, #6366f1); }
  `,
})
export class PrivacyComponent {
  goBack() {
    history.back();
  }
}
