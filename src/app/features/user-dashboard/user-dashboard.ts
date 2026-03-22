// src/app/features/user-dashboard/user-dashboard.ts
import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '@core/services/auth.service';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

    <div class="ud-shell">

      <!-- ── Sidebar ── -->
      <aside class="ud-sidebar" [class.ud-sidebar--open]="mobileMenuOpen()">
        <div class="ud-overlay" (click)="mobileMenuOpen.set(false)"></div>

        <div class="ud-sidebar__inner">
          <!-- Brand -->
          <div class="ud-brand">
            <div class="ud-brand__icon">
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 10h12M8 14h8M8 18h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <span class="ud-brand__name">Eventsora</span>
          </div>

          <!-- User chip -->
          <div class="ud-user-chip">
            <div class="ud-user-chip__avatar">{{ avatarLetter() }}</div>
            <div class="ud-user-chip__info">
              <div class="ud-user-chip__name">{{ displayName() }}</div>
              <div class="ud-user-chip__role">Attendee</div>
            </div>
          </div>

          <!-- Nav -->
          <nav class="ud-nav">

            <!-- ── MAIN ── -->
            <span class="ud-nav__label">Menu</span>
            @for (item of mainNavItems; track item.label) {
              <a [routerLink]="item.route" routerLinkActive="ud-nav__item--active"
                 [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                 class="ud-nav__item" (click)="mobileMenuOpen.set(false)">
                <span class="ud-nav__icon" [innerHTML]="item.svg"></span>
                <span class="ud-nav__text">{{ item.label }}</span>
              </a>
            }

            <!-- ── COMMUNITY ── -->
            <span class="ud-nav__label" style="margin-top:.5rem">Community</span>
            @for (item of communityNavItems; track item.label) {
              <a [routerLink]="item.route" routerLinkActive="ud-nav__item--active"
                 [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                 class="ud-nav__item" (click)="mobileMenuOpen.set(false)">
                <span class="ud-nav__icon" [innerHTML]="item.svg"></span>
                <span class="ud-nav__text">{{ item.label }}</span>
              </a>
            }

          </nav>

          <!-- Logout -->
          <div class="ud-sidebar__footer">
            <button class="ud-logout-btn" (click)="logout()">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              Log Out
            </button>
          </div>
        </div>
      </aside>

      <!-- ── Main ── -->
      <main class="ud-main">
        <header class="ud-topbar">
          <button class="ud-topbar__menu" (click)="mobileMenuOpen.set(true)">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <span class="ud-topbar__brand">Eventsora</span>
          <div class="ud-topbar__spacer"></div>
        </header>
        <div class="ud-content">
          <router-outlet />
        </div>
      </main>

    </div>
  `,
  styles: [`
    :host {
      --bg:       #060608;
      --bg2:      #09090c;
      --bg3:      #111116;
      --gold:     #F0B429;
      --gold-dim: rgba(240,180,41,.1);
      --gold-brd: rgba(240,180,41,.22);
      --coral:    #FF4433;
      --green:    #22c55e;
      --text:     #F2EEE6;
      --muted:    rgba(242,238,230,.42);
      --border:   rgba(242,238,230,.07);
      --fd: 'Bebas Neue', sans-serif;
      --fb: 'Plus Jakarta Sans', sans-serif;
      --fm: 'DM Mono', monospace;
      display: block; height: 100vh;
    }

    .ud-shell { display:flex;height:100vh;background:var(--bg);color:var(--text);font-family:var(--fb);overflow:hidden; }

    /* Sidebar */
    .ud-sidebar {
      width:240px;flex-shrink:0;background:var(--bg2);border-right:1px solid var(--border);
      display:flex;flex-direction:column;
      position:fixed;top:0;left:-260px;height:100vh;z-index:50;
      transition:left .28s cubic-bezier(.2,.8,.4,1);
    }
    .ud-overlay { display:none;position:fixed;inset:0;z-index:-1;background:rgba(0,0,0,.65);backdrop-filter:blur(3px); }
    .ud-sidebar--open { left:0; }
    .ud-sidebar--open .ud-overlay { display:block; }

    .ud-sidebar__inner {
      display:flex;flex-direction:column;height:100%;
      padding:1.25rem 1rem;gap:1.1rem;overflow-y:auto;
    }

    /* Brand */
    .ud-brand { display:flex;align-items:center;gap:8px;padding-bottom:.75rem;border-bottom:1px solid var(--border); }
    .ud-brand__icon {
      width:32px;height:32px;border-radius:8px;
      background:var(--gold-dim);border:1px solid var(--gold-brd);
      display:flex;align-items:center;justify-content:center;color:var(--gold);flex-shrink:0;
    }
    .ud-brand__name { font-family:var(--fd);font-size:1.15rem;letter-spacing:.06em;color:var(--text); }

    /* User chip */
    .ud-user-chip {
      display:flex;align-items:center;gap:.65rem;
      padding:.65rem .8rem;border-radius:12px;
      background:var(--gold-dim);border:1px solid var(--gold-brd);
    }
    .ud-user-chip__avatar {
      width:34px;height:34px;border-radius:50%;flex-shrink:0;
      background:var(--gold);color:#1a1200;
      display:flex;align-items:center;justify-content:center;
      font-family:var(--fd);font-size:1.1rem;letter-spacing:.06em;font-weight:700;
    }
    .ud-user-chip__info { min-width:0;flex:1; }
    .ud-user-chip__name { font-weight:600;font-size:.82rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .ud-user-chip__role { font-family:var(--fm);font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-top:1px; }

    /* Nav */
    .ud-nav { display:flex;flex-direction:column;gap:2px;flex:1; }
    .ud-nav__label {
      font-family:var(--fm);font-size:.55rem;letter-spacing:.2em;text-transform:uppercase;
      color:rgba(242,238,230,.22);padding:.5rem .6rem .25rem;
    }
    .ud-nav__item {
      display:flex;align-items:center;gap:.65rem;
      padding:.6rem .75rem;border-radius:10px;
      font-size:.84rem;font-weight:500;color:var(--muted);
      text-decoration:none;cursor:pointer;
      transition:background .15s,color .15s;
    }
    .ud-nav__item:hover { background:rgba(242,238,230,.04);color:var(--text); }
    .ud-nav__item--active { background:var(--gold-dim);color:var(--gold);border:1px solid var(--gold-brd); }
    .ud-nav__icon { width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .ud-nav__icon svg { width:15px;height:15px; }

    /* Footer */
    .ud-sidebar__footer { margin-top:auto;padding-top:.75rem;border-top:1px solid var(--border); }
    .ud-logout-btn {
      display:flex;align-items:center;gap:.6rem;width:100%;
      padding:.6rem .75rem;border-radius:10px;
      background:none;border:none;cursor:pointer;
      font-family:var(--fb);font-size:.84rem;font-weight:500;color:var(--muted);
      transition:background .15s,color .15s;
    }
    .ud-logout-btn:hover { background:rgba(255,68,51,.08);color:var(--coral); }

    /* Main */
    .ud-main { flex:1;display:flex;flex-direction:column;overflow:hidden; }
    .ud-topbar {
      display:flex;align-items:center;gap:.75rem;
      padding:.75rem 1rem;border-bottom:1px solid var(--border);background:var(--bg2);
    }
    .ud-topbar__menu {
      padding:.5rem;background:none;border:1px solid var(--border);
      border-radius:8px;color:var(--muted);cursor:pointer;transition:color .15s,border-color .15s;
    }
    .ud-topbar__menu:hover { color:var(--text); }
    .ud-topbar__brand { font-family:var(--fd);font-size:1.1rem;letter-spacing:.06em;color:var(--text); }
    .ud-topbar__spacer { flex:1; }
    .ud-content { flex:1;overflow-y:auto; }

    @media (min-width: 768px) {
      .ud-sidebar { position:relative;left:0; }
      .ud-overlay { display:none !important; }
      .ud-topbar  { display:none; }
    }
  `],
})
export class UserDashboard {
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);

  mobileMenuOpen = signal(false);

  private get profile() { return this.authService.getUserProfile(); }

  displayName(): string {
    const u = this.profile;
    if (!u) return 'Guest';
    const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return full || u.email || 'Attendee';
  }

  avatarLetter(): string {
    const u = this.profile;
    if (!u) return '?';
    if (u.firstName) return u.firstName.charAt(0).toUpperCase();
    if (u.email)     return u.email.charAt(0).toUpperCase();
    return '?';
  }

// ── Main nav ─────────────────────────────────────────────────────────────
readonly mainNavItems: { label: string; route: string; svg: string; exact?: boolean }[] = [
  {
    label: 'Overview', route: '/user-dashboard', exact: true,
    svg: `<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>`,
  },
  {
    label: 'My Bookings', route: '/user-dashboard/bookings',
    svg: `<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
          </svg>`,
  },
];

// ── Community nav ─────────────────────────────────────────────────────────
readonly communityNavItems: { label: string; route: string; svg: string; exact?: boolean }[] = [
  {
    label: 'Meetups', route: '/user-dashboard/meetups',
    svg: `<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857
                     M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857
                     m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>`,
  },
  {
    label: 'My Meetups', route: '/user-dashboard/my-meetups',
    svg: `<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
                     M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2
                     m-6 9l2 2 4-4"/>
          </svg>`,
  },
  {
    label: 'Created Meetups', route: '/user-dashboard/my-created-meetups',
    svg: `<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>`,
  },
  {
    label: 'Memberships', route: '/user-dashboard/my-memberships',
    svg: `<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031
                     c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584
                     A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0
                     0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0
                     003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0
                     016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5
                     0 2.25 2.25 0 014.5 0z"/>
          </svg>`,
  },
  {
    label: 'Private Events', route: '/user-dashboard/my-private-events',
    svg: `<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0
                     002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0
                     00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
          </svg>`,
  },
];

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}