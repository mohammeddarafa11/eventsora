// src/app/features/tickets/verify-ticket/verify-ticket.ts
//
// ─── INSTALL FIRST ───────────────────────────────────────────────────────────
// npm install qr-scanner
// ─────────────────────────────────────────────────────────────────────────────
// qr-scanner by Nimiq is the most reliable QR library for iOS Safari.
// It uses requestAnimationFrame + canvas, not continuous decodeFromVideoDevice.
//
import {
  Component, inject, signal, OnDestroy, ElementRef,
  viewChild, ChangeDetectionStrategy, ChangeDetectorRef, AfterViewInit,
} from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { Subject }       from 'rxjs';
import { takeUntil }     from 'rxjs/operators';
import { TicketService, Booking, EventTicket } from '@core/services/ticket.service';

// ── Extended types — the verify endpoint returns nested event data that
//    the base EventTicket interface doesn't declare. ──────────────────────────

interface VerifyEventTicket extends Omit<EventTicket, 'ticketTemplate'> {
  ticketTemplate?: {
    name?:        string | null;
    description?: string | null;
    tier?:        number;
  } | null;
  event?: {
    title?:         string | null;
    start_time?:    string;
    end_time?:      string;
    city?:          string | null;
    nameOfPlace?:   string | null;
    event_img_url?: string | null;
  } | null;
}

interface VerifyBooking extends Omit<Booking, 'eventTicket'> {
  eventTicket?: VerifyEventTicket;
}

// ── Dynamic import so the build doesn't break if lib isn't installed yet ─────
// qr-scanner ships as ESM — import it lazily at runtime
let QrScannerClass: any = null;

// ── Type helpers ──────────────────────────────────────────────────────────────

const TIER_CFG: Record<number, { label: string; color: string }> = {
  0: { label: 'Standard', color: '#10b981' },
  1: { label: 'VIP',      color: '#F0B429' },
  2: { label: 'Premium',  color: '#a78bfa' },
};
function tierInfo(t?: number) { return TIER_CFG[t ?? 0] ?? TIER_CFG[0]; }

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-EG', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractUUID(raw: string): string | null {
  const t = raw.trim();
  if (UUID_RE.test(t)) return t;
  const m = t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

type ViewState = 'idle' | 'scanning' | 'verifying' | 'valid' | 'used' | 'invalid' | 'inactive';

@Component({
  selector:    'app-verify-ticket',
  standalone:  true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports:     [CommonModule, FormsModule],
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
    :host { font-family:'Plus Jakarta Sans',sans-serif; display:block; }
    .font-bebas { font-family:'Bebas Neue',sans-serif; }
    .font-mono  { font-family:'DM Mono',monospace; }
    @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
    @keyframes scanLine { 0%{top:8%} 100%{top:88%} }
    @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.45} }
    .animate-fade-up { animation:fadeUp .38s cubic-bezier(.22,1,.36,1) both; }
    /* Corner brackets */
    .corner { position:absolute; width:28px; height:28px; border-color:#FF4433; border-style:solid; }
    .corner--tl { top:0; left:0;  border-width:3px 0 0 3px; border-radius:4px 0 0 0; }
    .corner--tr { top:0; right:0; border-width:3px 3px 0 0; border-radius:0 4px 0 0; }
    .corner--bl { bottom:0; left:0;  border-width:0 0 3px 3px; border-radius:0 0 0 4px; }
    .corner--br { bottom:0; right:0; border-width:0 3px 3px 0; border-radius:0 0 4px 0; }
    /* Scan line */
    .scan-line {
      position:absolute; left:0; right:0; height:2px;
      background:linear-gradient(to right,transparent,#FF4433,transparent);
      animation:scanLine 1.8s ease-in-out infinite alternate;
      box-shadow:0 0 10px rgba(255,68,51,.7);
    }
    /* Video fill */
    #scanner-video { position:absolute;inset:0;width:100%;height:100%;object-fit:cover; }
    /* Timer ring */
    .timer-ring { transition:stroke-dashoffset .9s linear; }
  `],
  template: `
  <div class="min-h-full bg-[#060608] text-[#F2EEE6] px-5 py-10 sm:px-8">
    <div class="max-w-[560px] mx-auto flex flex-col gap-6">

      <!-- ── HEADER ── -->
      <div class="animate-fade-up flex flex-col gap-2">
        <div class="inline-flex items-center gap-2 font-mono text-[.66rem]
                    tracking-[.14em] uppercase text-[#FF4433]">
          <span class="w-[5px] h-[5px] rounded-full bg-[#FF4433]"></span>
          Ticket Verification
        </div>
        <h1 class="font-bebas leading-none m-0"
            style="font-size:clamp(2rem,5vw,2.8rem);letter-spacing:.04em">
          Verify <span class="text-[#FF4433]">Ticket</span>
        </h1>
        <p class="text-[.85rem] text-white/40 font-light m-0">
          Scan a QR code with your camera or enter a UUID manually.
        </p>
      </div>

      <!-- ── MODE TOGGLE ── -->
      <div class="flex gap-1.5 p-1 rounded-xl bg-[#0c0c10] border border-white/[.07]">
        <button
          class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                 text-[.82rem] font-semibold transition-all duration-200"
          [class]="mode() === 'manual'
            ? 'bg-[#111116] border border-white/[.1] text-[#F2EEE6]'
            : 'text-white/40 hover:text-white/70'"
          (click)="setMode('manual')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                     m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Manual
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                 text-[.82rem] font-semibold transition-all duration-200"
          [class]="mode() === 'scan'
            ? 'bg-[#111116] border border-white/[.1] text-[#F2EEE6]'
            : 'text-white/40 hover:text-white/70'"
          (click)="setMode('scan')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4
                     m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0
                     001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0
                     001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
          </svg>
          Scan QR
        </button>
      </div>

      <!-- ══════════════════════════════════════════ -->
      <!--  MANUAL MODE                              -->
      <!-- ══════════════════════════════════════════ -->

      @if (mode() === 'manual') {
        <div class="animate-fade-up flex flex-col gap-4
                    bg-[#0c0c10] border border-white/[.07] rounded-[18px] p-5">

          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-[10px] flex-shrink-0 flex items-center justify-center
                        bg-[#FF4433]/[.08] border border-[#FF4433]/[.18] text-[#FF4433]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0
                         002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
              </svg>
            </div>
            <div>
              <p class="text-[.88rem] font-bold text-[#F2EEE6] mb-0.5">Ticket UUID</p>
              <p class="font-mono text-[.6rem] tracking-[.06em] text-white/40">
                e.g. f0f0bf50-b49f-4123-a7f2-5e912d87c732
              </p>
            </div>
          </div>

          <div class="flex gap-2.5 flex-col sm:flex-row">
            <input
              class="flex-1 bg-[#111116] border-[1.5px] rounded-[11px]
                     text-[#F2EEE6] font-mono text-[.82rem] tracking-[.04em]
                     px-4 py-3 outline-none transition-all duration-200
                     placeholder:text-white/25
                     focus:border-[#FF4433]/50 focus:shadow-[0_0_0_3px_rgba(255,68,51,.08)]"
              [class]="inputErr() ? 'border-red-500/50' : 'border-white/[.07]'"
              type="text"
              [(ngModel)]="codeInput"
              (ngModelChange)="onInput()"
              (keydown.enter)="verify(codeInput)"
              (paste)="onPaste($event)"
              placeholder="Paste or type ticket UUID…"
              spellcheck="false" autocomplete="off" maxlength="36"
            />
            <button
              class="flex-shrink-0 inline-flex items-center justify-center gap-2
                     px-5 py-3 rounded-[11px] bg-[#FF4433] text-white font-bold text-[.88rem]
                     transition-all duration-200
                     disabled:opacity-35 disabled:cursor-not-allowed
                     enabled:hover:shadow-[0_0_44px_rgba(255,68,51,.45)]
                     enabled:hover:-translate-y-px active:scale-95"
              [disabled]="state() === 'verifying' || !codeInput.trim() || inputErr()"
              (click)="verify(codeInput)"
            >
              @if (state() === 'verifying') {
                <span class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white
                             inline-block animate-spin"></span>
                Checking…
              } @else {
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Verify
              }
            </button>
          </div>

          @if (inputErr()) {
            <p class="flex items-center gap-1.5 text-[.72rem] text-red-400 -mt-1">
              <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <path stroke-linecap="round" d="M12 8v4M12 16h.01"/>
              </svg>
              Not a valid UUID format
            </p>
          }
        </div>
      }

      <!-- ══════════════════════════════════════════ -->
      <!--  SCAN MODE                                -->
      <!-- ══════════════════════════════════════════ -->

      @if (mode() === 'scan') {
        <div class="animate-fade-up flex flex-col gap-4">

          <!-- Camera error -->
          @if (camErr()) {
            <div class="flex items-start gap-3 p-4 rounded-2xl
                        bg-red-500/[.06] border border-red-500/20">
              <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none"
                   stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0
                         01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0
                         01-2 2H5a2 2 0 01-2-2V8z"/>
              </svg>
              <div>
                <p class="text-[.84rem] font-semibold text-red-400">Camera unavailable</p>
                <p class="text-[.76rem] text-white/40 mt-0.5">{{ camErr() }} — use Manual mode.</p>
              </div>
            </div>
          }

          <!-- Viewfinder: in DOM as soon as scan mode is active so viewChild resolves -->
          @if (!camErr() && state() !== 'verifying') {
            <div class="flex flex-col gap-3">

              <!-- Scan area -->
              <div class="relative w-full overflow-hidden rounded-2xl bg-black border border-white/[.08]"
                   style="aspect-ratio:1/1;max-height:320px">

                <!-- Video always present in DOM -->
                <video #scannerVideo id="scanner-video" playsinline muted autoplay></video>

                <!-- Init spinner while camera warms up -->
                @if (state() === 'idle') {
                  <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                    <span class="w-10 h-10 rounded-full border-[3px] border-white/10 border-t-[#FF4433]
                                 animate-spin"></span>
                    <span class="font-mono text-[.62rem] tracking-[.14em] uppercase text-white/40">
                      Starting camera…
                    </span>
                  </div>
                }

                <!-- Active overlay -->
                @if (state() === 'scanning') {
                  <div class="absolute inset-0 pointer-events-none"
                       style="background:radial-gradient(ellipse 55% 55% at 50% 50%,transparent 36%,rgba(0,0,0,.72) 100%)">
                  </div>
                  <div class="absolute pointer-events-none" style="inset:15%">
                    <span class="corner corner--tl"></span>
                    <span class="corner corner--tr"></span>
                    <span class="corner corner--bl"></span>
                    <span class="corner corner--br"></span>
                    <span class="scan-line"></span>
                  </div>
                  <div class="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                    <span class="font-mono text-[.6rem] tracking-[.14em] uppercase
                                 px-3 py-1 rounded-full bg-black/65 text-white/55
                                 border border-white/[.08]">
                      Hold steady — auto-scanning
                    </span>
                  </div>
                }
              </div>

              <!-- Timer + status (only while scanning) -->
              @if (state() === 'scanning') {
                <div class="flex items-center gap-4 px-4 py-3 rounded-xl
                            bg-[#0c0c10] border border-white/[.07]">

                  <div class="relative flex-shrink-0 w-11 h-11">
                    <svg class="w-full h-full -rotate-90" viewBox="0 0 44 44">
                      <circle cx="22" cy="22" r="18" fill="none"
                              stroke="rgba(255,255,255,.08)" stroke-width="3"/>
                      <circle cx="22" cy="22" r="18" fill="none"
                              stroke="#FF4433" stroke-width="3"
                              stroke-dasharray="113"
                              class="timer-ring"
                              [attr.stroke-dashoffset]="timerOffset()"/>
                    </svg>
                    <span class="absolute inset-0 flex items-center justify-center
                                 font-mono text-[.7rem] font-bold text-white/70">
                      {{ timerSec() }}
                    </span>
                  </div>

                  <div class="flex-1 min-w-0">
                    <p class="text-[.82rem] font-semibold text-[#F2EEE6]">Scanning…</p>
                    <p class="font-mono text-[.6rem] tracking-wide text-white/35 mt-0.5">
                      Point camera at the QR code
                    </p>
                  </div>

                  <div class="flex-shrink-0 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-[#FF4433]"
                          style="animation:pulse 1.2s ease-in-out infinite"></span>
                    <span class="font-mono text-[.58rem] tracking-wide uppercase text-[#FF4433]">Live</span>
                  </div>
                </div>

                @if (cameras().length > 1) {
                  <div class="flex items-center gap-3">
                    <span class="font-mono text-[.6rem] tracking-[.1em] uppercase text-white/35 flex-shrink-0">
                      Camera
                    </span>
                    <select class="flex-1 bg-[#0c0c10] border border-white/[.07] rounded-lg
                                   text-[#F2EEE6] text-[.82rem] px-3 py-2 outline-none"
                            (change)="switchCamera($event)">
                      @for (c of cameras(); track c.id) {
                        <option [value]="c.id">{{ c.label }}</option>
                      }
                    </select>
                  </div>
                }
              }
            </div>
          }

          <!-- API verifying overlay -->
          @if (state() === 'verifying') {
            <div class="flex items-center gap-3 px-5 py-4 rounded-2xl
                        bg-[#0c0c10] border border-white/[.07]">
              <span class="w-5 h-5 rounded-full border-2 border-white/20 border-t-[#FF4433]
                           flex-shrink-0 animate-spin"></span>
              <div>
                <p class="text-[.85rem] font-semibold text-[#F2EEE6]">Verifying with server…</p>
                <p class="font-mono text-[.6rem] tracking-wide text-white/35 mt-0.5 truncate max-w-[260px]">
                  {{ lastCode() }}
                </p>
              </div>
            </div>
          }
        </div>
      }

      <!-- ══════════════════════════════════════════ -->
      <!--  RESULT CARDS                             -->
      <!-- ══════════════════════════════════════════ -->

      <!-- ── VALID ── -->
      @if (state() === 'valid' && result()) {
        <div class="animate-fade-up flex flex-col gap-4 rounded-[18px] p-5
                    bg-emerald-500/[.06] border border-emerald-500/[.22]">

          <div class="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-full
                      font-mono text-[.72rem] font-semibold tracking-[.08em] uppercase
                      bg-emerald-500/[.14] text-emerald-400 border border-emerald-500/30">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            ✓ Valid Ticket — Allow Entry
          </div>

          <div class="flex flex-col gap-2 bg-[#0c0c10] border border-emerald-500/20 rounded-[14px] p-4">

            @if (result()!.eventTicket?.ticketTemplate?.tier !== undefined) {
              <div class="inline-flex items-center gap-1 w-fit px-2.5 py-0.5 rounded-full border
                          font-mono text-[.62rem] tracking-[.08em] uppercase font-semibold"
                   [style.color]="tierInfo(result()!.eventTicket!.ticketTemplate!.tier).color"
                   [style.border-color]="tierInfo(result()!.eventTicket!.ticketTemplate!.tier).color + '44'"
                   [style.background]="tierInfo(result()!.eventTicket!.ticketTemplate!.tier).color + '15'">
                {{ tierInfo(result()!.eventTicket!.ticketTemplate!.tier).label }}
                @if (result()!.eventTicket?.ticketTemplate?.name) {
                  · {{ result()!.eventTicket!.ticketTemplate!.name }}
                }
              </div>
            }

            @if (result()!.eventTicket?.event?.title) {
              <h2 class="font-bebas text-[#F2EEE6] leading-tight m-0"
                  style="font-size:1.35rem;letter-spacing:.04em">
                {{ result()!.eventTicket!.event!.title }}
              </h2>
            }

            <div class="flex flex-col gap-1.5 mt-1">
              @if (result()!.eventTicket?.event?.start_time) {
                <div class="flex items-center gap-2 text-[.78rem] text-white/50">
                  <svg class="w-3.5 h-3.5 text-emerald-500/60 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  {{ fmtDateTime(result()!.eventTicket!.event!.start_time) }}
                </div>
              }
              @if (result()!.eventTicket?.event?.city || result()!.eventTicket?.event?.nameOfPlace) {
                <div class="flex items-center gap-2 text-[.78rem] text-white/50">
                  <svg class="w-3.5 h-3.5 text-emerald-500/60 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  {{ result()!.eventTicket!.event!.nameOfPlace || result()!.eventTicket!.event!.city }}
                </div>
              }
              <div class="flex items-center gap-2 text-[.78rem] text-white/50">
                <svg class="w-3.5 h-3.5 text-emerald-500/60 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                </svg>
                Purchased: {{ fmtDateTime(result()!.purchaseDate) }}
              </div>
            </div>

            <div class="flex items-center gap-1 py-0.5">
              <div class="flex-1 h-px bg-white/[.06]"></div>
              <div class="flex gap-1">
                <span class="w-1 h-1 rounded-full bg-emerald-500/30"></span>
                <span class="w-1 h-1 rounded-full bg-emerald-500/30"></span>
                <span class="w-1 h-1 rounded-full bg-emerald-500/30"></span>
              </div>
              <div class="flex-1 h-px bg-white/[.06]"></div>
            </div>

            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p class="font-mono text-[.52rem] tracking-[.14em] uppercase text-white/30 mb-0.5">Ticket Code</p>
                <code class="font-mono text-[.68rem] text-emerald-400 bg-emerald-500/[.08]
                             px-2 py-0.5 rounded-md break-all">{{ result()!.ticketUniqueCode }}</code>
              </div>
              @if (result()!.eventTicket?.actualPrice !== undefined) {
                <div class="text-right">
                  <p class="font-mono text-[.52rem] tracking-[.14em] uppercase text-white/30 mb-0.5">Value</p>
                  <span class="font-mono text-[.9rem] font-semibold text-emerald-400">
                    @if (result()!.eventTicket!.actualPrice === 0) { FREE }
                    @else { EGP {{ result()!.eventTicket!.actualPrice | number:'1.0-2' }} }
                  </span>
                </div>
              }
            </div>
          </div>

          <button class="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-[9px]
                         bg-transparent border border-emerald-500/35 text-emerald-400
                         text-[.8rem] font-semibold cursor-pointer
                         hover:bg-emerald-500/[.08] transition-colors active:scale-95"
                  (click)="reset()">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0
                       0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Verify another ticket
          </button>
        </div>
      }

      <!-- ── ALREADY USED ── -->
      @if (state() === 'used' && result()) {
        <div class="animate-fade-up flex flex-col gap-4 rounded-[18px] p-5
                    bg-amber-500/[.06] border border-amber-500/[.22]">
          <div class="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-full
                      font-mono text-[.72rem] font-semibold tracking-[.08em] uppercase
                      bg-amber-400/[.14] text-amber-400 border border-amber-400/30">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            ⚠ Already Used — Deny Entry
          </div>
          <p class="text-[.88rem] font-semibold text-[#F2EEE6] m-0">
            This ticket was already scanned.
          </p>
          <div class="flex flex-col gap-2.5 bg-[#0c0c10] border border-amber-400/15 rounded-[12px] p-4">
            <div class="flex justify-between gap-3 flex-wrap">
              <span class="font-mono text-[.6rem] tracking-[.12em] uppercase text-white/40">Used at</span>
              <span class="text-[.82rem] font-semibold text-[#F2EEE6] text-right">{{ fmtDateTime(result()!.usedAt) }}</span>
            </div>
            @if (result()!.eventTicket?.event?.title) {
              <div class="flex justify-between gap-3 flex-wrap">
                <span class="font-mono text-[.6rem] tracking-[.12em] uppercase text-white/40">Event</span>
                <span class="text-[.82rem] font-semibold text-[#F2EEE6] text-right">{{ result()!.eventTicket!.event!.title }}</span>
              </div>
            }
            <div class="flex justify-between gap-3 flex-wrap">
              <span class="font-mono text-[.6rem] tracking-[.12em] uppercase text-white/40">Code</span>
              <code class="font-mono text-[.68rem] text-amber-400 bg-amber-400/[.08] px-2 py-0.5 rounded-md break-all">
                {{ result()!.ticketUniqueCode }}
              </code>
            </div>
          </div>
          <button class="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-[9px]
                         bg-transparent border border-amber-400/35 text-amber-400
                         text-[.8rem] font-semibold hover:bg-amber-400/[.08]
                         transition-colors active:scale-95"
                  (click)="reset()">Scan another ticket</button>
        </div>
      }

      <!-- ── INVALID ── -->
      @if (state() === 'invalid') {
        <div class="animate-fade-up flex flex-col gap-4 rounded-[18px] p-5
                    bg-red-500/[.06] border border-red-500/[.22]">
          <div class="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-full
                      font-mono text-[.72rem] font-semibold tracking-[.08em] uppercase
                      bg-red-500/[.14] text-red-400 border border-red-500/30">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 9l-6 6M9 9l6 6"/>
            </svg>
            ✗ Invalid Ticket
          </div>
          <p class="text-[.88rem] font-semibold text-red-400/90 m-0">{{ errMsg() }}</p>
          <div class="flex justify-between gap-3 flex-wrap">
            <span class="font-mono text-[.6rem] tracking-[.12em] uppercase text-white/40">Checked code</span>
            <code class="font-mono text-[.7rem] text-red-400 bg-red-500/[.08] px-2 py-0.5 rounded-md break-all">
              {{ lastCode() }}
            </code>
          </div>
          <button class="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-[9px]
                         bg-transparent border border-red-500/35 text-red-400
                         text-[.8rem] font-semibold hover:bg-red-500/[.08]
                         transition-colors active:scale-95"
                  (click)="reset()">Try again</button>
        </div>
      }

      <!-- ── INACTIVE ── -->
      @if (state() === 'inactive') {
        <div class="animate-fade-up flex flex-col gap-4 rounded-[18px] p-5
                    bg-indigo-500/[.06] border border-indigo-500/[.22]">
          <div class="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-full
                      font-mono text-[.72rem] font-semibold tracking-[.08em] uppercase
                      bg-indigo-400/[.14] text-indigo-400 border border-indigo-400/30">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/>
            </svg>
            Event Not Active
          </div>
          <p class="text-[.88rem] font-semibold text-[#F2EEE6] m-0">
            Valid ticket — but the event is outside its active window.
          </p>
          <p class="text-[.82rem] text-indigo-400/80 m-0">{{ errMsg() }}</p>
          <button class="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-[9px]
                         bg-transparent border border-indigo-400/35 text-indigo-400
                         text-[.8rem] font-semibold hover:bg-indigo-400/[.08]
                         transition-colors active:scale-95"
                  (click)="reset()">Try again</button>
        </div>
      }

    </div>
  </div>
  `,
})
export class VerifyTicketComponent implements OnDestroy, AfterViewInit {
  private readonly ticketSvc = inject(TicketService);
  private readonly cdr       = inject(ChangeDetectorRef);
  private readonly destroy$  = new Subject<void>();

  // Reference to <video #scannerVideo>
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('scannerVideo');

  // qr-scanner instance
  private scanner: any = null;

  // ── Component state ───────────────────────────────────────────────────
  state    = signal<ViewState>('idle');
  mode     = signal<'manual' | 'scan'>('manual');
  result   = signal<VerifyBooking | null>(null);
  errMsg   = signal('');
  lastCode = signal('');
  inputErr = signal(false);
  camErr   = signal('');
  cameras  = signal<{ id: string; label: string }[]>([]);

  // Timer: 60 second countdown
  timerSec    = signal(60);
  timerOffset = signal(0); // SVG stroke-dashoffset (0=full, 113=empty)
  private timerInterval: any = null;

  codeInput = '';

  readonly tierInfo    = tierInfo;
  readonly fmtDateTime = fmtDateTime;

  ngAfterViewInit(): void {}

  // ── Mode toggle ───────────────────────────────────────────────────────

  setMode(m: 'manual' | 'scan'): void {
    if (this.mode() === m) return;
    this.stopScanner();
    this.state.set('idle');
    this.mode.set(m);
    this.cdr.markForCheck();
    if (m === 'scan') {
      this.camErr.set('');
      // <video> is now always in the DOM when mode=scan (no @if wrapping it)
      // so a short tick is enough for Angular to process the mode change
      setTimeout(() => this.startScanner(), 60);
    }
  }

  // ── Scanner ───────────────────────────────────────────────────────────

  private async startScanner(): Promise<void> {
    const videoEl = this.videoRef()?.nativeElement;
    if (!videoEl) {
      // Should not happen — <video> is always in DOM when mode=scan
      this.camErr.set('Could not find video element');
      this.cdr.markForCheck();
      return;
    }

    // Lazy-load qr-scanner
    if (!QrScannerClass) {
      try {
        const mod = await import('qr-scanner' as any);
        QrScannerClass = mod.default ?? mod;
      } catch {
        this.camErr.set('qr-scanner library not installed. Run: npm install qr-scanner');
        this.cdr.markForCheck();
        return;
      }
    }

    try {
      // List cameras first
      const cams: any[] = await QrScannerClass.listCameras(true);
      this.cameras.set(cams.map((c: any) => ({ id: c.id, label: c.label || 'Camera' })));

      // Create scanner — prefer back camera on mobile
      this.scanner = new QrScannerClass(
        videoEl,
        (result: any) => {
          const raw = typeof result === 'string' ? result : result?.data ?? '';
          this.onScanResult(raw);
        },
        {
          preferredCamera:      'environment', // rear camera on phone
          highlightScanRegion:  false,         // we draw our own overlay
          highlightCodeOutline: false,
          returnDetailedScanResult: true,
        },
      );

      await this.scanner.start();
      this.state.set('scanning');
      this.startTimer();
      this.cdr.markForCheck();

    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
        this.camErr.set('Camera permission denied');
      } else {
        this.camErr.set('Could not start camera');
      }
      console.error('[VerifyTicket] scanner error:', err);
      this.cdr.markForCheck();
    }
  }

  private stopScanner(): void {
    this.stopTimer();
    try { this.scanner?.stop(); this.scanner?.destroy(); } catch {}
    this.scanner = null;
  }

  // ── Timer ─────────────────────────────────────────────────────────────

  private startTimer(): void {
    this.stopTimer();
    this.timerSec.set(60);
    this.timerOffset.set(0);

    this.timerInterval = setInterval(() => {
      const remaining = this.timerSec() - 1;
      if (remaining <= 0) {
        this.stopTimer();
        this.timerSec.set(0);
        this.timerOffset.set(113);
        this.cdr.markForCheck();
        return;
      }
      this.timerSec.set(remaining);
      // stroke-dashoffset: 0 = full circle, 113 = empty
      this.timerOffset.set(Math.round(113 * (1 - remaining / 60)));
      this.cdr.markForCheck();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  // ── Scan result ───────────────────────────────────────────────────────

  private onScanResult(raw: string): void {
    if (!raw || this.state() === 'verifying') return;

    // Stop scanner & timer immediately so it doesn't fire again
    this.stopScanner();

    const uuid = extractUUID(raw);
    if (!uuid) {
      this.errMsg.set('QR code does not contain a valid ticket UUID.');
      this.lastCode.set(raw.slice(0, 50));
      this.state.set('invalid');
      this.cdr.markForCheck();
      return;
    }

    this.verify(uuid);
  }

  // ── Verify API call ───────────────────────────────────────────────────

  verify(rawCode: string): void {
    const code = rawCode.trim();
    if (!code || this.state() === 'verifying') return;

    if (!UUID_RE.test(code)) {
      this.inputErr.set(true);
      return;
    }

    this.lastCode.set(code);
    this.state.set('verifying');
    this.result.set(null);
    this.cdr.markForCheck();

    this.ticketSvc.verifyTicket(code).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: (booking: VerifyBooking) => {
        this.result.set(booking);
        this.state.set(booking.isUsed ? 'used' : 'valid');
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        const msg: string =
          err?.error?.message ||
          err?.message ||
          'Ticket not found or invalid.';

        if (msg.toLowerCase().includes('not active') || msg.toLowerCase().includes('event not')) {
          this.errMsg.set(msg);
          this.state.set('inactive');
        } else {
          this.errMsg.set(msg);
          this.state.set('invalid');
        }
        this.cdr.markForCheck();
      },
    });
  }

  // ── Camera switching ──────────────────────────────────────────────────

  async switchCamera(e: Event): Promise<void> {
    const id = (e.target as HTMLSelectElement).value;
    try { await this.scanner?.setCamera(id); } catch {}
  }

  // ── Manual input ──────────────────────────────────────────────────────

  onInput(): void {
    const v = this.codeInput.trim();
    this.inputErr.set(v.length >= 36 && !UUID_RE.test(v));
  }

  onPaste(e: ClipboardEvent): void {
    const pasted  = e.clipboardData?.getData('text') ?? '';
    const cleaned = pasted.trim();
    if (cleaned !== pasted) {
      e.preventDefault();
      this.codeInput = cleaned;
      this.onInput();
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────

  reset(): void {
    this.codeInput = '';
    this.inputErr.set(false);
    this.result.set(null);
    this.errMsg.set('');
    this.lastCode.set('');
    this.camErr.set('');

    if (this.mode() === 'scan') {
      this.state.set('idle');
      this.cdr.markForCheck();
      setTimeout(() => this.startScanner(), 120);
    } else {
      this.state.set('idle');
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.stopScanner();
    this.destroy$.next();
    this.destroy$.complete();
  }
}