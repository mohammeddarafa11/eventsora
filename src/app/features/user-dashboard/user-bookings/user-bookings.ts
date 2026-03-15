// src/app/features/user-dashboard/user-bookings/user-bookings.ts
//
// Uses the new flat booking response shape:
//   { ticketUniqueCode, qrPayload, eventName, eventDate,
//     city, region, street, online_url, tier, attendeeName, pricePaid }
//
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

// ── New flat booking shape from GET /api/Ticket/MyBookings ─────────────────

export interface BookingFlat {
  ticketUniqueCode: string;
  qrPayload:        string;
  eventName:        string;
  eventDate:        string;
  city:             string | null;
  region:           string | null;
  street:           string | null;
  online_url:       string | null;
  tier:             number;        // 0=Standard, 1=VIP, 2=Premium
  attendeeName:     string;
  pricePaid:        number;
  // Additional fields that may come from old shape (backward compat)
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

// ── Tier config ───────────────────────────────────────────────────────────

interface TierCfg {
  label:    string;
  accent:   string;      // full colour
  bg:       string;      // tailwind bg class
  border:   string;      // tailwind border class
  text:     string;      // tailwind text class
  stripeBg: string;      // inline style for 3px stripe
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

// Decorative QR pattern (static visual only)
const QR = [
  1,1,1,0,1,1,1,0,
  1,0,1,0,0,1,0,0,
  1,1,1,0,0,0,1,0,
  0,0,0,0,1,0,1,0,
  1,1,0,1,1,1,1,0,
  0,1,0,0,0,0,1,0,
  1,1,1,0,1,1,1,0,
  0,0,0,0,0,0,0,0,
];

@Component({
  selector:   'app-user-bookings',
  standalone: true,
  imports:    [CommonModule],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <div class="min-h-full bg-[#060608] text-[#F2EEE6]" style="font-family:'Plus Jakarta Sans',sans-serif">

      <!-- ── HERO ── -->
      <header class="relative overflow-hidden px-6 pt-10 pb-8">
        <div class="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full"
             style="background:radial-gradient(circle,rgba(240,180,41,.09) 0%,transparent 65%)"></div>
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[.58rem] tracking-[.12em] uppercase
                         bg-amber-400/10 border border-amber-400/25 text-amber-400"
                  style="font-family:'DM Mono',monospace">
              My Tickets
            </span>
            @if (!loading() && bookings().length > 0) {
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[.58rem] tracking-[.12em] uppercase
                           bg-white/[.04] border border-white/[.07] text-white/40"
                    style="font-family:'DM Mono',monospace">
                {{ bookings().length }} booking{{ bookings().length !== 1 ? 's' : '' }}
              </span>
            }
          </div>
          <h1 class="leading-[.88] mb-1.5" style="font-family:'Bebas Neue',sans-serif;font-size:clamp(3rem,9vw,5.5rem);letter-spacing:.04em">
            <span class="block" style="-webkit-text-stroke:2px #F0B429;color:transparent">YOUR</span>
            <span class="block text-[#F2EEE6]">BOOKINGS</span>
          </h1>
          <p class="text-sm text-white/40 font-light">All your event tickets — with price paid.</p>
        </div>
      </header>

      <!-- ── CONTENT ── -->
      <main class="px-6 pb-12">

        <!-- Loading skeletons -->
        @if (loading()) {
          <div class="flex flex-col gap-3">
            @for (n of skeletons; track n) {
              <div class="h-24 rounded-2xl bg-[#09090c] border border-white/[.07] animate-pulse"
                   [style.animation-delay]="n * 70 + 'ms'"></div>
            }
          </div>
        }

        <!-- Error -->
        @else if (error()) {
          <div class="flex flex-col items-center gap-3 py-20 text-center">
            <div class="w-14 h-14 rounded-2xl bg-[#111116] border border-white/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-white/30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <p class="text-2xl text-[#F2EEE6]" style="font-family:'Bebas Neue',sans-serif;letter-spacing:.04em">Couldn't load bookings</p>
            <button class="mt-1 px-5 py-2 rounded-xl bg-amber-400 text-[#1a1200] text-sm font-bold" (click)="load()">
              Try again
            </button>
          </div>
        }

        <!-- Empty -->
        @else if (bookings().length === 0) {
          <div class="flex flex-col items-center gap-3 py-20 text-center">
            <div class="w-14 h-14 rounded-2xl bg-[#111116] border border-white/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-white/30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14
                         a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
              </svg>
            </div>
            <p class="text-2xl text-[#F2EEE6]" style="font-family:'Bebas Neue',sans-serif;letter-spacing:.04em">No bookings yet</p>
            <p class="text-sm text-white/40">Explore events and grab your first ticket!</p>
            <button class="mt-1 px-5 py-2 rounded-xl bg-amber-400 text-[#1a1200] text-sm font-bold"
                    (click)="router.navigate(['/user-dashboard'])">
              Browse Events
            </button>
          </div>
        }

        @else {

          <!-- Filter tabs -->
          <div class="flex gap-2 mb-5">
            @for (tab of filterTabs; track tab.value) {
              <button
                class="px-3.5 py-1.5 rounded-full text-[.78rem] font-semibold border transition-all duration-200"
                [class]="activeFilter() === tab.value
                  ? 'bg-amber-400/10 border-amber-400/35 text-amber-400'
                  : 'bg-[#111116] border-white/[.07] text-white/40 hover:text-white hover:border-white/15'"
                (click)="activeFilter.set(tab.value)"
              >{{ tab.label }}</button>
            }
          </div>

          <!-- No results for filter -->
          @if (filtered().length === 0) {
            <div class="flex flex-col items-center gap-2 py-10 text-center">
              <p class="text-xl text-[#F2EEE6]" style="font-family:'Bebas Neue',sans-serif;letter-spacing:.04em">
                No {{ activeFilter() }} tickets
              </p>
            </div>
          }

          <!-- Booking cards -->
          @else {
            <div class="flex flex-col gap-3">
              @for (b of filtered(); track b.ticketUniqueCode; let i = $index) {

                <div class="relative overflow-hidden rounded-2xl bg-[#09090c] border border-white/[.07]
                             transition-all duration-200 hover:border-white/15 hover:shadow-2xl"
                     [style.animation-delay]="i * 50 + 'ms'"
                     style="animation:slideUp .4s cubic-bezier(.22,1,.36,1) both">

                  <!-- Tier accent stripe -->
                  <div class="h-[3px] w-full" [style.background]="tierCfg(b).stripeBg"></div>

                  <!-- Card body -->
                  <div class="flex items-stretch gap-0 px-4 py-3.5">

                    <!-- Left -->
                    <div class="flex-1 min-w-0 flex flex-col gap-2">

                      <!-- Tier badge -->
                      <div class="inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-md text-[.58rem] tracking-[.1em] uppercase font-semibold border"
                           [class]="tierCfg(b).bg + ' ' + tierCfg(b).border + ' ' + tierCfg(b).text"
                           style="font-family:'DM Mono',monospace">
                        @switch (b.tier) {
                          @case (1) {
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                          }
                          @case (2) {
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                            </svg>
                          }
                          @default {
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                            </svg>
                          }
                        }
                        {{ tierCfg(b).label }}
                      </div>

                      <!-- Event name -->
                      <h3 class="truncate text-[#F2EEE6] leading-tight"
                          style="font-family:'Bebas Neue',sans-serif;font-size:1.15rem;letter-spacing:.03em">
                        {{ b.eventName }}
                      </h3>

                      <!-- Meta row -->
                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <!-- Date -->
                        @if (b.eventDate) {
                          <span class="flex items-center gap-1 text-[.7rem] text-white/40">
                            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            {{ fmtDate(b.eventDate) }} · {{ fmtTime(b.eventDate) }}
                          </span>
                        }
                        <!-- Location -->
                        @if (b.city) {
                          <span class="flex items-center gap-1 text-[.7rem] text-white/40">
                            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                            {{ b.city }}{{ b.region ? ', ' + b.region : '' }}
                          </span>
                        }
                        @if (b.online_url && !b.city) {
                          <span class="flex items-center gap-1 text-[.7rem] text-sky-400">
                            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                            </svg>
                            Online
                          </span>
                        }
                      </div>

                      <!-- Attendee name -->
                      <div class="text-[.65rem] text-white/30" style="font-family:'DM Mono',monospace;letter-spacing:.06em">
                        {{ b.attendeeName }}
                      </div>

                    </div>

                    <!-- Dashed divider -->
                    <div class="w-px mx-4 shrink-0"
                         style="background:repeating-linear-gradient(180deg,transparent,transparent 4px,rgba(255,255,255,.08) 4px,rgba(255,255,255,.08) 7px)">
                    </div>

                    <!-- Right: price + expand toggle -->
                    <div class="flex flex-col items-end justify-between gap-2 shrink-0">

                      <!-- Price paid -->
                      <div class="text-right">
                        <div class="text-[.52rem] tracking-[.14em] uppercase text-white/30 mb-0.5"
                             style="font-family:'DM Mono',monospace">Price paid</div>
                        @if (b.pricePaid === 0) {
                          <div class="font-bold leading-none" [class]="tierCfg(b).text"
                               style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;letter-spacing:.04em">
                            FREE
                          </div>
                        } @else {
                          <div class="leading-none flex items-baseline gap-0.5">
                            <span class="text-[.6rem] text-white/40"
                                  style="font-family:'DM Mono',monospace">EGP</span>
                            <span class="font-bold" [class]="tierCfg(b).text"
                                  style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;letter-spacing:.04em">
                              {{ b.pricePaid | number:'1.0-0' }}
                            </span>
                          </div>
                        }
                      </div>

                      <!-- Expand toggle -->
                      <button
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[.7rem] font-medium
                               bg-white/[.04] border border-white/[.07] text-white/40
                               hover:bg-white/[.07] hover:text-white transition-all duration-150"
                        (click)="toggleExpand(b.ticketUniqueCode)"
                      >
                        {{ expanded() === b.ticketUniqueCode ? 'Hide' : 'Ticket' }}
                        <svg class="w-3 h-3 transition-transform duration-200"
                             [style.transform]="expanded() === b.ticketUniqueCode ? 'rotate(180deg)' : 'none'"
                             fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- ── EXPANDED TICKET ── -->
                  @if (expanded() === b.ticketUniqueCode) {
                    <div class="border-t border-dashed border-white/10 px-4 py-3.5 flex flex-wrap items-start gap-4"
                         style="animation:expandIn .25s cubic-bezier(.22,1,.36,1) both">

                      <!-- Decorative QR -->
                      <div class="shrink-0 w-16 h-16 rounded-xl p-1.5 grid bg-[#111116] border"
                           style="grid-template-columns:repeat(8,1fr);gap:1.5px"
                           [style.border-color]="tierCfg(b).accent + '44'">
                        @for (cell of qrPattern; track $index) {
                          <div class="rounded-[1px]"
                               [style.background]="cell === 1 ? tierCfg(b).stripeBg : 'transparent'"></div>
                        }
                      </div>

                      <!-- Code info -->
                      <div class="flex-1 min-w-0 flex flex-col gap-2">
                        <div>
                          <div class="text-[.52rem] tracking-[.14em] uppercase text-white/30 mb-1"
                               style="font-family:'DM Mono',monospace">Ticket Code</div>
                          <div class="text-[.75rem] text-[#F2EEE6] break-all"
                               style="font-family:'DM Mono',monospace;letter-spacing:.04em">
                            {{ b.ticketUniqueCode }}
                          </div>
                        </div>

                        <!-- Used timestamp -->
                        @if (b.isUsed && b.usedAt) {
                          <div class="flex items-center gap-1.5 text-[.68rem] text-white/35">
                            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10"/>
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/>
                            </svg>
                            Used {{ fmtDate(b.usedAt) }} at {{ fmtTime(b.usedAt) }}
                          </div>
                        }

                        <!-- Online link -->
                        @if (b.online_url) {
                          <a [href]="b.online_url" target="_blank" rel="noopener"
                             class="inline-flex items-center gap-1.5 text-[.7rem] font-medium text-sky-400 w-fit
                                    hover:text-sky-300 transition-colors">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                            </svg>
                            Join online
                          </a>
                        }

                        <!-- Actions -->
                        <div class="flex gap-2 flex-wrap">
                          <button
                            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[.72rem] font-semibold
                                   border transition-all duration-150"
                            [class]="tierCfg(b).bg + ' ' + tierCfg(b).border + ' ' + tierCfg(b).text"
                            (click)="copyCode(b.ticketUniqueCode)"
                          >
                            @if (copied() === b.ticketUniqueCode) {
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                              </svg>
                              Copied!
                            } @else {
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                              </svg>
                              Copy code
                            }
                          </button>
                        </div>
                      </div>

                    </div>
                  }

                </div>

              }
            </div>

            <!-- Total spent summary -->
            @if (filtered().length > 0) {
              <div class="mt-5 flex items-center justify-between px-4 py-3 rounded-xl bg-[#09090c] border border-white/[.07]">
                <span class="text-[.68rem] tracking-[.12em] uppercase text-white/35"
                      style="font-family:'DM Mono',monospace">
                  Total spent ({{ filtered().length }} ticket{{ filtered().length !== 1 ? 's' : '' }})
                </span>
                <span class="text-amber-400 font-bold"
                      style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:.04em">
                  EGP {{ totalSpent() | number:'1.0-0' }}
                </span>
              </div>
            }

          }
        }

      </main>
    </div>
  `,
  styles: [`
    @keyframes slideUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes expandIn  { from{opacity:0;transform:translateY(-8px)}  to{opacity:1;transform:translateY(0)} }
  `],
})
export class UserBookingsComponent implements OnInit, OnDestroy {
  readonly router      = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly d$  = new Subject<void>();
  private readonly BASE = 'https://eventora.runasp.net/api';

  bookings     = signal<BookingFlat[]>([]);
  loading      = signal(true);
  error        = signal(false);
  activeFilter = signal<'all' | 'used' | 'unused'>('all');
  expanded     = signal<string | null>(null);
  copied       = signal<string | null>(null);

  readonly skeletons  = Array.from({ length: 4 }, (_, i) => i);
  readonly qrPattern  = QR;
  readonly fmtDate    = fmtDate;
  readonly fmtTime    = fmtTime;
  readonly tierCfg = (b: BookingFlat) => tier(b.tier);

  readonly filterTabs = [
    { label: 'All',    value: 'all'    as const },
    { label: 'Unused', value: 'unused' as const },
    { label: 'Used',   value: 'used'   as const },
  ];

  filtered = computed(() => {
    const f    = this.activeFilter();
    const list = this.bookings();
    if (f === 'used')   return list.filter(b =>  b.isUsed);
    if (f === 'unused') return list.filter(b => !b.isUsed);
    return list;
  });

  totalSpent = computed(() =>
    this.filtered().reduce((sum, b) => sum + (b.pricePaid ?? 0), 0)
  );

  ngOnInit()    { this.load(); }
  ngOnDestroy() { this.d$.next(); this.d$.complete(); }

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

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(code);
      setTimeout(() => this.copied.set(null), 2000);
    } catch { /* silent */ }
  }
}