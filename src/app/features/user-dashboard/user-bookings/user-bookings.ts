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
  label: string; accent: string;
  bg: string; border: string; text: string; stripeBg: string;
}

const TIERS: Record<number, TierCfg> = {
  0: { label:'Standard', accent:'#94a3b8', bg:'bg-slate-400/10', border:'border-slate-400/25', text:'text-slate-400', stripeBg:'#94a3b8' },
  1: { label:'VIP',      accent:'#F0B429', bg:'bg-amber-400/10', border:'border-amber-400/30', text:'text-amber-400', stripeBg:'#F0B429' },
  2: { label:'Premium',  accent:'#a78bfa', bg:'bg-violet-400/10',border:'border-violet-400/30',text:'text-violet-400',stripeBg:'#a78bfa' },
};

function tierCfg(t: number): TierCfg { return TIERS[t] ?? TIERS[0]; }

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-EG', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-EG', { hour:'2-digit', minute:'2-digit' });
}

// Free QR code image API — no library needed, just an <img> tag
// White bg + black dots = easiest for any QR scanner to read
function qrImgUrl(payload: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=000000&bgcolor=ffffff&qzone=2&data=${encodeURIComponent(payload)}`;
}

@Component({
  selector:   'app-user-bookings',
  standalone: true,
  imports:    [CommonModule],
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
    :host { font-family:'Plus Jakarta Sans',sans-serif; display:block; }
    .font-bebas { font-family:'Bebas Neue',sans-serif; }
    .font-mono  { font-family:'DM Mono',monospace; }
    @keyframes slideUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
    @keyframes shimmer  { from{background-position:-800px 0} to{background-position:800px 0} }
    @keyframes modalIn  { from{opacity:0;transform:scale(.94) translateY(12px)} to{opacity:1;transform:none} }
    @keyframes backdropIn { from{opacity:0} to{opacity:1} }
    .animate-slide-up { animation:slideUp .4s cubic-bezier(.22,1,.36,1) both; }
    .animate-modal-in { animation:modalIn .3s cubic-bezier(.22,1,.36,1) both; }
    .skeleton {
      background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.08) 50%,rgba(242,238,230,.04) 75%);
      background-size:800px 100%; animation:shimmer 1.5s ease-in-out infinite;
    }
    .dash-sep {
      background:repeating-linear-gradient(180deg,transparent,transparent 4px,rgba(255,255,255,.08) 4px,rgba(255,255,255,.08) 7px);
    }
  `],
  template: `
    <div class="min-h-full bg-[#060608] text-[#F2EEE6]">

      <!-- ── HERO ── -->
      <header class="relative overflow-hidden px-6 pt-10 pb-8">
        <div class="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full"
             style="background:radial-gradient(circle,rgba(240,180,41,.09) 0%,transparent 65%)"></div>
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-3">
            <span class="font-mono text-[.58rem] tracking-[.12em] uppercase px-2.5 py-0.5 rounded-full
                         bg-amber-400/10 border border-amber-400/25 text-amber-400">My Tickets</span>
            @if (!loading() && bookings().length > 0) {
              <span class="font-mono text-[.58rem] tracking-[.12em] uppercase px-2.5 py-0.5 rounded-full
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
          <p class="text-sm text-white/40 font-light">Tap "Show QR" on any ticket to display your entry code.</p>
        </div>
      </header>

      <!-- ── CONTENT ── -->
      <main class="px-6 pb-12">

        @if (loading()) {
          <div class="flex flex-col gap-3">
            @for (n of skeletons; track n) {
              <div class="skeleton h-24 rounded-2xl border border-white/[.07]"
                   [style.animation-delay]="n * 70 + 'ms'"></div>
            }
          </div>
        }

        @else if (error()) {
          <div class="flex flex-col items-center gap-3 py-20 text-center">
            <div class="w-14 h-14 rounded-2xl bg-[#111116] border border-white/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-white/30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <p class="font-bebas text-2xl tracking-[.04em]">Couldn't load bookings</p>
            <button class="mt-1 px-5 py-2 rounded-xl bg-amber-400 text-[#1a1200] text-sm font-bold
                           hover:bg-amber-300 transition-colors" (click)="load()">Try again</button>
          </div>
        }

        @else if (bookings().length === 0) {
          <div class="flex flex-col items-center gap-3 py-20 text-center">
            <div class="w-14 h-14 rounded-2xl bg-[#111116] border border-white/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-white/30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0
                         002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
              </svg>
            </div>
            <p class="font-bebas text-2xl tracking-[.04em]">No bookings yet</p>
            <p class="text-sm text-white/40">Explore events and grab your first ticket!</p>
            <button class="mt-1 px-5 py-2 rounded-xl bg-amber-400 text-[#1a1200] text-sm font-bold
                           hover:bg-amber-300 transition-colors"
                    (click)="router.navigate(['/user-dashboard'])">Browse Events</button>
          </div>
        }

        @else {
          <div class="flex flex-col gap-3">
            @for (b of bookings(); track b.ticketUniqueCode; let i = $index) {

              <div class="animate-slide-up relative overflow-hidden rounded-2xl
                           bg-[#09090c] border border-white/[.07]
                           transition-all duration-200 hover:border-white/15"
                   [style.animation-delay]="i * 50 + 'ms'">

                <!-- Tier stripe -->
                <div class="h-[3px] w-full" [style.background]="tc(b).stripeBg"></div>

                <div class="flex items-stretch px-4 py-3.5">

                  <!-- Left info -->
                  <div class="flex-1 min-w-0 flex flex-col gap-2">

                    <!-- Tier badge -->
                    <div class="inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-md border
                                font-mono text-[.58rem] tracking-[.1em] uppercase font-semibold"
                         [class]="tc(b).bg + ' ' + tc(b).border + ' ' + tc(b).text">
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
                      {{ tc(b).label }}
                    </div>

                    <h3 class="font-bebas truncate text-[#F2EEE6] leading-tight"
                        style="font-size:1.15rem;letter-spacing:.03em">{{ b.eventName }}</h3>

                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                      @if (b.eventDate) {
                        <span class="flex items-center gap-1 text-[.7rem] text-white/40">
                          <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                          </svg>
                          {{ fmtDate(b.eventDate) }} · {{ fmtTime(b.eventDate) }}
                        </span>
                      }
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

                    <div class="font-mono text-[.65rem] tracking-[.06em] text-white/30">{{ b.attendeeName }}</div>
                  </div>

                  <!-- Dashed divider -->
                  <div class="w-px mx-4 shrink-0 dash-sep"></div>

                  <!-- Right: price + QR button -->
                  <div class="flex flex-col items-end justify-between gap-2 shrink-0">

                    <div class="text-right">
                      <div class="font-mono text-[.52rem] tracking-[.14em] uppercase text-white/30 mb-0.5">Price paid</div>
                      @if (b.pricePaid === 0) {
                        <div class="font-bebas leading-none" [class]="tc(b).text"
                             style="font-size:1.3rem;letter-spacing:.04em">FREE</div>
                      } @else {
                        <div class="leading-none flex items-baseline gap-0.5">
                          <span class="font-mono text-[.6rem] text-white/40">EGP</span>
                          <span class="font-bebas leading-none" [class]="tc(b).text"
                                style="font-size:1.3rem;letter-spacing:.04em">
                            {{ b.pricePaid | number:'1.0-0' }}
                          </span>
                        </div>
                      }
                    </div>

                    <button
                      class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                             text-[.7rem] font-semibold border transition-all duration-150
                             active:scale-95"
                      [class]="tc(b).bg + ' ' + tc(b).border + ' ' + tc(b).text"
                      (click)="openQr(b)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01
                                 M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0
                                 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0
                                 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0
                                 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                      </svg>
                      Show QR
                    </button>
                  </div>
                </div>

              </div>
            }
          </div>

          <!-- Total spent -->
          <div class="mt-5 flex items-center justify-between px-4 py-3 rounded-xl
                      bg-[#09090c] border border-white/[.07]">
            <span class="font-mono text-[.68rem] tracking-[.12em] uppercase text-white/35">
              Total spent ({{ bookings().length }} ticket{{ bookings().length !== 1 ? 's' : '' }})
            </span>
            <span class="font-bebas text-amber-400" style="font-size:1.2rem;letter-spacing:.04em">
              EGP {{ totalSpent() | number:'1.0-0' }}
            </span>
          </div>
        }
      </main>
    </div>

    <!-- ══════════════════════════════════════════ -->
    <!--  QR MODAL                                 -->
    <!-- ══════════════════════════════════════════ -->

    @if (activeBooking()) {
      <!-- Backdrop -->
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
           style="background:rgba(0,0,0,.80);backdrop-filter:blur(16px);animation:backdropIn .2s ease both"
           (click)="closeQr()">

        <!-- Modal sheet -->
        <div class="animate-modal-in w-full sm:max-w-[360px] rounded-t-3xl sm:rounded-3xl overflow-hidden
                    bg-[#111116] border border-white/[.1] shadow-2xl"
             (click)="$event.stopPropagation()">

          <!-- Top handle (mobile) -->
          <div class="flex justify-center pt-3 pb-1 sm:hidden">
            <div class="w-10 h-1 rounded-full bg-white/20"></div>
          </div>

          <!-- Tier colour bar -->
          <div class="h-1 w-full mx-4" style="border-radius:99px"
               [style.background]="tc(activeBooking()!).stripeBg">
          </div>

          <!-- Header row -->
          <div class="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
            <div class="flex-1 min-w-0">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border mb-1.5
                           font-mono text-[.56rem] tracking-[.1em] uppercase font-semibold"
                    [class]="tc(activeBooking()!).bg + ' ' + tc(activeBooking()!).border + ' ' + tc(activeBooking()!).text">
                {{ tc(activeBooking()!).label }}
              </span>
              <h2 class="font-bebas text-[#F2EEE6] leading-tight truncate"
                  style="font-size:1.25rem;letter-spacing:.03em">
                {{ activeBooking()!.eventName }}
              </h2>
              @if (activeBooking()!.eventDate) {
                <p class="font-mono text-[.6rem] tracking-wide text-white/40 mt-0.5">
                  {{ fmtDate(activeBooking()!.eventDate) }} · {{ fmtTime(activeBooking()!.eventDate) }}
                </p>
              }
            </div>
            <button class="flex-shrink-0 w-8 h-8 rounded-full bg-white/[.06] border border-white/[.1]
                           flex items-center justify-center text-white/40
                           hover:bg-white/[.12] hover:text-white transition-all active:scale-90"
                    (click)="closeQr()">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- QR code — WHITE background is critical for camera readability -->
          <div class="flex flex-col items-center gap-3 px-5 pb-6">

            <div class="w-[200px] h-[200px] rounded-2xl bg-white p-2 shadow-lg
                        flex items-center justify-center">
              @if (!qrReady()) {
                <div class="flex flex-col items-center gap-2">
                  <span class="w-7 h-7 rounded-full border-[3px] border-gray-200 border-t-gray-500
                               inline-block animate-spin"></span>
                  <span class="text-[.65rem] text-gray-400 font-mono">Loading…</span>
                </div>
                <!-- Pre-load trigger -->
                <img [src]="qrImgUrl(activeBooking()!.qrPayload)" class="hidden"
                     (load)="qrReady.set(true)" (error)="qrReady.set(true)" alt=""/>
              } @else {
                <img [src]="qrImgUrl(activeBooking()!.qrPayload)"
                     [alt]="'Ticket QR for ' + activeBooking()!.eventName"
                     class="w-full h-full object-contain"
                     draggable="false"/>
              }
            </div>

            <p class="font-mono text-[.6rem] tracking-[.14em] uppercase text-white/35">
              Show this to the organizer to scan
            </p>

            <!-- Code display -->
            <div class="w-full bg-[#0c0c10] border border-white/[.07] rounded-xl px-4 py-3">
              <div class="font-mono text-[.5rem] tracking-[.16em] uppercase text-white/30 mb-1">Ticket Code</div>
              <div class="font-mono text-[.7rem] text-[#F2EEE6] break-all leading-relaxed tracking-wide">
                {{ activeBooking()!.ticketUniqueCode }}
              </div>
            </div>

            <!-- Actions -->
            <div class="w-full flex gap-2.5">
              <button
                class="flex-1 inline-flex items-center justify-center gap-1.5
                       py-2.5 rounded-xl text-[.78rem] font-semibold border
                       transition-all duration-150 active:scale-95"
                [class]="tc(activeBooking()!).bg + ' ' + tc(activeBooking()!).border + ' ' + tc(activeBooking()!).text"
                (click)="copyCode(activeBooking()!.ticketUniqueCode)"
              >
                @if (copied() === activeBooking()!.ticketUniqueCode) {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  Copied!
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2
                             m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  Copy code
                }
              </button>

              @if (activeBooking()!.online_url) {
                <a [href]="activeBooking()!.online_url" target="_blank" rel="noopener"
                   class="flex-1 inline-flex items-center justify-center gap-1.5
                          py-2.5 rounded-xl text-[.78rem] font-semibold
                          bg-sky-500/10 border border-sky-500/25 text-sky-400
                          hover:bg-sky-500/20 transition-colors active:scale-95">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                  Join online
                </a>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class UserBookingsComponent implements OnInit, OnDestroy {
  readonly router       = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly d$   = new Subject<void>();
  private readonly BASE = 'https://eventora.runasp.net/api';

  bookings      = signal<BookingFlat[]>([]);
  loading       = signal(true);
  error         = signal(false);
  copied        = signal<string | null>(null);
  activeBooking = signal<BookingFlat | null>(null);
  qrReady       = signal(false);

  readonly skeletons = Array.from({ length: 4 }, (_, i) => i);
  readonly fmtDate   = fmtDate;
  readonly fmtTime   = fmtTime;
  readonly tc        = (b: BookingFlat) => tierCfg(b.tier);
  readonly qrImgUrl  = qrImgUrl;

  readonly totalSpent = computed(() =>
    this.bookings().reduce((s, b) => s + (b.pricePaid ?? 0), 0)
  );

  ngOnInit():    void { this.load(); }
  ngOnDestroy(): void { this.d$.next(); this.d$.complete(); }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.http.get<BookingResponse>(`${this.BASE}/Ticket/MyBookings`).pipe(
      catchError(() => {
        this.error.set(true);
        this.loading.set(false);
        return of({ data:[], success:false, message:'', errors:[] } as BookingResponse);
      }),
      takeUntil(this.d$),
    ).subscribe(res => {
      if (!res.success && !res.data?.length && this.error()) return;
      this.bookings.set(
        [...(res.data ?? [])].sort((a, b) =>
          new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
        )
      );
      this.loading.set(false);
    });
  }

  openQr(b: BookingFlat): void {
    this.qrReady.set(false);
    this.activeBooking.set(b);
    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden';
  }

  closeQr(): void {
    this.activeBooking.set(null);
    document.body.style.overflow = '';
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(code);
      setTimeout(() => this.copied.set(null), 2000);
    } catch { /* silent */ }
  }
}