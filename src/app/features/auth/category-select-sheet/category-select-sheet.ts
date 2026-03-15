// src/app/features/auth/category-select-sheet/category-select-sheet.ts
//
// Two-step onboarding sheet:
//   Step 1 – Category selection (guarded by GET /api/User → has_Selected_Favorites)
//   Step 2 – Suggested organizers (Flow C): shown after saving categories
//
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { CategoryService, Category } from '@core/services/category';
import { UserService } from '@core/services/user.service';
import { AuthService } from '@core/services/auth.service';
import { FollowService, FollowedOrg } from '@core/services/follow.service';

const PALETTE = [
  { bg: '#1DB954', fg: '#052e12' }, { bg: '#FF4433', fg: '#fff'    },
  { bg: '#F0B429', fg: '#1a0f00' }, { bg: '#a78bfa', fg: '#160a30' },
  { bg: '#0ea5e9', fg: '#001c2e' }, { bg: '#f97316', fg: '#1e0700' },
  { bg: '#ec4899', fg: '#200010' }, { bg: '#84cc16', fg: '#0f1800' },
  { bg: '#6366f1', fg: '#0a0b20' }, { bg: '#14b8a6', fg: '#001a18' },
  { bg: '#ef4444', fg: '#fff'    }, { bg: '#d946ef', fg: '#1a0018' },
  { bg: '#f59e0b', fg: '#1a0d00' }, { bg: '#22d3ee', fg: '#00171c' },
  { bg: '#4ade80', fg: '#011a07' }, { bg: '#fb7185', fg: '#1a0008' },
];

type SheetStep = 'categories' | 'orgs';

interface SuggestedOrg { id: number; name: string; logoUrl?: string | null; }

@Component({
  selector: 'app-category-select-sheet',
  standalone: true,
  imports: [CommonModule],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <div class="cp-page">
      <div class="cp-glow cp-glow--a" aria-hidden="true"></div>
      <div class="cp-glow cp-glow--b" aria-hidden="true"></div>
      <div class="cp-grain"           aria-hidden="true"></div>

      <!-- ── INITIALISING SPLASH ── -->
      @if (initialising()) {
        <div class="cp-splash" aria-live="polite" aria-busy="true">
          <div class="cp-splash__ring"></div>
          <span class="cp-splash__label">Setting up your feed…</span>
        </div>
      }

      @if (!initialising()) {

        <!-- ══════════════════════════════════ -->
        <!--  STEP 1 – CATEGORY SELECTION      -->
        <!-- ══════════════════════════════════ -->
        @if (step() === 'categories') {
          <div class="cp-card" (click)="$event.stopPropagation()">

            <div class="cp-header">
              <!-- Brand -->
              <div class="cp-brand">
                <div class="cp-brand-ring">
                  <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M6 2v4M18 2v4M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z"/>
                  </svg>
                </div>
                <span class="cp-brand-name">Eventsora</span>
              </div>
              <!-- Step pill -->
              <div class="cp-step-track">
                <div class="cp-step-fill" style="width:50%"></div>
              </div>
              <span class="cp-step-label">Step 1 of 2 — Choose your genres</span>
              <div class="cp-header-body">
                <h1 class="cp-title">What are you<br/><span class="cp-accent">into?</span></h1>
                <p class="cp-sub">Pick at least one genre — we'll build your personal event feed.</p>
              </div>
              @if (selected().size > 0) {
                <div class="cp-count-badge" aria-live="polite">{{ selected().size }}</div>
              }
            </div>

            <div class="cp-scroll">
              @if (loading()) {
                <div class="cp-grid">
                  @for (n of skeletons; track n) {
                    <div class="cp-skel" [style.animation-delay]="n * 55 + 'ms'"></div>
                  }
                </div>
              } @else if (error()) {
                <div class="cp-error">
                  <span>Failed to load categories.</span>
                  <button class="cp-retry" type="button" (click)="loadCategories()">Retry</button>
                </div>
              } @else {
                <div class="cp-grid">
                  @for (cat of categories(); track cat.id; let i = $index) {
                    <button
                      class="cp-tile"
                      type="button"
                      [class.cp-tile--on]="selected().has(cat.id)"
                      [style.--tile-bg]="palette(i).bg"
                      [style.--tile-fg]="palette(i).fg"
                      [style.animation-delay]="i * 35 + 'ms'"
                      [attr.aria-pressed]="selected().has(cat.id)"
                      (click)="toggle(cat.id)"
                    >
                      <div class="cp-tile-check" aria-hidden="true">
                        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                      <span class="cp-tile-name">{{ cat.name }}</span>
                      <div class="cp-tile-deco cp-tile-deco--a"></div>
                      <div class="cp-tile-deco cp-tile-deco--b"></div>
                    </button>
                  }
                </div>
              }
            </div>

            <div class="cp-footer">
              <div class="cp-footer-hint" aria-live="polite">
                @if (selected().size === 0)      { Pick at least one genre to continue }
                @else if (selected().size === 1)  { 1 genre selected — pick more for better results! }
                @else                             { {{ selected().size }} genres selected }
              </div>
              <button class="cp-btn" type="button"
                      [disabled]="selected().size === 0 || saving()"
                      (click)="save()">
                @if (saving()) {
                  <span class="cp-spin"></span> Saving…
                } @else {
                  <span>Continue</span>
                  <span class="cp-btn-arrow">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                    </svg>
                  </span>
                }
              </button>
              <button class="cp-skip" type="button" (click)="skip()">Skip for now</button>
            </div>

          </div>
        }

        <!-- ══════════════════════════════════ -->
        <!--  STEP 2 – SUGGESTED ORGANISERS    -->
        <!-- ══════════════════════════════════ -->
        @if (step() === 'orgs') {
          <div class="cp-card cp-card--orgs" (click)="$event.stopPropagation()">

            <div class="cp-header">
              <!-- Brand -->
              <div class="cp-brand">
                <div class="cp-brand-ring">
                  <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M6 2v4M18 2v4M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z"/>
                  </svg>
                </div>
                <span class="cp-brand-name">Eventsora</span>
              </div>
              <!-- Step pill -->
              <div class="cp-step-track">
                <div class="cp-step-fill" style="width:100%"></div>
              </div>
              <span class="cp-step-label">Step 2 of 2 — Follow organizers</span>
              <div class="cp-header-body">
                <h1 class="cp-title">Popular <span class="cp-accent">organizers</span></h1>
                <p class="cp-sub">Follow organizers to get notified when they create new events in your genres.</p>
              </div>
            </div>

            <!-- Org list -->
            <div class="cp-scroll">
              @if (orgsLoading()) {
                <div class="cp-org-skel-list">
                  @for (n of [0,1,2,3,4]; track n) {
                    <div class="cp-org-skel" [style.animation-delay]="n * 60 + 'ms'"></div>
                  }
                </div>
              } @else if (suggestedOrgs().length === 0) {
                <div class="cp-error" style="padding:2rem 1rem">
                  <span>No organizers found yet — check back later!</span>
                </div>
              } @else {
                <div class="cp-org-list">
                  @for (org of suggestedOrgs(); track org.id; let i = $index) {
                    <div class="cp-org-row" [style.animation-delay]="i * 70 + 'ms'">
                      <!-- Avatar -->
                      <div class="cp-org-avatar">
                        @if (org.logoUrl) {
                          <img [src]="org.logoUrl" [alt]="org.name" class="cp-org-avatar__img"/>
                        } @else {
                          <span class="cp-org-avatar__initial">{{ org.name.charAt(0) }}</span>
                        }
                      </div>
                      <!-- Name -->
                      <span class="cp-org-name">{{ org.name }}</span>
                      <!-- Follow toggle -->
                      <button
                        class="cp-follow-btn"
                        [class.cp-follow-btn--on]="followSvc.isFollowing(org.id)"
                        (click)="toggleFollow(org)"
                      >
                        @if (followSvc.isFollowing(org.id)) {
                          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.8" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                          </svg>
                          Following
                        } @else {
                          + Follow
                        }
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="cp-footer">
              <div class="cp-footer-hint">
                @if (followedCount() === 0) { Follow at least one to get org updates }
                @else { Following {{ followedCount() }} organizer{{ followedCount() === 1 ? '' : 's' }} }
              </div>
              <button class="cp-btn" type="button" (click)="finish()">
                <span>Go to my feed</span>
                <span class="cp-btn-arrow">
                  <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg>
                </span>
              </button>
              <button class="cp-skip" type="button" (click)="finish()">Skip for now</button>
            </div>

          </div>
        }

      }<!-- /!initialising -->
    </div>
  `,
  styles: [`
    :host {
      --coral: #FF4433; --gold: #F0B429; --bg: #09090c; --bg2: #111116;
      --text: #F2EEE6; --muted: rgba(242,238,230,.45); --bdr: rgba(242,238,230,.07);
      font-family: 'Plus Jakarta Sans', sans-serif; display: block;
    }
    .cp-page {
      position:relative; min-height:100dvh; background:var(--bg);
      display:flex; align-items:center; justify-content:center;
      padding:1rem; overflow:hidden;
    }
    .cp-glow { position:absolute; border-radius:50%; pointer-events:none; z-index:0; }
    .cp-glow--a { width:520px;height:520px;top:-160px;left:-120px; background:radial-gradient(circle,rgba(255,68,51,.07) 0%,transparent 70%); }
    .cp-glow--b { width:380px;height:380px;bottom:-120px;right:-80px; background:radial-gradient(circle,rgba(240,180,41,.07) 0%,transparent 70%); }
    .cp-grain {
      position:absolute; inset:0; z-index:0; opacity:.5; pointer-events:none;
      background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
    }
    .cp-splash {
      position:relative; z-index:1;
      display:flex; flex-direction:column; align-items:center; gap:1rem;
    }
    .cp-splash__ring {
      width:44px;height:44px;border-radius:50%;
      border:3px solid rgba(240,180,41,.15); border-top-color:var(--gold);
      animation:spin .8s linear infinite;
    }
    .cp-splash__label { font-size:.78rem;color:var(--muted);font-family:'DM Mono',monospace;letter-spacing:.1em; }
    @keyframes spin { to{transform:rotate(360deg)} }

    .cp-card {
      position:relative; z-index:1; width:100%; max-width:520px;
      background:var(--bg2); border:1px solid rgba(242,238,230,.08);
      border-radius:24px; display:flex; flex-direction:column;
      max-height:calc(100dvh - 2rem); overflow:hidden;
      box-shadow:0 32px 80px rgba(0,0,0,.6);
      animation:cardIn .42s cubic-bezier(.22,1,.36,1) both;
    }
    @keyframes cardIn { from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none} }

    .cp-header {
      padding:1.5rem 1.5rem .75rem; display:flex; flex-direction:column;
      gap:.65rem; flex-shrink:0; position:relative;
    }
    .cp-brand { display:flex; align-items:center; gap:9px; }
    .cp-brand-ring {
      width:30px;height:30px;border-radius:50%;flex-shrink:0;
      border:1.5px solid rgba(255,68,51,.4); background:rgba(255,68,51,.08);
      color:var(--coral); display:flex;align-items:center;justify-content:center;
    }
    .cp-brand-name { font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:.06em;color:var(--text); }

    .cp-step-track { width:100%;height:3px;border-radius:99px;background:rgba(242,238,230,.06);overflow:hidden; }
    .cp-step-fill {
      height:100%;border-radius:99px;background:var(--gold);
      transition:width .55s cubic-bezier(.22,1,.36,1);
    }
    .cp-step-label { font-size:.56rem;letter-spacing:.13em;text-transform:uppercase;color:rgba(242,238,230,.28);font-family:'DM Mono',monospace; }

    .cp-header-body { display:flex;flex-direction:column;gap:.28rem; }
    .cp-title {
      font-family:'Bebas Neue',sans-serif; font-size:clamp(2rem,6vw,2.6rem);
      letter-spacing:.03em;line-height:.92;color:var(--text);margin:0;
    }
    .cp-accent { color:var(--gold); }
    .cp-sub { font-size:.81rem;color:var(--muted);font-weight:300;line-height:1.6; }
    .cp-count-badge {
      position:absolute;top:1.5rem;right:1.5rem;
      min-width:36px;height:36px;border-radius:50%;
      background:var(--gold);color:#1a1200;
      font-family:'Bebas Neue',sans-serif;font-size:1.05rem;letter-spacing:.05em;
      display:flex;align-items:center;justify-content:center;
      animation:pop .28s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes pop { from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1} }

    .cp-scroll {
      flex:1;overflow-y:auto;padding:.25rem 1.5rem .5rem;
      scrollbar-width:thin;scrollbar-color:rgba(242,238,230,.1) transparent;
    }
    .cp-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem;padding-bottom:.5rem; }
    @media(min-width:400px){ .cp-grid{ grid-template-columns:repeat(3,1fr); } }

    /* Tiles */
    .cp-tile {
      position:relative;overflow:hidden;border-radius:14px;border:2.5px solid transparent;
      background:var(--tile-bg,#1a1a22);color:var(--tile-fg,var(--text));
      padding:1rem .85rem .85rem;min-height:78px;cursor:pointer;text-align:left;
      transition:transform .22s cubic-bezier(.22,1,.36,1),border-color .18s,box-shadow .22s;
      -webkit-tap-highlight-color:transparent;touch-action:manipulation;
      animation:tileIn .42s cubic-bezier(.22,1,.36,1) both;
    }
    @keyframes tileIn { from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)} }
    .cp-tile:hover { transform:scale(1.04); }
    .cp-tile--on {
      border-color:rgba(255,255,255,.65)!important;
      box-shadow:0 0 0 4px rgba(255,255,255,.12),0 8px 28px rgba(0,0,0,.45);
      transform:scale(1.05);
    }
    .cp-tile-deco { position:absolute;border-radius:50%;background:rgba(255,255,255,.1);pointer-events:none; }
    .cp-tile-deco--a { width:68px;height:68px;bottom:-22px;right:-22px; }
    .cp-tile-deco--b { width:38px;height:38px;bottom:10px;right:26px;background:rgba(255,255,255,.06); }
    .cp-tile-check {
      position:absolute;top:.55rem;right:.55rem;width:22px;height:22px;border-radius:50%;
      background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.4);
      display:flex;align-items:center;justify-content:center;
      opacity:0;transform:scale(.4);
      transition:opacity .2s,transform .26s cubic-bezier(.34,1.56,.64,1),background .2s;
    }
    .cp-tile--on .cp-tile-check {
      opacity:1;transform:scale(1);background:rgba(255,255,255,.95);border-color:transparent;color:#000;
    }
    .cp-tile-name {
      display:block;position:relative;z-index:1;
      font-family:'Bebas Neue',sans-serif;font-size:1.05rem;letter-spacing:.04em;line-height:1;
    }

    /* Skeleton */
    .cp-skel {
      height:78px;border-radius:14px;
      background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.08) 50%,rgba(242,238,230,.04) 75%);
      background-size:600px 100%;animation:shimmer 1.5s ease-in-out infinite;
    }
    @keyframes shimmer { from{background-position:-400px 0}to{background-position:400px 0} }

    .cp-error {
      display:flex;flex-direction:column;align-items:center;gap:1rem;
      padding:2.5rem;color:var(--muted);font-size:.85rem;
    }
    .cp-retry {
      background:none;border:1px solid var(--bdr);border-radius:8px;
      padding:.4rem .9rem;color:var(--text);font-size:.8rem;cursor:pointer;
    }

    /* ── Org list (Step 2) ── */
    .cp-org-list { display:flex;flex-direction:column;gap:.5rem;padding-bottom:.5rem; }
    .cp-org-skel-list { display:flex;flex-direction:column;gap:.5rem;padding:.5rem 0; }
    .cp-org-skel {
      height:60px;border-radius:14px;
      background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.08) 50%,rgba(242,238,230,.04) 75%);
      background-size:600px 100%;animation:shimmer 1.5s ease-in-out infinite;
    }
    .cp-org-row {
      display:flex;align-items:center;gap:.9rem;
      padding:.75rem 1rem;border-radius:14px;
      background:rgba(242,238,230,.03);border:1px solid var(--bdr);
      animation:tileIn .4s cubic-bezier(.22,1,.36,1) both;
      transition:border-color .2s;
    }
    .cp-org-row:hover { border-color:rgba(242,238,230,.12); }
    .cp-org-avatar {
      width:40px;height:40px;border-radius:12px;flex-shrink:0;overflow:hidden;
      background:rgba(240,180,41,.1);border:1px solid rgba(240,180,41,.2);
      display:flex;align-items:center;justify-content:center;
    }
    .cp-org-avatar__img { width:100%;height:100%;object-fit:cover; }
    .cp-org-avatar__initial {
      font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.04em;color:var(--gold);
    }
    .cp-org-name {
      flex:1;font-weight:600;font-size:.9rem;color:var(--text);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .cp-follow-btn {
      flex-shrink:0;display:inline-flex;align-items:center;gap:.35rem;
      padding:.38rem .85rem;border-radius:8px;border:1.5px solid rgba(240,180,41,.4);
      background:transparent;color:var(--gold);
      font-family:'Plus Jakarta Sans',sans-serif;font-size:.76rem;font-weight:600;
      cursor:pointer;transition:all .2s;white-space:nowrap;
    }
    .cp-follow-btn:hover { background:rgba(240,180,41,.1); }
    .cp-follow-btn--on {
      background:rgba(240,180,41,.12)!important;
      border-color:var(--gold)!important;
    }

    /* Footer */
    .cp-footer {
      flex-shrink:0;padding:1rem 1.5rem 1.5rem;
      display:flex;flex-direction:column;gap:.6rem;
      border-top:1px solid var(--bdr);
    }
    .cp-footer-hint {
      text-align:center;font-family:'DM Mono',monospace;
      font-size:.61rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
    }
    .cp-btn {
      width:100%;display:inline-flex;align-items:center;justify-content:center;gap:.65rem;
      padding:.88rem 1.5rem;border-radius:12px;
      background:var(--gold);color:#1a1200;border:none;
      font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:.95rem;
      cursor:pointer;transition:box-shadow .25s,transform .18s,opacity .2s;
      box-shadow:0 0 32px rgba(240,180,41,.28);touch-action:manipulation;
    }
    .cp-btn:hover:not(:disabled) { box-shadow:0 0 56px rgba(240,180,41,.52);transform:translateY(-2px); }
    .cp-btn:disabled { opacity:.4;cursor:not-allowed;transform:none;box-shadow:none; }
    .cp-btn-arrow {
      width:28px;height:28px;border-radius:8px;background:rgba(0,0,0,.15);
      display:flex;align-items:center;justify-content:center;transition:transform .2s;
    }
    .cp-btn:hover:not(:disabled) .cp-btn-arrow { transform:translateX(3px); }
    .cp-skip {
      background:none;border:none;padding:.4rem;
      font-size:.8rem;font-weight:500;color:var(--muted);
      cursor:pointer;transition:color .2s;text-align:center;touch-action:manipulation;
    }
    .cp-skip:hover { color:var(--text); }
    .cp-spin {
      width:16px;height:16px;border:2px solid rgba(26,18,0,.3);border-top-color:#1a1200;
      border-radius:50%;animation:spin .7s linear infinite;display:inline-block;
    }
  `],
})
export class CategorySelectPage implements OnInit {
  private readonly catSvc   = inject(CategoryService);
  private readonly userSvc  = inject(UserService);
  private readonly authSvc  = inject(AuthService);
  private readonly router   = inject(Router);
  private readonly http     = inject(HttpClient);
  readonly followSvc        = inject(FollowService);

  private readonly baseUrl  = 'https://eventora.runasp.net/api';

  /** Controls whether we show the initialising splash */
  initialising = signal(true);
  /** Which step of onboarding we're on */
  step         = signal<SheetStep>('categories');

  // ── Step 1 state ─────────────────────────────────────────────────────
  categories = signal<Category[]>([]);
  selected   = signal<Set<number>>(new Set());
  loading    = signal(false);
  saving     = signal(false);
  error      = signal(false);

  // ── Step 2 state ─────────────────────────────────────────────────────
  suggestedOrgs = signal<SuggestedOrg[]>([]);
  orgsLoading   = signal(false);

  /** Count of suggested orgs that are followed (for footer hint) */
  followedCount = computed(() =>
    this.suggestedOrgs().filter(o => this.followSvc.isFollowing(o.id)).length
  );

  readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  ngOnInit(): void {
    this.userSvc.getCurrentUser().pipe(
      catchError(() => of(null)),
    ).subscribe(profile => {
      const hasSelected = (profile as any)?.has_Selected_Favorites === true;
      if (hasSelected) { this.router.navigate(['/user-dashboard']); return; }
      this.initialising.set(false);
      this.loadCategories();
    });
  }

  palette(i: number) { return PALETTE[i % PALETTE.length]; }

  loadCategories(): void {
    this.loading.set(true);
    this.error.set(false);
    this.catSvc.getAllCategories().subscribe({
      next:  cats => { this.categories.set(cats); this.loading.set(false); },
      error: ()   => { this.error.set(true);       this.loading.set(false); },
    });
  }

  toggle(id: number): void {
    this.selected.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  save(): void {
    if (this.selected().size === 0 || this.saving()) return;
    this.saving.set(true);
    const ids = Array.from(this.selected());
    this.authSvc.saveCategoryIds(ids);

    this.userSvc.addFavorites(ids).subscribe({
      next:  () => { this.saving.set(false); this.loadSuggestedOrgs(ids); },
      error: () => { this.saving.set(false); this.loadSuggestedOrgs(ids); },
    });
  }

  skip(): void {
    this.authSvc.saveCategoryIds([]);
    this.finish();
  }

  toggleFollow(org: SuggestedOrg): void {
    this.followSvc.toggle({ id: org.id, name: org.name, logoUrl: org.logoUrl });
  }

  finish(): void { this.router.navigate(['/user-dashboard']); }

  // ── Step 2: fetch suggested orgs ─────────────────────────────────────

  private loadSuggestedOrgs(categoryIds: number[]): void {
    this.step.set('orgs');
    this.orgsLoading.set(true);

    // Fetch events for top 3 selected categories, extract unique organisations
    const topIds = categoryIds.slice(0, 3);
    forkJoin(
      topIds.map(id =>
        this.http
          .get<{ data: any[] }>(`${this.baseUrl}/Event/Category?categoryId=${id}`)
          .pipe(catchError(() => of({ data: [] })))
      )
    ).subscribe(results => {
      const orgsMap = new Map<number, SuggestedOrg>();
      results.forEach(r => {
        (r.data ?? []).forEach((ev: any) => {
          if (ev.organizationId && ev.organization && !orgsMap.has(ev.organizationId)) {
            orgsMap.set(ev.organizationId, {
              id:      ev.organizationId,
              name:    ev.organization.name ?? 'Organizer',
              logoUrl: ev.organization.logoUrl ?? null,
            });
          }
        });
      });
      this.suggestedOrgs.set(Array.from(orgsMap.values()).slice(0, 5));
      this.orgsLoading.set(false);
    });
  }
}