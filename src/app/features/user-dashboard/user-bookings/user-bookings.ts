// src/app/features/user-dashboard/user-bookings/user-bookings.ts
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

export interface BookingFlat {
  ticketUniqueCode: string;
  qrPayload:        string;
  eventName:        string;
  eventDate:        string;
  city:             string | null;
  region:           string | null;
  street:           string | null;
  online_url:       string | null;
  tier:             number;
  attendeeName:     string;
  pricePaid:        number;
  isUsed?:          boolean;
  usedAt?:          string | null;
  id?:              number;
}

interface BookingResponse {
  data:    BookingFlat[];
  success: boolean;
  message: string;
  errors:  string[];
}

interface TierCfg {
  label:    string;
  accent:   string;
  bg:       string;
  border:   string;
  text:     string;
  stripeBg: string;
}

const TIERS: Record<number, TierCfg> = {
  0: {
    label: 'Standard', accent: '#94a3b8',
    bg: 'bg-slate-400/10', border: 'border-slate-400/25', text: 'text-slate-400',
    stripeBg: '#94a3b8',
  },
  1: {
    label: 'VIP', accent: '#F0B429',
    bg: 'bg-amber-400/10', border: 'border-amber-400/30', text: 'text-amber-400',
    stripeBg: '#F0B429',
  },
  2: {
    label: 'Premium', accent: '#a78bfa',
    bg: 'bg-violet-400/10', border: 'border-violet-400/30', text: 'text-violet-400',
    stripeBg: '#a78bfa',
  },
};

function tier(t: number): TierCfg { return TIERS[t] ?? TIERS[0]; }

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-EG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
}

// ── Build a scannable QR code URL using the free qrserver.com API ─────────
// The payload is just the raw UUID — exactly what the verify-ticket scanner
// will read and send to GET /api/Ticket/Verify/{code}.
function qrUrl(payload: string, accentColor: string): string {
  const color   = encodeURIComponent(accentColor.replace('#', ''));
  const bgcolor = encodeURIComponent('111116');
  return `https://api.qrserver.com/v1/create-qr-code/?size=128x128&color=${color}&bgcolor=${bgcolor}&qzone=1&data=${encodeURIComponent(payload)}`;
}

@Component({
  selector:   'app-user-bookings',
  standalone: true,
  imports:    [CommonModule],
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
    :host { font-family: 'Plus Jakarta Sans', sans-serif; display: block; }
    .font-bebas { font-family: 'Bebas Neue', sans-serif; }
    .font-mono  { font-family: 'DM Mono', monospace; }
    @keyframes slideUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
    @keyframes expandIn { from{opacity:0;transform:translateY(-8px)}  to{opacity:1;transform:none} }
    @keyframes shimmer  { from{background-position:-800px 0} to{background-position:800px 0} }
    .animate-slide-up  { animation: slideUp  .4s cubic-bezier(.22,1,.36,1) both; }
    .animate-expand-in { animation: expandIn .25s cubic-bezier(.22,1,.36,1) both; }
    .skeleton {
      background: linear-gradient(90deg,
        rgba(242,238,230,.04) 25%, rgba(242,238,230,.08) 50%, rgba(242,238,230,.04) 75%);
      background-size: 800px 100%;
      animation: shimmer 1.5s ease-in-out infinite;
    }
    .dash-sep {
      background: repeating-linear-gradient(
        180deg, transparent, transparent 4px,
        rgba(255,255,255,.08) 4px, rgba(255,255,255,.08) 7px
      );
    }
  `],
  template: `
    <div class="min-h-full bg-[#060608] text-[#F2EEE6]">

      <!-- ── HERO ── -->
      <header class="relative overflow-hidden px-6 pt-10 pb-8">
        <div class="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full"
             style="background:radial-gradient(circle,rgba(240,180,41,.09) 0%,transparent 65%)">
        </div>
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-3">
            <span class="font-mono text-[.58rem] tracking-[.12em] uppercase
                         px-2.5 py-0.5 rounded-full
                         bg-amber-400/10 border border-amber-400/25 text-amber-400">
              My Tickets
            </span>
            @if (!loading() && bookings().length > 0) {
              <span class="font-mono text-[.58rem] tracking-[.12em] uppercase
                           px-2.5 py-0.5 rounded-full
                           bg-white/[.04] border border-white/[.07] text-white/40">
                {{ bookings().length }} booking{{ bookings().length !== 1 ? 's' : '' }}
              </span>
            }
          </div>
          <h1 class="font-bebas leading-[.88] mb-1.5"
              style="font-size:clamp(3rem,9vw,5.5rem);letter-spacing:.04em">
            <span class="block" style="-webkit-text-stroke:2px #F0B429;color:transparent">YOUR</span>
            <span class="block text-[#F2EEE6]">BOOKINGS</span>
          </h1>
          <p class="text-sm text-white/40 font-light">All your event tickets — tap to reveal your QR code.</p>
        </div>
      </header>

      <!-- ── CONTENT ── -->
      <main class="px-6 pb-12">

        <!-- Skeletons -->
        @if (loading()) {
          <div class="flex flex-col gap-3">
            @for (n of skeletons; track n) {
              <div class="skeleton h-24 rounded-2xl border border-white/[.07]"
                   [style.animation-delay]="n * 70 + 'ms'">
              </div>
            }
          </div>
        }

        <!-- Error -->
        @else if (error()) {
          <div class="flex flex-col items-center gap-3 py-20 text-center">
            <div class="w-14 h-14 rounded-2xl bg-[#111116] border border-white/10
                        flex items-center justify-center">
              <svg class="w-6 h-6 text-white/30" fill="none" stroke="currentColor"
                   stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94
                         a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <p class="font-bebas text-2xl tracking-[.04em] text-[#F2EEE6]">Couldn't load bookings</p>
            <button class="mt-1 px-5 py-2 rounded-xl bg-amber-400 text-[#1a1200]
                           text-sm font-bold hover:bg-amber-300 transition-colors"
                    (click)="load()">Try again</button>
          </div>
        }

        <!-- Empty -->
        @else if (bookings().length === 0) {
          <div class="flex flex-col items-center gap-3 py-20 text-center">
            <div class="w-14 h-14 rounded-2xl bg-[#111116] border border-white/10
                        flex items-center justify-center">
              <svg class="w-6 h-6 text-white/30" fill="none" stroke="currentColor"
                   stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0
                         002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
              </svg>
            </div>
            <p class="font-bebas text-2xl tracking-[.04em] text-[#F2EEE6]">No bookings yet</p>
            <p class="text-sm text-white/40">Explore events and grab your first ticket!</p>
            <button class="mt-1 px-5 py-2 rounded-xl bg-amber-400 text-[#1a1200]
                           text-sm font-bold hover:bg-amber-300 transition-colors"
                    (click)="router.navigate(['/user-dashboard'])">Browse Events</button>
          </div>
        }

        @else {
          <div class="flex flex-col gap-3">
            @for (b of bookings(); track b.ticketUniqueCode; let i = $index) {

              <div class="animate-slide-up relative overflow-hidden rounded-2xl
                           bg-[#09090c] border border-white/[.07]
                           transition-all duration-200
                           hover:border-white/15 hover:shadow-2xl"
                   [style.animation-delay]="i * 50 + 'ms'">

                <!-- Tier stripe -->
                <div class="h-[3px] w-full" [style.background]="tierCfg(b).stripeBg"></div>

                <!-- Card body -->
                <div class="flex items-stretch gap-0 px-4 py-3.5">

                  <!-- Left -->
                  <div class="flex-1 min-w-0 flex flex-col gap-2">

                    <!-- Tier badge -->
                    <div class="inline-flex items-center gap-1.5 w-fit
                                px-2 py-0.5 rounded-md border
                                font-mono text-[.58rem] tracking-[.1em] uppercase font-semibold"
                         [class]="tierCfg(b).bg + ' ' + tierCfg(b).border + ' ' + tierCfg(b).text">
                      @switch (b.tier) {
                        @case (1) {
                          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                          </svg>
                        }
                        @case (2) {
                          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806
                                     3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806
                                     3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946
                                     3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946
                                     3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806
                                     3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806
                                     3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946
                                     3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946
                                     3.42 3.42 0 013.138-3.138z"/>
                          </svg>
                        }
                        @default {
                          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0
                                     110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0
                                     110-4V7a2 2 0 00-2-2H5z"/>
                          </svg>
                        }
                      }
                      {{ tierCfg(b).label }}
                    </div>

                    <!-- Event name -->
                    <h3 class="font-bebas truncate text-[#F2EEE6] leading-tight"
                        style="font-size:1.15rem;letter-spacing:.03em">
                      {{ b.eventName }}
                    </h3>

                    <!-- Meta -->
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                      @if (b.eventDate) {
                        <span class="flex items-center gap-1 text-[.7rem] text-white/40">
                          <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0
                                     00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                          </svg>
                          {{ fmtDate(b.eventDate) }} · {{ fmtTime(b.eventDate) }}
                        </span>
                      }
                      @if (b.city) {
                        <span class="flex items-center gap-1 text-[.7rem] text-white/40">
                          <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0
                                     01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                          </svg>
                          {{ b.city }}{{ b.region ? ', ' + b.region : '' }}
                        </span>
                      }
                      @if (b.online_url && !b.city) {
                        <span class="flex items-center gap-1 text-[.7rem] text-sky-400">
                          <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0
                                     105.656 5.656l1.102-1.101m-.758-4.899a4 4 0
                                     005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                          </svg>
                          Online
                        </span>
                      }
                    </div>

                    <!-- Attendee -->
                    <div class="font-mono text-[.65rem] tracking-[.06em] text-white/30">
                      {{ b.attendeeName }}
                    </div>
                  </div>

                  <!-- Dashed divider -->
                  <div class="w-px mx-4 shrink-0 dash-sep"></div>

                  <!-- Right: price + expand -->
                  <div class="flex flex-col items-end justify-between gap-2 shrink-0">

                    <div class="text-right">
                      <div class="font-mono text-[.52rem] tracking-[.14em] uppercase
                                  text-white/30 mb-0.5">Price paid</div>
                      @if (b.pricePaid === 0) {
                        <div class="font-bebas leading-none"
                             [class]="tierCfg(b).text"
                             style="font-size:1.3rem;letter-spacing:.04em">FREE</div>
                      } @else {
                        <div class="leading-none flex items-baseline gap-0.5">
                          <span class="font-mono text-[.6rem] text-white/40">EGP</span>
                          <span class="font-bebas leading-none"
                                [class]="tierCfg(b).text"
                                style="font-size:1.3rem;letter-spacing:.04em">
                            {{ b.pricePaid | number:'1.0-0' }}
                          </span>
                        </div>
                      }
                    </div>

                    <button
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                             text-[.7rem] font-medium
                             bg-white/[.04] border border-white/[.07] text-white/40
                             hover:bg-white/[.07] hover:text-white
                             transition-all duration-150"
                      (click)="toggleExpand(b.ticketUniqueCode)"
                    >
                      {{ expanded() === b.ticketUniqueCode ? 'Hide' : 'Show QR' }}
                      <svg class="w-3 h-3 transition-transform duration-200"
                           [style.transform]="expanded() === b.ticketUniqueCode
                             ? 'rotate(180deg)' : 'none'"
                           fill="none" stroke="currentColor" stroke-width="2.5"
                           viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- ── EXPANDED: real scannable QR code ── -->
                @if (expanded() === b.ticketUniqueCode) {
                  <div class="animate-expand-in border-t border-dashed border-white/10
                               px-4 py-4 flex flex-wrap items-start gap-5">

                    <!-- ── QR Code image (real, scannable) ── -->
                    <div class="shrink-0 flex flex-col items-center gap-2">
                      <div class="w-[100px] h-[100px] rounded-xl overflow-hidden
                                  bg-[#111116] border flex items-center justify-center"
                           [style.border-color]="tierCfg(b).accent + '55'">
                        @if (qrLoaded()[b.ticketUniqueCode]) {
                          <img
                            [src]="qrUrl(b.qrPayload, tierCfg(b).accent)"
                            [alt]="'QR code for ' + b.eventName"
                            class="w-full h-full object-contain p-1"
                          />
                        } @else {
                          <!-- Spinner while QR image loads -->
                          <span class="w-6 h-6 rounded-full border-2 border-white/10
                                       inline-block animate-spin"
                                [style.border-top-color]="tierCfg(b).accent">
                          </span>
                        }
                        <!-- Hidden img to detect load event -->
                        <img
                          [src]="qrUrl(b.qrPayload, tierCfg(b).accent)"
                          class="hidden"
                          (load)="onQrLoaded(b.ticketUniqueCode)"
                        />
                      </div>
                      <span class="font-mono text-[.52rem] tracking-[.1em] uppercase text-white/25">
                        Scan to verify
                      </span>
                    </div>

                    <!-- Code + actions -->
                    <div class="flex-1 min-w-0 flex flex-col gap-2.5">

                      <div>
                        <div class="font-mono text-[.52rem] tracking-[.14em] uppercase
                                    text-white/30 mb-1">Ticket Code</div>
                        <div class="font-mono text-[.72rem] text-[#F2EEE6] break-all
                                    tracking-wide leading-relaxed">
                          {{ b.ticketUniqueCode }}
                        </div>
                      </div>

                      @if (b.isUsed && b.usedAt) {
                        <div class="flex items-center gap-1.5 text-[.68rem] text-white/35">
                          <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor"
                               stroke-width="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/>
                          </svg>
                          Used {{ fmtDate(b.usedAt) }} at {{ fmtTime(b.usedAt) }}
                        </div>
                      }

                      @if (b.online_url) {
                        <a [href]="b.online_url" target="_blank" rel="noopener"
                           class="inline-flex items-center gap-1.5 w-fit
                                  text-[.7rem] font-medium text-sky-400
                                  hover:text-sky-300 transition-colors">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor"
                               stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0
                                     002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                          </svg>
                          Join online
                        </a>
                      }

                      <!-- Copy code button -->
                      <button
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               text-[.72rem] font-semibold border
                               transition-all duration-150 w-fit"
                        [class]="tierCfg(b).bg + ' ' + tierCfg(b).border + ' ' + tierCfg(b).text"
                        (click)="copyCode(b.ticketUniqueCode)"
                      >
                        @if (copied() === b.ticketUniqueCode) {
                          <svg class="w-3 h-3" fill="none" stroke="currentColor"
                               stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                          </svg>
                          Copied!
                        } @else {
                          <svg class="w-3 h-3" fill="none" stroke="currentColor"
                               stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0
                                     012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0
                                     00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                          </svg>
                          Copy code
                        }
                      </button>
                    </div>
                  </div>
                }

              </div>
            }
          </div>

          <!-- Total spent -->
          <div class="mt-5 flex items-center justify-between
                      px-4 py-3 rounded-xl
                      bg-[#09090c] border border-white/[.07]">
            <span class="font-mono text-[.68rem] tracking-[.12em] uppercase text-white/35">
              Total spent ({{ bookings().length }} ticket{{ bookings().length !== 1 ? 's' : '' }})
            </span>
            <span class="font-bebas text-amber-400"
                  style="font-size:1.2rem;letter-spacing:.04em">
              EGP {{ totalSpent() | number:'1.0-0' }}
            </span>
          </div>
        }
      </main>
    </div>
  `,
})
export class UserBookingsComponent implements OnInit, OnDestroy {
  readonly router       = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly d$   = new Subject<void>();
  private readonly BASE = 'https://eventora.runasp.net/api';

  bookings  = signal<BookingFlat[]>([]);
  loading   = signal(true);
  error     = signal(false);
  expanded  = signal<string | null>(null);
  copied    = signal<string | null>(null);
  // Tracks which QR images have finished loading
  qrLoaded  = signal<Record<string, boolean>>({});

  readonly skeletons  = Array.from({ length: 4 }, (_, i) => i);
  readonly fmtDate    = fmtDate;
  readonly fmtTime    = fmtTime;
  readonly tierCfg    = (b: BookingFlat) => tier(b.tier);
  readonly qrUrl      = qrUrl;

  readonly totalSpent = computed(() =>
    this.bookings().reduce((sum, b) => sum + (b.pricePaid ?? 0), 0)
  );

  ngOnInit():    void { this.load(); }
  ngOnDestroy(): void { this.d$.next(); this.d$.complete(); }

  load(): void {
    this.loading.set(true);
    this.error.set(false);

    this.http
      .get<BookingResponse>(`${this.BASE}/Ticket/MyBookings`)
      .pipe(
        catchError(() => {
          this.error.set(true);
          this.loading.set(false);
          return of({ data: [], success: false, message: '', errors: [] } as BookingResponse);
        }),
        takeUntil(this.d$),
      )
      .subscribe(res => {
        if (!res.success && res.data.length === 0 && this.error()) return;
        this.bookings.set(
          [...(res.data ?? [])].sort(
            (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
          ),
        );
        this.loading.set(false);
      });
  }

  toggleExpand(code: string): void {
    this.expanded.set(this.expanded() === code ? null : code);
  }

  onQrLoaded(code: string): void {
    this.qrLoaded.update(m => ({ ...m, [code]: true }));
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(code);
      setTimeout(() => this.copied.set(null), 2000);
    } catch { /* silent */ }
  }
}