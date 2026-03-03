// src/app/features/user-dashboard/user-bookings/user-bookings.ts
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { TicketService, Booking, TicketTier } from '@core/services/ticket.service';
import { ZardIconComponent } from '@shared/components/icon/icon.component';
import { ZARD_ICONS } from '@shared/components/icon/icons';
type ZardIcon = keyof typeof ZARD_ICONS;

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-EG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
function fmtTime(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
}

interface TierMeta {
  label:     string;
  icon:      ZardIcon;
  accent:    string;
  accentDim: string;
  accentBdr: string;
}

const TIER_META: Record<number, TierMeta> = {
  [TicketTier.Standard]: {
    label: 'Standard', icon: 'ticket',
    accent: '#94a3b8', accentDim: 'rgba(148,163,184,.08)', accentBdr: 'rgba(148,163,184,.2)',
  },
  [TicketTier.VIP]: {
    label: 'VIP', icon: 'zap',
    accent: '#F0B429', accentDim: 'rgba(240,180,41,.1)', accentBdr: 'rgba(240,180,41,.25)',
  },
  [TicketTier.Premium]: {
    label: 'Premium', icon: 'badge-check',
    accent: '#a78bfa', accentDim: 'rgba(167,139,250,.1)', accentBdr: 'rgba(167,139,250,.25)',
  },
};

function getTier(b: Booking): TicketTier {
  // tier lives directly on eventTicket (API response)
  const t = (b.eventTicket as any)?.tier;
  if (t === 1) return TicketTier.VIP;
  if (t === 2) return TicketTier.Premium;
  return TicketTier.Standard;
}

@Component({
  selector: 'app-user-bookings',
  standalone: true,
  imports: [CommonModule, ZardIconComponent],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <div class="ub-root">

      <!-- ── Header ── -->
      <header class="ub-hero">
        <div class="ub-hero-orb" aria-hidden="true"></div>
        <div class="ub-hero-content">
          <div class="ub-eyebrow">
            <span class="ub-pill">My Tickets</span>
            @if (!loading() && bookings().length > 0) {
              <span class="ub-pill ub-pill--muted">
                {{ bookings().length }} booking{{ bookings().length !== 1 ? 's' : '' }}
              </span>
            }
          </div>
          <h1 class="ub-title">
            <span class="ub-title-stroke">YOUR</span>
            <span class="ub-title-solid">BOOKINGS</span>
          </h1>
          <p class="ub-subtitle">All your event tickets in one place.</p>
        </div>
      </header>

      <!-- ── Content ── -->
      <main class="ub-main">

        @if (loading()) {
          <div class="ub-list">
            @for (n of skeletons; track n) {
              <div class="ub-skel" [style.animation-delay]="n * 70 + 'ms'">
                <div class="ub-skel__left">
                  <div class="ub-skel__line ub-skel__line--xs"></div>
                  <div class="ub-skel__line ub-skel__line--lg"></div>
                  <div class="ub-skel__line ub-skel__line--md"></div>
                </div>
                <div class="ub-skel__right">
                  <div class="ub-skel__line ub-skel__line--sm"></div>
                  <div class="ub-skel__badge"></div>
                </div>
              </div>
            }
          </div>

        } @else if (error()) {
          <div class="ub-empty">
            <div class="ub-empty__icon-wrap">
              <div z-icon zType="triangle-alert" class="ub-empty__svg"></div>
            </div>
            <p class="ub-empty__title">Couldn't load bookings</p>
            <p class="ub-empty__sub">Check your connection and try again.</p>
            <button class="ub-btn" (click)="load()">Try again</button>
          </div>

        } @else if (bookings().length === 0) {
          <div class="ub-empty">
            <div class="ub-empty__icon-wrap">
              <div z-icon zType="ticket" class="ub-empty__svg"></div>
            </div>
            <p class="ub-empty__title">No bookings yet</p>
            <p class="ub-empty__sub">Explore events and grab your first ticket!</p>
            <button class="ub-btn" (click)="router.navigate(['/user-dashboard'])">Browse Events</button>
          </div>

        } @else {
          <!-- Filter tabs -->
          <div class="ub-tabs">
            <button class="ub-tab" [class.ub-tab--on]="filter() === 'all'"    (click)="filter.set('all')">All</button>
            <button class="ub-tab" [class.ub-tab--on]="filter() === 'unused'" (click)="filter.set('unused')">Unused</button>
            <button class="ub-tab" [class.ub-tab--on]="filter() === 'used'"   (click)="filter.set('used')">Used</button>
          </div>

          @if (filtered().length === 0) {
            <div class="ub-empty ub-empty--sm">
              <div class="ub-empty__icon-wrap">
                <div z-icon zType="inbox" class="ub-empty__svg"></div>
              </div>
              <p class="ub-empty__title">No {{ filter() }} tickets</p>
            </div>
          } @else {
            <div class="ub-list">
              @for (b of filtered(); track b.id; let i = $index) {

                <!-- Accent bar color driven by tier -->
                <div class="ub-card" [class.ub-card--used]="b.isUsed"
                     [style.animation-delay]="i * 50 + 'ms'"
                     [style.--tier-accent]="meta(b).accent"
                     [style.--tier-dim]="meta(b).accentDim"
                     [style.--tier-bdr]="meta(b).accentBdr">

                  <!-- Top accent stripe -->
                  <div class="ub-card__stripe" [style.background]="meta(b).accent"></div>

                  <div class="ub-card__body">

                    <!-- Left -->
                    <div class="ub-card__left">

                      <!-- Tier badge with icon -->
                      <div class="ub-tier-badge">
                        <div z-icon [zType]="meta(b).icon" class="ub-tier-badge__icon"
                             [style.color]="meta(b).accent"></div>
                        <span [style.color]="meta(b).accent">{{ meta(b).label }}</span>
                      </div>

                      <!-- Event title -->
                      <h3 class="ub-card__event-title">{{ getEventTitle(b) }}</h3>

                      <!-- Meta row -->
                      <div class="ub-card__meta-row">
                        <span class="ub-card__meta">
                          <div z-icon zType="calendar" class="ub-icon-xs"></div>
                          Booked {{ fmtDate(b.purchaseDate) }}
                        </span>
                        @if (b.eventTicket?.actualPrice != null) {
                          <span class="ub-card__meta">
                            <div z-icon zType="circle-dollar-sign" class="ub-icon-xs"></div>
                            @if (b.eventTicket!.actualPrice === 0) { Free }
                            @else { EGP {{ b.eventTicket!.actualPrice | number:'1.0-0' }} }
                          </span>
                        }
                      </div>

                      @if (b.eventTicket?.ticketTemplate?.name) {
                        <div class="ub-card__ticket-name">{{ b.eventTicket!.ticketTemplate!.name }}</div>
                      }
                    </div>

                    <!-- Dashed divider -->
                    <div class="ub-card__divider" aria-hidden="true"></div>

                    <!-- Right -->
                    <div class="ub-card__right">
                      @if (b.isUsed) {
                        <span class="ub-status ub-status--used">
                          <div z-icon zType="check" class="ub-icon-xs"></div>
                          Used
                        </span>
                      } @else {
                        <span class="ub-status ub-status--valid">
                          <span class="ub-pulse"></span>
                          Valid
                        </span>
                      }

                      <button class="ub-show-btn" (click)="toggleExpand(b.id)">
                        {{ expanded() === b.id ? 'Hide' : 'Show' }} ticket
                        <div z-icon zType="chevron-down" class="ub-icon-xs"
                             [style.transform]="expanded() === b.id ? 'rotate(180deg)' : 'none'"
                             style="transition:transform .2s"></div>
                      </button>
                    </div>
                  </div>

                  <!-- Expanded ticket code -->
                  @if (expanded() === b.id) {
                    <div class="ub-card__expand">
                      <div class="ub-ticket-code-wrap">

                        <!-- QR pattern -->
                        <div class="ub-qr" aria-hidden="true"
                             [style.border-color]="meta(b).accentBdr">
                          @for (cell of qrPattern; track $index) {
                            <div class="ub-qr__cell"
                                 [class.ub-qr__cell--filled]="cell === 1"
                                 [style.background]="cell === 1 ? meta(b).accent : 'transparent'"></div>
                          }
                        </div>

                        <div class="ub-ticket-code-info">
                          <div class="ub-code-label">Ticket Code</div>
                          <div class="ub-code-value">{{ formatCode(b.ticketUniqueCode) }}</div>

                          @if (b.isUsed && b.usedAt) {
                            <div class="ub-used-at">
                              <div z-icon zType="clock" class="ub-icon-xs"></div>
                              Used on {{ fmtDate(b.usedAt) }} at {{ fmtTime(b.usedAt) }}
                            </div>
                          }

                          <button class="ub-copy-btn"
                                  [style.color]="meta(b).accent"
                                  [style.border-color]="meta(b).accentBdr"
                                  [style.background]="meta(b).accentDim"
                                  (click)="copyCode(b.ticketUniqueCode)">
                            @if (copied() === b.ticketUniqueCode) {
                              <div z-icon zType="check" class="ub-icon-xs"></div>
                              Copied!
                            } @else {
                              <div z-icon zType="copy" class="ub-icon-xs"></div>
                              Copy code
                            }
                          </button>
                        </div>
                      </div>

                      @if (b.eventTicket?.eventId) {
                        <button class="ub-view-event-btn"
                                (click)="router.navigate(['/user-dashboard/events', b.eventTicket!.eventId])">
                          <div z-icon zType="arrow-up-right" class="ub-icon-sm"></div>
                          View Event
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        }
      </main>
    </div>
  `,
  styles: [`
    :host {
      --coral:  #FF4433;
      --gold:   #F0B429;
      --green:  #22c55e;
      --purple: #a78bfa;
      --bg:     #060608;
      --bg2:    #09090c;
      --bg3:    #111116;
      --text:   #F2EEE6;
      --muted:  rgba(242,238,230,.45);
      --bdr:    rgba(242,238,230,.07);
      --bdrhi:  rgba(242,238,230,.14);
      --fd: 'Bebas Neue', sans-serif;
      --fb: 'Plus Jakarta Sans', sans-serif;
      --fm: 'DM Mono', monospace;
      font-family: var(--fb);
      display: block; background: var(--bg); color: var(--text); min-height: 100%;
    }

    /* ── Hero ── */
    .ub-hero { position:relative; overflow:hidden; padding:2.5rem 1.5rem 2rem; }
    .ub-hero-orb {
      position:absolute; top:-80px; right:-60px;
      width:280px; height:280px; border-radius:50%; pointer-events:none; z-index:0;
      background:radial-gradient(circle,rgba(240,180,41,.09) 0%,transparent 65%);
    }
    .ub-hero-content { position:relative; z-index:1; }
    .ub-eyebrow { display:flex; align-items:center; gap:.5rem; margin-bottom:.75rem; }
    .ub-pill {
      display:inline-flex; align-items:center; padding:3px 10px; border-radius:100px;
      background:rgba(240,180,41,.1); border:1px solid rgba(240,180,41,.22);
      font-family:var(--fm); font-size:.6rem; letter-spacing:.12em;
      text-transform:uppercase; color:var(--gold);
    }
    .ub-pill--muted { background:rgba(242,238,230,.04); border-color:var(--bdr); color:var(--muted); }
    .ub-title {
      font-family:var(--fd); font-size:clamp(3rem,9vw,5.5rem);
      letter-spacing:.04em; line-height:.88; margin:0 0 .4rem;
      display:flex; flex-direction:column;
    }
    .ub-title-stroke { -webkit-text-stroke:2px var(--gold); color:transparent; }
    .ub-title-solid  { color:var(--text); }
    .ub-subtitle { font-size:.85rem; color:var(--muted); margin:0; font-weight:300; }

    /* ── Main ── */
    .ub-main { padding:0 1.5rem 3rem; }

    /* ── Filter tabs ── */
    .ub-tabs { display:flex; gap:.4rem; margin-bottom:1.25rem; }
    .ub-tab {
      padding:.38rem .9rem; border-radius:100px;
      background:var(--bg3); border:1px solid var(--bdr);
      color:var(--muted); font-size:.8rem; font-weight:500;
      cursor:pointer; transition:all .2s;
    }
    .ub-tab:hover { border-color:var(--bdrhi); color:var(--text); }
    .ub-tab--on { background:rgba(240,180,41,.1); border-color:rgba(240,180,41,.3) !important; color:var(--gold) !important; font-weight:700; }

    /* ── List ── */
    .ub-list { display:flex; flex-direction:column; gap:.85rem; }

    /* ── Card ── */
    .ub-card {
      position:relative; overflow:hidden;
      background:var(--bg2); border:1px solid var(--bdr); border-radius:16px;
      transition:border-color .2s,box-shadow .22s;
      animation:slideUp .4s cubic-bezier(.22,1,.36,1) both;
    }
    @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    .ub-card:hover {
      border-color:var(--tier-bdr, var(--bdrhi));
      box-shadow:0 8px 32px rgba(0,0,0,.35);
    }
    .ub-card--used { opacity:.62; }
    .ub-card--used:hover { opacity:1; }

    /* Top accent stripe */
    .ub-card__stripe { height:3px; width:100%; }

    .ub-card__body {
      display:flex; align-items:stretch; gap:0; padding:1.1rem 1.2rem;
    }

    /* Left */
    .ub-card__left { flex:1; display:flex; flex-direction:column; gap:.45rem; min-width:0; }

    /* Tier badge */
    .ub-tier-badge {
      display:inline-flex; align-items:center; gap:5px; width:fit-content;
      padding:3px 9px; border-radius:6px;
      background:var(--tier-dim); border:1px solid var(--tier-bdr);
      font-family:var(--fm); font-size:.58rem; letter-spacing:.12em; text-transform:uppercase; font-weight:600;
    }
    .ub-tier-badge__icon { width:11px; height:11px; }

    .ub-card__event-title {
      font-family:var(--fd); font-size:1.2rem; letter-spacing:.03em;
      color:var(--text); margin:0; line-height:1.1;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .ub-card__meta-row { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
    .ub-card__meta {
      display:flex; align-items:center; gap:4px;
      font-size:.73rem; color:var(--muted);
    }
    .ub-card__ticket-name {
      font-family:var(--fm); font-size:.65rem; color:var(--muted); letter-spacing:.06em;
    }

    /* Dashed divider */
    .ub-card__divider {
      width:1px; margin:0 1.1rem; flex-shrink:0;
      background:repeating-linear-gradient(180deg,transparent,transparent 4px,rgba(242,238,230,.1) 4px,rgba(242,238,230,.1) 7px);
    }

    /* Right */
    .ub-card__right {
      display:flex; flex-direction:column; align-items:flex-end;
      justify-content:space-between; gap:.75rem; flex-shrink:0; min-width:90px;
    }

    .ub-status {
      display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:100px;
      font-family:var(--fm); font-size:.6rem; letter-spacing:.1em; text-transform:uppercase;
    }
    .ub-status--valid { background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.25); color:var(--green); }
    .ub-status--used  { background:rgba(242,238,230,.05); border:1px solid var(--bdr); color:var(--muted); }

    .ub-pulse {
      width:7px; height:7px; border-radius:50%; background:var(--green); flex-shrink:0;
      animation:pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }

    .ub-show-btn {
      display:inline-flex; align-items:center; gap:4px; padding:.35rem .75rem; border-radius:7px;
      background:rgba(242,238,230,.05); border:1px solid var(--bdr);
      color:var(--muted); font-size:.72rem; font-weight:500;
      cursor:pointer; transition:all .2s; white-space:nowrap;
    }
    .ub-show-btn:hover { border-color:var(--bdrhi); color:var(--text); background:rgba(242,238,230,.08); }

    /* Icons */
    .ub-icon-xs { width:12px; height:12px; flex-shrink:0; }
    .ub-icon-sm { width:14px; height:14px; flex-shrink:0; }

    /* ── Expanded ── */
    .ub-card__expand {
      border-top:1px dashed rgba(242,238,230,.1); padding:1.1rem 1.2rem;
      display:flex; align-items:flex-start; gap:1.25rem; flex-wrap:wrap;
      animation:expandIn .25s cubic-bezier(.22,1,.36,1) both;
    }
    @keyframes expandIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }

    .ub-ticket-code-wrap { display:flex; gap:1rem; align-items:flex-start; flex:1; min-width:0; }

    /* QR */
    .ub-qr {
      width:72px; height:72px; flex-shrink:0;
      display:grid; grid-template-columns:repeat(8,1fr); gap:2px;
      padding:6px; background:var(--bg3);
      border-radius:10px; border:1.5px solid transparent;
      transition:border-color .2s;
    }
    .ub-qr__cell { border-radius:1px; }

    .ub-ticket-code-info { display:flex; flex-direction:column; gap:.5rem; min-width:0; }
    .ub-code-label {
      font-family:var(--fm); font-size:.55rem;
      letter-spacing:.14em; text-transform:uppercase; color:var(--muted);
    }
    .ub-code-value {
      font-family:var(--fm); font-size:.78rem; color:var(--text);
      letter-spacing:.06em; word-break:break-all;
    }
    .ub-used-at { display:flex; align-items:center; gap:4px; font-size:.7rem; color:var(--muted); }

    .ub-copy-btn {
      display:inline-flex; align-items:center; gap:5px;
      padding:.35rem .75rem; border-radius:7px; width:fit-content;
      font-size:.72rem; font-weight:600; cursor:pointer; transition:all .2s;
      border:1px solid transparent;
    }
    .ub-copy-btn:hover { filter:brightness(1.15); }

    .ub-view-event-btn {
      display:inline-flex; align-items:center; gap:6px;
      padding:.5rem 1rem; border-radius:9px; align-self:flex-end;
      background:none; border:1px solid var(--bdr);
      color:var(--muted); font-size:.78rem; font-weight:500;
      cursor:pointer; transition:all .2s; white-space:nowrap;
    }
    .ub-view-event-btn:hover { border-color:var(--tier-bdr,var(--bdrhi)); color:var(--text); }

    /* ── Skeletons ── */
    .ub-skel {
      display:flex; align-items:center; justify-content:space-between;
      padding:1.1rem 1.2rem; border-radius:16px;
      background:var(--bg2); border:1px solid var(--bdr); animation:fadeIn .4s both;
    }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    .ub-skel__left  { display:flex; flex-direction:column; gap:.5rem; flex:1; }
    .ub-skel__right { display:flex; flex-direction:column; align-items:flex-end; gap:.5rem; }
    .ub-skel__line, .ub-skel__badge {
      border-radius:6px;
      background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);
      background-size:600px 100%; animation:shimmer 1.4s ease-in-out infinite;
    }
    .ub-skel__line--xs { height:12px; width:25%; }
    .ub-skel__line--lg { height:20px; width:65%; }
    .ub-skel__line--md { height:12px; width:45%; }
    .ub-skel__line--sm { height:14px; width:60px; }
    .ub-skel__badge    { height:26px; width:70px; border-radius:100px; }
    @keyframes shimmer { from{background-position:-400px 0} to{background-position:400px 0} }

    /* ── Empty states ── */
    .ub-empty {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:.75rem; padding:5rem 1rem; text-align:center;
    }
    .ub-empty--sm { padding:2.5rem 1rem; }
    .ub-empty__icon-wrap {
      width:56px; height:56px; border-radius:16px;
      background:var(--bg3); border:1px solid var(--bdrhi);
      display:flex; align-items:center; justify-content:center;
    }
    .ub-empty__svg   { width:24px; height:24px; color:var(--muted); }
    .ub-empty__title { font-family:var(--fd); font-size:1.5rem; letter-spacing:.04em; color:var(--text); margin:0; }
    .ub-empty__sub   { font-size:.84rem; color:var(--muted); margin:0; font-weight:300; }

    .ub-btn {
      padding:.6rem 1.5rem; border-radius:10px;
      background:var(--gold); color:#1a1200; border:none;
      font-family:var(--fb); font-weight:700; font-size:.85rem;
      cursor:pointer; transition:opacity .2s;
    }
    .ub-btn:hover { opacity:.85; }

    @media(max-width:640px) {
      .ub-hero { padding:1.75rem 1rem 1.5rem; }
      .ub-main { padding:0 1rem 3rem; }
      .ub-card__divider { display:none; }
      .ub-card__right { min-width:unset; }
      .ub-qr { width:60px; height:60px; }
    }
  `],
})
export class UserBookingsComponent implements OnInit, OnDestroy {
  readonly router      = inject(Router);
  private readonly svc = inject(TicketService);
  private readonly d$  = new Subject<void>();

  bookings = signal<Booking[]>([]);
  loading  = signal(true);
  error    = signal(false);
  filter   = signal<'all' | 'used' | 'unused'>('all');
  expanded = signal<number | null>(null);
  copied   = signal<string | null>(null);

  readonly skeletons = Array.from({ length: 4 }, (_, i) => i);

  readonly qrPattern = [
    1,1,1,0,1,1,1,0,
    1,0,1,0,0,1,0,0,
    1,1,1,0,0,0,1,0,
    0,0,0,0,1,0,1,0,
    1,1,0,1,1,1,1,0,
    0,1,0,0,0,0,1,0,
    1,1,1,0,1,1,1,0,
    0,0,0,0,0,0,0,0,
  ];

  readonly fmtDate = fmtDate;
  readonly fmtTime = fmtTime;

  filtered = computed(() => {
    const f = this.filter();
    const list = this.bookings();
    if (f === 'used')   return list.filter(b =>  b.isUsed);
    if (f === 'unused') return list.filter(b => !b.isUsed);
    return list;
  });

  /** Returns tier meta for a booking — reads tier directly from eventTicket */
  meta(b: Booking): TierMeta {
    return TIER_META[getTier(b)];
  }

  ngOnInit()    { this.load(); }
  ngOnDestroy() { this.d$.next(); this.d$.complete(); }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.svc.getMyBookings().pipe(
      catchError(() => { this.error.set(true); this.loading.set(false); return of([] as Booking[]); }),
      takeUntil(this.d$),
    ).subscribe(list => {
      this.bookings.set([...list].sort(
        (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime(),
      ));
      this.loading.set(false);
    });
  }

  toggleExpand(id: number) {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  async copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(code);
      setTimeout(() => this.copied.set(null), 2000);
    } catch { /* silent */ }
  }

  formatCode(code: string): string {
    if (code.length <= 20) return code;
    return `${code.slice(0, 8)}…${code.slice(-8)}`;
  }

  getEventTitle(b: Booking): string {
    const nested = (b.eventTicket as any)?.event?.title as string | undefined;
    if (nested) return nested;
    if (b.eventTicket?.eventId) return `Event #${b.eventTicket.eventId}`;
    return `Booking #${b.id}`;
  }
}