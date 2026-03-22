// src/app/features/tickets/verify-ticket/verify-ticket.ts
//
// Install: npm install @zxing/browser @zxing/library
// (works with Angular 20 — no peer-dep conflict)
//
import {
  Component, inject, signal, OnDestroy,
  ElementRef, viewChild, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { HttpClient }    from '@angular/common/http';
import { Subject, of }   from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';

// ── API response shapes ──────────────────────────────────────────────────────

interface VerifyResponse {
  data:    VerifyData | null;
  success: boolean;
  message: string;
  errors:  string[];
}

interface VerifyData {
  id:               number;
  ticketUniqueCode: string;
  isUsed:           boolean;
  usedAt:           string | null;
  purchaseDate:     string;
  userId:           number;
  eventTicketId:    number;
  eventTicket: {
    actualPrice: number;
    ticketTemplate?: { name?: string; description?: string; tier?: number };
    event?: {
      title?:         string;
      start_time?:    string;
      end_time?:      string;
      city?:          string;
      nameOfPlace?:   string;
      event_img_url?: string;
    };
  } | null;
}

// ── Tier helpers ─────────────────────────────────────────────────────────────

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Standard', color: '#10b981' },
  1: { label: 'VIP',      color: '#F0B429' },
  2: { label: 'Premium',  color: '#a78bfa' },
};
function tierInfo(t?: number) { return TIER_LABELS[t ?? 0] ?? TIER_LABELS[0]; }

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-EG', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractUUID(raw: string): string | null {
  const trimmed = raw.trim();
  if (UUID_RE.test(trimmed)) return trimmed;
  const match = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
}

type ViewState = 'idle' | 'loading' | 'valid' | 'used' | 'invalid' | 'inactive';
type InputMode = 'manual' | 'scan';

@Component({
  selector:    'app-verify-ticket',
  standalone:  true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports:     [CommonModule, FormsModule],
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
    :host { font-family: 'Plus Jakarta Sans', sans-serif; display: block; }
    .font-bebas { font-family: 'Bebas Neue', sans-serif; }
    .font-mono  { font-family: 'DM Mono', monospace; }
    @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
    @keyframes scanLine { 0%{top:0%} 100%{top:100%} }
    .animate-fade-up { animation: fadeUp .38s cubic-bezier(.22,1,.36,1) both; }
    /* Corner brackets */
    .scan-corner { position:absolute;width:22px;height:22px;border-color:#FF4433;border-style:solid;border-radius:2px; }
    .scan-corner--tl { top:0;left:0;border-width:3px 0 0 3px; }
    .scan-corner--tr { top:0;right:0;border-width:3px 3px 0 0; }
    .scan-corner--bl { bottom:0;left:0;border-width:0 0 3px 3px; }
    .scan-corner--br { bottom:0;right:0;border-width:0 3px 3px 0; }
    /* Animated scan line */
    .scan-line {
      position:absolute;left:0;right:0;height:2px;
      background:linear-gradient(to right,transparent,#FF4433,transparent);
      animation:scanLine 2s ease-in-out infinite alternate;
      box-shadow:0 0 8px rgba(255,68,51,.6);
    }
    /* Make the video fill its container */
    #qr-video { position:absolute;inset:0;width:100%;height:100%;object-fit:cover; }
  `],
  template: `
  <div class="min-h-full bg-[#060608] text-[#F2EEE6] px-5 py-10 sm:px-8">
    <div class="max-w-[600px] mx-auto flex flex-col gap-7">

      <!-- ── PAGE HEADER ── -->
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
        <p class="text-[.85rem] text-white/40 font-light leading-relaxed m-0">
          Scan a QR code with your camera or paste a ticket UUID to check entry.
        </p>
      </div>

      <!-- ── MODE TOGGLE ── -->
      <div class="animate-fade-up flex gap-1.5 p-1 rounded-xl
                  bg-[#0c0c10] border border-white/[.07]">
        <button
          class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                 text-[.82rem] font-semibold transition-all duration-200"
          [class]="inputMode() === 'manual'
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
          [class]="inputMode() === 'scan'
            ? 'bg-[#111116] border border-white/[.1] text-[#F2EEE6]'
            : 'text-white/40 hover:text-white/70'"
          (click)="setMode('scan')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01
                     M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0
                     00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0
                     00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0
                     00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
          </svg>
          Scan QR
        </button>
      </div>

      <!-- ══════════════════════════════════════════ -->
      <!--  MANUAL MODE                              -->
      <!-- ══════════════════════════════════════════ -->

      @if (inputMode() === 'manual') {
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
              <p class="text-[.88rem] font-bold text-[#F2EEE6] mb-0.5">Ticket Code</p>
              <p class="font-mono text-[.6rem] tracking-[.06em] text-white/40">
                UUID format — e.g. f0f0bf50-b49f-4123-a7f2-5e912d87c732
              </p>
            </div>
          </div>

          <div class="flex gap-2.5 items-stretch flex-col sm:flex-row">
            <input
              class="flex-1 bg-[#111116] border-[1.5px] rounded-[11px]
                     text-[#F2EEE6] font-mono text-[.82rem] tracking-[.04em]
                     px-4 py-3 outline-none transition-all duration-200
                     placeholder:text-white/25
                     focus:border-[#FF4433]/50 focus:shadow-[0_0_0_3px_rgba(255,68,51,.08)]"
              [class]="inputError() ? 'border-red-500/50' : 'border-white/[.07]'"
              type="text"
              [(ngModel)]="codeInput"
              (ngModelChange)="onInputChange()"
              (keydown.enter)="verify()"
              (paste)="onPaste($event)"
              placeholder="Paste or type ticket UUID…"
              spellcheck="false"
              autocomplete="off"
              maxlength="36"
            />
            <button
              class="flex-shrink-0 inline-flex items-center justify-center gap-2
                     px-5 py-3 rounded-[11px] border-none
                     bg-[#FF4433] text-white font-bold text-[.88rem]
                     transition-all duration-200 whitespace-nowrap
                     shadow-[0_0_24px_rgba(255,68,51,.2)]
                     disabled:opacity-35 disabled:cursor-not-allowed
                     enabled:hover:shadow-[0_0_44px_rgba(255,68,51,.45)]
                     enabled:hover:-translate-y-px"
              [disabled]="!canVerify()"
              (click)="verify()"
            >
              @if (state() === 'loading') {
                <span class="w-[14px] h-[14px] rounded-full border-2
                             border-white/30 border-t-white inline-block
                             animate-spin"></span>
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

          @if (inputError()) {
            <p class="flex items-center gap-1.5 text-[.72rem] text-red-400 -mt-1">
              <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <path stroke-linecap="round" d="M12 8v4M12 16h.01"/>
              </svg>
              Not a valid UUID format
            </p>
          }

          @if (state() === 'idle' && !codeInput) {
            <p class="flex items-center gap-1.5 text-[.72rem] text-white/35 -mt-1">
              <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0
                         00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              Tip: Ctrl+V / Cmd+V to paste directly
            </p>
          }
        </div>
      }

      <!-- ══════════════════════════════════════════ -->
      <!--  SCAN MODE                                -->
      <!-- ══════════════════════════════════════════ -->

      @if (inputMode() === 'scan') {
        <div class="animate-fade-up flex flex-col gap-4">

          <!-- Camera error -->
          @if (cameraError()) {
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
                <p class="text-[.84rem] font-semibold text-red-400">Camera not available</p>
                <p class="text-[.76rem] text-white/40 mt-0.5">{{ cameraError() }} — use Manual mode.</p>
              </div>
            </div>
          }

          <!-- Viewfinder (hidden during loading/result states) -->
          @if (!cameraError() && state() !== 'loading') {
            <div class="relative w-full overflow-hidden rounded-2xl bg-black border border-white/[.08]"
                 style="aspect-ratio:4/3;max-height:18rem">

              <!-- Native video — @zxing/browser writes frames here -->
              <video #qrVideo id="qr-video" playsinline muted autoplay
                     [style.display]="scannerReady() ? 'block' : 'none'">
              </video>

              <!-- Init spinner -->
              @if (!scannerReady()) {
                <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span class="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#FF4433]
                               animate-spin"></span>
                  <span class="font-mono text-[.62rem] tracking-[.12em] uppercase text-white/40">
                    Starting camera…
                  </span>
                </div>
              }

              <!-- Viewfinder overlay -->
              @if (scannerReady()) {
                <div class="absolute inset-0 pointer-events-none flex items-center justify-center"
                     style="background:radial-gradient(ellipse 60% 55% at 50% 50%,
                              transparent 38%,rgba(0,0,0,.65) 100%)">
                  <div class="relative w-44 h-44">
                    <span class="scan-corner scan-corner--tl"></span>
                    <span class="scan-corner scan-corner--tr"></span>
                    <span class="scan-corner scan-corner--bl"></span>
                    <span class="scan-corner scan-corner--br"></span>
                    <span class="scan-line"></span>
                  </div>
                </div>
                <div class="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                  <span class="font-mono text-[.6rem] tracking-[.14em] uppercase
                               px-3 py-1 rounded-full bg-black/60 text-white/55
                               border border-white/[.08]">
                    Point camera at QR code
                  </span>
                </div>
              }
            </div>

            <!-- Camera selector (multi-camera devices) -->
            @if (availableCameras().length > 1) {
              <div class="flex items-center gap-3">
                <span class="font-mono text-[.6rem] tracking-[.1em] uppercase
                             text-white/35 flex-shrink-0">Camera</span>
                <select
                  class="flex-1 bg-[#0c0c10] border border-white/[.07] rounded-lg
                         text-[#F2EEE6] text-[.82rem] px-3 py-2 outline-none
                         focus:border-[#FF4433]/40"
                  (change)="onCameraChange($event)"
                >
                  @for (cam of availableCameras(); track cam.deviceId) {
                    <option [value]="cam.deviceId">
                      {{ cam.label || 'Camera ' + ($index + 1) }}
                    </option>
                  }
                </select>
              </div>
            }
          }

          <!-- API loading indicator (camera hidden, spinner shown) -->
          @if (state() === 'loading') {
            <div class="flex items-center gap-3 px-5 py-4 rounded-2xl
                        bg-[#0c0c10] border border-white/[.07]">
              <span class="w-5 h-5 rounded-full border-2 border-white/20 border-t-[#FF4433]
                           flex-shrink-0 animate-spin"></span>
              <div>
                <p class="text-[.85rem] font-semibold text-[#F2EEE6]">Verifying ticket…</p>
                <p class="font-mono text-[.6rem] tracking-wide text-white/35 mt-0.5 truncate max-w-[280px]">
                  {{ lastCheckedCode() }}
                </p>
              </div>
            </div>
          }
        </div>
      }

      <!-- Manual loading state -->
      @if (inputMode() === 'manual' && state() === 'loading') {
        <div class="animate-fade-up flex items-center gap-3 px-5 py-4 rounded-2xl
                    bg-[#0c0c10] border border-white/[.07]">
          <span class="w-5 h-5 rounded-full border-2 border-white/20 border-t-[#FF4433]
                       flex-shrink-0 animate-spin"></span>
          <p class="text-[.85rem] font-semibold text-[#F2EEE6]">Verifying…</p>
        </div>
      }

      <!-- ══════════════════════════════════════════ -->
      <!--  RESULT STATES                            -->
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
            Valid Ticket
          </div>

          <p class="text-[.88rem] font-semibold text-[#F2EEE6] m-0">
            This ticket has not been used. Allow entry.
          </p>

          <div class="rounded-[14px] overflow-hidden bg-[#0c0c10] border border-emerald-500/20">
            @if (result()!.eventTicket?.event?.event_img_url) {
              <div class="relative h-32 overflow-hidden">
                <img [src]="result()!.eventTicket!.event!.event_img_url"
                     [alt]="result()!.eventTicket?.event?.title"
                     class="w-full h-full object-cover"/>
                <div class="absolute inset-0"
                     style="background:linear-gradient(to top,rgba(12,12,16,.9) 0%,transparent 60%)">
                </div>
              </div>
            }
            <div class="p-4 flex flex-col gap-3">
              @if (result()!.eventTicket?.ticketTemplate?.tier !== undefined) {
                <div class="inline-flex items-center gap-1 w-fit px-2.5 py-0.5 rounded-full border
                            font-mono text-[.62rem] tracking-[.08em] uppercase font-semibold"
                     [style.color]="tierInfo(result()!.eventTicket!.ticketTemplate!.tier).color"
                     [style.border-color]="tierInfo(result()!.eventTicket!.ticketTemplate!.tier).color + '44'"
                     [style.background]="tierInfo(result()!.eventTicket!.ticketTemplate!.tier).color + '18'">
                  {{ tierInfo(result()!.eventTicket!.ticketTemplate!.tier).label }}
                  @if (result()!.eventTicket?.ticketTemplate?.name) {
                    · {{ result()!.eventTicket!.ticketTemplate!.name }}
                  }
                </div>
              }
              @if (result()!.eventTicket?.event?.title) {
                <h2 class="font-bebas text-[#F2EEE6] leading-tight m-0"
                    style="font-size:1.4rem;letter-spacing:.04em">
                  {{ result()!.eventTicket!.event!.title }}
                </h2>
              }
              <div class="flex flex-col gap-1.5">
                @if (result()!.eventTicket?.event?.start_time) {
                  <div class="flex items-center gap-2 text-[.78rem] text-white/50">
                    <svg class="w-3.5 h-3.5 flex-shrink-0 text-emerald-500/70" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    {{ fmtDate(result()!.eventTicket!.event!.start_time) }}
                  </div>
                }
                @if (result()!.eventTicket?.event?.city || result()!.eventTicket?.event?.nameOfPlace) {
                  <div class="flex items-center gap-2 text-[.78rem] text-white/50">
                    <svg class="w-3.5 h-3.5 flex-shrink-0 text-emerald-500/70" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    {{ result()!.eventTicket!.event!.nameOfPlace || result()!.eventTicket!.event!.city }}
                  </div>
                }
                <div class="flex items-center gap-2 text-[.78rem] text-white/50">
                  <svg class="w-3.5 h-3.5 flex-shrink-0 text-emerald-500/70" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                  </svg>
                  Purchased: {{ fmtDate(result()!.purchaseDate) }}
                </div>
              </div>
              <div class="flex items-center gap-1 justify-center py-0.5">
                <span class="w-1 h-1 rounded-full bg-emerald-500/30"></span>
                <span class="w-1 h-1 rounded-full bg-emerald-500/30"></span>
                <span class="w-1 h-1 rounded-full bg-emerald-500/30"></span>
              </div>
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p class="font-mono text-[.55rem] tracking-[.12em] uppercase text-white/30 mb-0.5">Ticket Code</p>
                  <code class="font-mono text-[.7rem] tracking-[.06em] text-emerald-400
                               bg-emerald-500/[.08] px-2 py-0.5 rounded-md break-all">
                    {{ result()!.ticketUniqueCode }}
                  </code>
                </div>
                @if (result()!.eventTicket?.actualPrice !== undefined) {
                  <div class="text-right">
                    <p class="font-mono text-[.55rem] tracking-[.12em] uppercase text-white/30 mb-0.5">Value</p>
                    <span class="font-mono text-[.88rem] font-semibold text-emerald-400">
                      @if (result()!.eventTicket!.actualPrice === 0) { FREE }
                      @else { EGP {{ result()!.eventTicket!.actualPrice | number:'1.0-2' }} }
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>

          <button class="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-[9px]
                         bg-transparent border border-emerald-500/35 text-emerald-400
                         text-[.8rem] font-semibold cursor-pointer
                         hover:bg-emerald-500/[.08] transition-colors"
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
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            Already Used
          </div>
          <p class="text-[.88rem] font-semibold text-[#F2EEE6] m-0">
            This ticket was already scanned — deny entry.
          </p>
          <div class="flex flex-col gap-2.5 bg-[#0c0c10] border border-amber-400/15 rounded-[12px] p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <span class="font-mono text-[.6rem] tracking-[.12em] uppercase text-white/40">Used at</span>
              <span class="text-[.82rem] font-semibold text-[#F2EEE6] text-right">{{ fmtDate(result()!.usedAt) }}</span>
            </div>
            @if (result()!.eventTicket?.event?.title) {
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <span class="font-mono text-[.6rem] tracking-[.12em] uppercase text-white/40">Event</span>
                <span class="text-[.82rem] font-semibold text-[#F2EEE6] text-right">{{ result()!.eventTicket!.event!.title }}</span>
              </div>
            }
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <span class="font-mono text-[.6rem] tracking-[.12em] uppercase text-white/40">Code</span>
              <code class="font-mono text-[.68rem] text-amber-400 bg-amber-400/[.08] px-2 py-0.5 rounded-md break-all">
                {{ result()!.ticketUniqueCode }}
              </code>
            </div>
          </div>
          <button class="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-[9px]
                         bg-transparent border border-amber-400/35 text-amber-400
                         text-[.8rem] font-semibold cursor-pointer
                         hover:bg-amber-400/[.08] transition-colors"
                  (click)="reset()">Verify another ticket</button>
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
            Invalid Ticket
          </div>
          <p class="text-[.88rem] font-semibold text-red-400/90 m-0">{{ errorMessage() }}</p>
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <span class="font-mono text-[.6rem] tracking-[.12em] uppercase text-white/40">Submitted code</span>
            <code class="font-mono text-[.7rem] text-red-400 bg-red-500/[.08] px-2 py-0.5 rounded-md break-all">
              {{ lastCheckedCode() }}
            </code>
          </div>
          <button class="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-[9px]
                         bg-transparent border border-red-500/35 text-red-400
                         text-[.8rem] font-semibold cursor-pointer
                         hover:bg-red-500/[.08] transition-colors"
                  (click)="reset()">Try a different code</button>
        </div>
      }

      <!-- ── EVENT NOT ACTIVE ── -->
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
            This ticket code is <strong>structurally valid</strong> — the event is outside its active window.
          </p>
          <div class="flex flex-col gap-2 bg-indigo-500/[.07] border border-indigo-400/20 rounded-[12px] p-4">
            <div class="flex items-start gap-2 text-[.82rem] font-semibold text-indigo-400">
              <svg class="w-3.5 h-3.5 flex-shrink-0 mt-px" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <path stroke-linecap="round" d="M12 8v4M12 16h.01"/>
              </svg>
              {{ errorMessage() }}
            </div>
            <p class="text-[.78rem] text-indigo-400/70 leading-relaxed m-0">
              Verification is only allowed while the event is running.
            </p>
          </div>
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <span class="font-mono text-[.6rem] tracking-[.12em] uppercase text-white/40">Submitted code</span>
            <code class="font-mono text-[.7rem] text-indigo-400 bg-indigo-500/[.08] px-2 py-0.5 rounded-md break-all">
              {{ lastCheckedCode() }}
            </code>
          </div>
          <button class="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-[9px]
                         bg-transparent border border-indigo-400/35 text-indigo-400
                         text-[.8rem] font-semibold cursor-pointer
                         hover:bg-indigo-400/[.08] transition-colors"
                  (click)="reset()">Try a different code</button>
        </div>
      }

    </div>
  </div>
  `,
})
export class VerifyTicketComponent implements OnDestroy {
  private readonly http     = inject(HttpClient);
  private readonly cdr      = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly BASE      = 'https://eventora.runasp.net/api';

  // Reference to the <video> element in the template
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('qrVideo');

  // ZXing reader + active scanner controls handle
  private reader:   BrowserQRCodeReader | null = null;
  private controls: IScannerControls    | null = null;

  // ── Component state ───────────────────────────────────────────────────
  state           = signal<ViewState>('idle');
  result          = signal<VerifyData | null>(null);
  errorMessage    = signal<string>('');
  lastCheckedCode = signal<string>('');
  inputError      = signal<boolean>(false);
  inputMode       = signal<InputMode>('manual');
  scannerReady    = signal(false);
  cameraError     = signal<string>('');
  availableCameras = signal<MediaDeviceInfo[]>([]);
  selectedDeviceId = signal<string | undefined>(undefined);

  codeInput = '';

  readonly fmtDate  = fmtDate;
  readonly tierInfo = tierInfo;

  // ── Mode switching ────────────────────────────────────────────────────

  setMode(mode: InputMode): void {
    if (this.inputMode() === mode) return;

    if (mode === 'manual') {
      this.stopScanner();
    }
    this.inputMode.set(mode);

    if (mode === 'scan') {
      this.cameraError.set('');
      this.scannerReady.set(false);
      // Give Angular one tick to render the <video> element before starting
      setTimeout(() => this.startScanner(), 80);
    }
  }

  // ── Scanner lifecycle ─────────────────────────────────────────────────

  private async startScanner(): Promise<void> {
    const videoEl = this.videoRef()?.nativeElement;
    if (!videoEl) {
      // Retry once more if the element isn't in the DOM yet
      setTimeout(() => this.startScanner(), 150);
      return;
    }

    try {
      this.reader = new BrowserQRCodeReader();

      // Enumerate cameras and prefer the rear-facing camera on mobile
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      this.availableCameras.set(devices);

      let deviceId: string | undefined = this.selectedDeviceId();
      if (!deviceId && devices.length > 0) {
        // Pick back-facing camera if available
        const rear = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment'),
        );
        deviceId = rear?.deviceId ?? devices[devices.length - 1].deviceId;
        this.selectedDeviceId.set(deviceId);
      }

      // Start continuous decode — fires callback every time a QR is detected
      this.controls = await this.reader.decodeFromVideoDevice(
        deviceId,
        videoEl,
        (result, err) => {
          if (result) {
            this.onScanSuccess(result.getText());
          }
          // NotFoundException fires constantly (no QR in frame) — suppress it
        },
      );

      this.scannerReady.set(true);
      this.cdr.markForCheck();

    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
        this.cameraError.set('Camera permission denied');
      } else if (msg.toLowerCase().includes('found') || msg.toLowerCase().includes('device')) {
        this.cameraError.set('No camera found on this device');
      } else {
        this.cameraError.set('Could not access camera');
      }
      this.cdr.markForCheck();
    }
  }

  private stopScanner(): void {
    try { this.controls?.stop(); } catch { /* ignore */ }
    this.controls = null;
    this.reader   = null;
    this.scannerReady.set(false);
  }

  // ── Scan result handler ───────────────────────────────────────────────

  private onScanSuccess(raw: string): void {
    // Stop the scanner immediately to prevent repeated fires for the same QR
    this.stopScanner();

    const uuid = extractUUID(raw);
    if (!uuid) {
      this.errorMessage.set('QR code does not contain a valid ticket UUID.');
      this.lastCheckedCode.set(raw);
      this.state.set('invalid');
      this.cdr.markForCheck();
      return;
    }

    this.codeInput = uuid;
    this.cdr.markForCheck();
    this.verify();
  }

  // ── Camera selector ───────────────────────────────────────────────────

  onCameraChange(e: Event): void {
    const id = (e.target as HTMLSelectElement).value;
    this.selectedDeviceId.set(id);
    this.stopScanner();
    this.scannerReady.set(false);
    setTimeout(() => this.startScanner(), 80);
  }

  // ── Manual input ──────────────────────────────────────────────────────

  canVerify(): boolean {
    return (
      this.state() !== 'loading' &&
      this.codeInput.trim().length > 0 &&
      !this.inputError()
    );
  }

  onInputChange(): void {
    const v = this.codeInput.trim();
    this.inputError.set(v.length >= 36 && !UUID_RE.test(v));
  }

  onPaste(e: ClipboardEvent): void {
    const pasted  = e.clipboardData?.getData('text') ?? '';
    const cleaned = pasted.trim();
    if (cleaned !== pasted) {
      e.preventDefault();
      this.codeInput = cleaned;
      this.onInputChange();
    }
  }

  // ── API call ──────────────────────────────────────────────────────────

  verify(): void {
    const code = this.codeInput.trim();
    if (!code || this.state() === 'loading') return;

    if (!UUID_RE.test(code)) {
      this.inputError.set(true);
      return;
    }

    this.lastCheckedCode.set(code);
    this.state.set('loading');
    this.result.set(null);
    this.cdr.markForCheck();

    this.http
      .get<VerifyResponse>(`${this.BASE}/Ticket/Verify/${code}`)
      .pipe(
        catchError(err => {
          const msg =
            err?.error?.message ||
            err?.error?.errors?.[0] ||
            'Ticket not found or invalid.';
          return of({ data: null, success: false, message: msg, errors: [] } as VerifyResponse);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(res => {
        if (res.success && res.data) {
          this.result.set(res.data);
          this.state.set(res.data.isUsed ? 'used' : 'valid');
        } else {
          const msg = res.message || '';
          if (msg.toLowerCase().includes('not active') || msg.toLowerCase().includes('event not')) {
            this.errorMessage.set(msg);
            this.state.set('inactive');
          } else {
            this.errorMessage.set(msg || 'Ticket not found or does not exist.');
            this.state.set('invalid');
          }
        }
        this.cdr.markForCheck();
      });
  }

  // ── Reset ─────────────────────────────────────────────────────────────

  reset(): void {
    this.codeInput = '';
    this.inputError.set(false);
    this.result.set(null);
    this.errorMessage.set('');
    this.lastCheckedCode.set('');
    this.state.set('idle');

    if (this.inputMode() === 'scan') {
      this.scannerReady.set(false);
      setTimeout(() => this.startScanner(), 80);
    }
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.stopScanner();
    this.destroy$.next();
    this.destroy$.complete();
  }
}