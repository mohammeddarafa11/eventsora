// src/app/features/user-dashboard/edit-interests/edit-interests.ts
//
// Reached via Profile → Settings → Interests (or the +Add chip on the feed).
// Loads all categories, pre-checks the ones the user already has saved,
// lets them toggle, then diffs and calls the API for additions / removals.
//
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CategoryService, Category } from '@core/services/category';
import { AuthService } from '@core/services/auth.service';

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

@Component({
  selector: 'app-edit-interests',
  standalone: true,
  imports: [CommonModule],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <div class="ei-page">
      <!-- Ambient glows -->
      <div class="ei-glow ei-glow--a" aria-hidden="true"></div>
      <div class="ei-glow ei-glow--b" aria-hidden="true"></div>

      <div class="ei-card">

        <!-- ── HEADER ── -->
        <div class="ei-header">
          <button class="ei-back" type="button" (click)="back()">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12"/>
            </svg>
            Back
          </button>

          <div class="ei-title-row">
            <div>
              <h1 class="ei-title">Your <span class="ei-accent">Interests</span></h1>
              <p class="ei-sub">Tap to add or remove genres from your personalised feed.</p>
            </div>
            @if (changed()) {
              <div class="ei-changed-badge" aria-live="polite">Unsaved</div>
            }
          </div>
        </div>

        <!-- ── SUCCESS TOAST ── -->
        @if (saved()) {
          <div class="ei-toast" role="status" aria-live="polite">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Interests updated — your feed is refreshing!
          </div>
        }

        <!-- ── GRID ── -->
        <div class="ei-scroll">
          @if (loading()) {
            <div class="ei-grid">
              @for (n of skeletons; track n) {
                <div class="ei-skel" [style.animation-delay]="n * 45 + 'ms'"></div>
              }
            </div>
          } @else if (error()) {
            <div class="ei-error">
              <span>Couldn't load categories.</span>
              <button class="ei-retry" type="button" (click)="load()">Retry</button>
            </div>
          } @else {
            <div class="ei-grid">
              @for (cat of categories(); track cat.id; let i = $index) {
                <button
                  class="ei-tile"
                  type="button"
                  [class.ei-tile--on]="selected().has(cat.id)"
                  [style.--tile-bg]="palette(i).bg"
                  [style.--tile-fg]="palette(i).fg"
                  [style.animation-delay]="i * 32 + 'ms'"
                  [attr.aria-pressed]="selected().has(cat.id)"
                  (click)="toggle(cat.id)"
                >
                  <div class="ei-tile-check" aria-hidden="true">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <span class="ei-tile-name">{{ cat.name }}</span>
                  <div class="ei-tile-deco ei-tile-deco--a"></div>
                  <div class="ei-tile-deco ei-tile-deco--b"></div>
                </button>
              }
            </div>
          }
        </div>

        <!-- ── FOOTER ── -->
        <div class="ei-footer">
          <div class="ei-footer-hint" aria-live="polite">
            @if (selected().size === 0)      { Select at least one genre }
            @else if (selected().size === 1) { 1 genre selected }
            @else                            { {{ selected().size }} genres selected }
          </div>

          <button
            class="ei-btn"
            type="button"
            [disabled]="!changed() || selected().size === 0 || saving()"
            (click)="save()"
          >
            @if (saving()) {
              <span class="ei-spin"></span> Saving…
            } @else {
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Save interests
            }
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      --coral: #FF4433; --gold: #F0B429; --green: #22c55e;
      --bg:  #09090c; --bg2: #111116; --text: #F2EEE6;
      --muted: rgba(242,238,230,.45); --bdr: rgba(242,238,230,.07);
      font-family: 'Plus Jakarta Sans', sans-serif; display: block;
    }

    /* Page */
    .ei-page {
      position: relative; min-height: 100dvh; background: var(--bg);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem; overflow: hidden;
    }
    .ei-glow { position: absolute; border-radius: 50%; pointer-events: none; z-index: 0; }
    .ei-glow--a { width:480px;height:480px;top:-140px;left:-100px; background:radial-gradient(circle,rgba(255,68,51,.06) 0%,transparent 70%); }
    .ei-glow--b { width:380px;height:380px;bottom:-100px;right:-80px; background:radial-gradient(circle,rgba(240,180,41,.06) 0%,transparent 70%); }

    /* Card */
    .ei-card {
      position: relative; z-index: 1; width: 100%; max-width: 520px;
      background: var(--bg2); border: 1px solid rgba(242,238,230,.08);
      border-radius: 24px; display: flex; flex-direction: column;
      max-height: calc(100dvh - 2rem); overflow: hidden;
      box-shadow: 0 32px 80px rgba(0,0,0,.55);
      animation: cardIn .4s cubic-bezier(.22,1,.36,1) both;
    }
    @keyframes cardIn { from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none} }

    /* Header */
    .ei-header { padding: 1.5rem 1.5rem .75rem; display: flex; flex-direction: column; gap: .75rem; flex-shrink: 0; }
    .ei-back {
      display: inline-flex; align-items: center; gap: 6px;
      background: none; border: 1px solid var(--bdr); border-radius: 8px;
      padding: .38rem .85rem; color: var(--muted); font-size: .78rem;
      font-weight: 500; cursor: pointer; width: fit-content;
      transition: color .2s, border-color .2s;
    }
    .ei-back:hover { color: var(--text); border-color: rgba(242,238,230,.15); }
    .ei-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .ei-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: clamp(1.8rem,5vw,2.4rem);
      letter-spacing: .03em; line-height: .92; color: var(--text); margin: 0 0 .3rem;
    }
    .ei-accent { color: var(--gold); }
    .ei-sub { font-size: .81rem; color: var(--muted); font-weight: 300; line-height: 1.6; }
    .ei-changed-badge {
      flex-shrink: 0; padding: 4px 10px; border-radius: 100px;
      background: rgba(255,68,51,.1); border: 1px solid rgba(255,68,51,.25);
      color: var(--coral); font-family: 'DM Mono', monospace;
      font-size: .56rem; letter-spacing: .12em; text-transform: uppercase;
      animation: pop .2s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes pop { from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1} }

    /* Toast */
    .ei-toast {
      margin: 0 1.5rem .5rem; padding: .65rem 1rem;
      border-radius: 10px; display: flex; align-items: center; gap: .5rem;
      background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.2);
      color: var(--green); font-size: .8rem; font-weight: 500;
      animation: slideIn .3s cubic-bezier(.22,1,.36,1);
      flex-shrink: 0;
    }
    @keyframes slideIn { from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none} }

    /* Scroll */
    .ei-scroll {
      flex: 1; overflow-y: auto; padding: .25rem 1.5rem .5rem;
      scrollbar-width: thin; scrollbar-color: rgba(242,238,230,.1) transparent;
    }
    .ei-grid {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: .6rem; padding-bottom: .5rem;
    }
    @media (min-width: 400px) { .ei-grid { grid-template-columns: repeat(3, 1fr); } }

    /* Tiles – identical to category-select-sheet */
    .ei-tile {
      position: relative; overflow: hidden; border-radius: 14px;
      border: 2.5px solid transparent;
      background: var(--tile-bg, #1a1a22); color: var(--tile-fg, var(--text));
      padding: 1rem .85rem .85rem; min-height: 78px;
      cursor: pointer; text-align: left;
      transition: transform .22s cubic-bezier(.22,1,.36,1), border-color .18s, box-shadow .22s;
      -webkit-tap-highlight-color: transparent; touch-action: manipulation;
      animation: tileIn .42s cubic-bezier(.22,1,.36,1) both;
    }
    @keyframes tileIn { from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)} }
    .ei-tile:hover  { transform: scale(1.04); }
    .ei-tile--on {
      border-color: rgba(255,255,255,.65) !important;
      box-shadow: 0 0 0 4px rgba(255,255,255,.12), 0 8px 28px rgba(0,0,0,.45);
      transform: scale(1.05);
    }
    .ei-tile-deco {
      position: absolute; border-radius: 50%;
      background: rgba(255,255,255,.1); pointer-events: none;
    }
    .ei-tile-deco--a { width:68px;height:68px;bottom:-22px;right:-22px; }
    .ei-tile-deco--b { width:38px;height:38px;bottom:10px;right:26px;background:rgba(255,255,255,.06); }
    .ei-tile-check {
      position: absolute; top: .55rem; right: .55rem;
      width: 22px; height: 22px; border-radius: 50%;
      background: rgba(255,255,255,.18); border: 1.5px solid rgba(255,255,255,.4);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transform: scale(.4);
      transition: opacity .2s, transform .26s cubic-bezier(.34,1.56,.64,1), background .2s;
    }
    .ei-tile--on .ei-tile-check {
      opacity: 1; transform: scale(1);
      background: rgba(255,255,255,.95); border-color: transparent; color: #000;
    }
    .ei-tile-name {
      display: block; position: relative; z-index: 1;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.05rem; letter-spacing: .04em; line-height: 1;
    }

    /* Skeleton */
    .ei-skel {
      height: 78px; border-radius: 14px;
      background: linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.08) 50%,rgba(242,238,230,.04) 75%);
      background-size: 600px 100%; animation: shimmer 1.5s ease-in-out infinite;
    }
    @keyframes shimmer { from{background-position:-400px 0}to{background-position:400px 0} }

    /* Error */
    .ei-error {
      display: flex; flex-direction: column; align-items: center; gap: 1rem;
      padding: 2.5rem; color: var(--muted); font-size: .85rem;
    }
    .ei-retry {
      background: none; border: 1px solid var(--bdr); border-radius: 8px;
      padding: .4rem .9rem; color: var(--text); font-size: .8rem; cursor: pointer;
    }

    /* Footer */
    .ei-footer {
      flex-shrink: 0; padding: 1rem 1.5rem 1.5rem;
      display: flex; flex-direction: column; gap: .6rem;
      border-top: 1px solid var(--bdr);
    }
    .ei-footer-hint {
      text-align: center; font-family: 'DM Mono', monospace;
      font-size: .61rem; letter-spacing: .1em; text-transform: uppercase; color: var(--muted);
    }
    .ei-btn {
      width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: .55rem;
      padding: .88rem 1.5rem; border-radius: 12px;
      background: var(--gold); color: #1a1200; border: none;
      font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: .95rem;
      cursor: pointer; transition: box-shadow .25s, transform .18s, opacity .2s;
      box-shadow: 0 0 32px rgba(240,180,41,.28); touch-action: manipulation;
    }
    .ei-btn:hover:not(:disabled) { box-shadow: 0 0 52px rgba(240,180,41,.5); transform: translateY(-2px); }
    .ei-btn:disabled { opacity: .38; cursor: not-allowed; transform: none; box-shadow: none; }
    .ei-spin {
      width:15px;height:15px;border:2px solid rgba(26,18,0,.3);border-top-color:#1a1200;
      border-radius:50%;animation:spin .7s linear infinite;display:inline-block;
    }
    @keyframes spin { to{transform:rotate(360deg)} }
  `],
})
export class EditInterests implements OnInit {
  private readonly catSvc  = inject(CategoryService);
  private readonly authSvc = inject(AuthService);
  private readonly http    = inject(HttpClient);
  private readonly router  = inject(Router);

  private readonly baseUrl = 'https://eventora.runasp.net/api';

  categories = signal<Category[]>([]);
  loading    = signal(true);
  saving     = signal(false);
  error      = signal(false);
  saved      = signal(false);

  /** Set of IDs the user has selected in this session */
  selected   = signal<Set<number>>(new Set());
  /** Original saved IDs from when the page loaded */
  private original = new Set<number>();

  readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  /** True when selection differs from what was saved */
  changed = computed(() => {
    const s = this.selected();
    if (s.size !== this.original.size) return true;
    for (const id of s) { if (!this.original.has(id)) return true; }
    return false;
  });

  ngOnInit(): void { this.load(); }

  palette(i: number) { return PALETTE[i % PALETTE.length]; }

  load(): void {
    this.loading.set(true);
    this.error.set(false);

    // Initialise selection from localStorage immediately (no extra network call)
    const saved = new Set<number>(this.authSvc.getSavedCategoryIds() ?? []);
    this.selected.set(new Set(saved));
    this.original = new Set(saved);

    this.catSvc.getAllCategories().subscribe({
      next:  cats => { this.categories.set(cats); this.loading.set(false); },
      error: ()   => { this.error.set(true);       this.loading.set(false); },
    });
  }

  toggle(id: number): void {
    this.saved.set(false);
    this.selected.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  save(): void {
    if (!this.changed() || this.selected().size === 0 || this.saving()) return;
    this.saving.set(true);

    const newSet = this.selected();
    const added   = [...newSet].filter(id => !this.original.has(id));
    const removed = [...this.original].filter(id => !newSet.has(id));

    const ops: Array<ReturnType<typeof this.http.post | typeof this.http.delete>> = [];

    if (added.length > 0) {
      ops.push(
        this.http.post(`${this.baseUrl}/User/add-favorites`, added).pipe(catchError(() => of(null)))
      );
    }
    removed.forEach(id => {
      ops.push(
        this.http.delete(`${this.baseUrl}/User/remove-favorite/${id}`).pipe(catchError(() => of(null)))
      );
    });

    const finish = () => {
      const ids = Array.from(newSet);
      this.authSvc.saveCategoryIds(ids);
      this.original = new Set(ids);
      this.saving.set(false);
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3500);
    };

    if (ops.length === 0) { finish(); return; }

    forkJoin(ops).subscribe({ next: finish, error: finish });
  }

  back(): void {
    window.history.length > 1
      ? window.history.back()
      : this.router.navigate(['/user-dashboard']);
  }
}

