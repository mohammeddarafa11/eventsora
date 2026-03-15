// src/app/features/tickets/verify-ticket/verify-ticket.ts
//
// Organizer-facing ticket verification page.
// Route: /verify-ticket  (child of the organizer dashboard shell)
//
// Flow:
//  1. Organizer pastes or types a ticket UUID
//  2. GET /api/Ticket/Verify/{code} is called
//  3. One of four states is shown:
//       idle      – input form
//       loading   – spinner
//       valid     – green: ticket is unused, shows booking details
//       used      – amber: ticket was already scanned, shows when
//       invalid   – red:   API returned 400/error (event not active, not found…)
//
import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule }                          from '@angular/common';
import { FormsModule }                           from '@angular/forms';
import { HttpClient }                            from '@angular/common/http';
import { Subject }                               from 'rxjs';
import { takeUntil, catchError }                 from 'rxjs/operators';
import { of }                                    from 'rxjs';

// ── API response shapes ───────────────────────────────────────────────────────

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
      title?:      string;
      start_time?: string;
      end_time?:   string;
      city?:       string;
      nameOfPlace?: string;
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

function tierInfo(t?: number) {
  return TIER_LABELS[t ?? 0] ?? TIER_LABELS[0];
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-EG', {
    weekday: 'short', year: 'numeric',
    month: 'short',   day: 'numeric',
    hour: '2-digit',  minute: '2-digit',
  });
}

// UUID validation regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 'inactive' = ticket is real but event window is outside now (before start or after end)
type ViewState = 'idle' | 'loading' | 'valid' | 'used' | 'invalid' | 'inactive';

@Component({
  selector:    'app-verify-ticket',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <div class="vt-root">
      <div class="vt-inner">

        <!-- ── PAGE HEADER ── -->
        <div class="vt-page-header">
          <div class="vt-kicker">
            <span class="vt-kicker__dot"></span>
            Ticket Verification
          </div>
          <h1 class="vt-title">Verify <span class="vt-accent">Ticket</span></h1>
          <p class="vt-desc">Paste or type a ticket code to check its validity at entry.</p>
        </div>

        <!-- ── INPUT CARD ── -->
        <div class="vt-input-card">
          <div class="vt-input-card__header">
            <div class="vt-input-card__icon">
              <!-- QR / ticket icon -->
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14
                         a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
              </svg>
            </div>
            <div>
              <p class="vt-input-card__label">Ticket Code</p>
              <p class="vt-input-card__hint">UUID format — e.g. f0f0bf50-b49f-4123-a7f2-5e912d87c732</p>
            </div>
          </div>

          <div class="vt-input-row">
            <input
              class="vt-input"
              type="text"
              [(ngModel)]="codeInput"
              (ngModelChange)="onInputChange()"
              (keydown.enter)="verify()"
              (paste)="onPaste($event)"
              placeholder="Paste or type ticket UUID…"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              maxlength="36"
              [class.vt-input--error]="inputError()"
            />
            <button
              class="vt-verify-btn"
              [disabled]="!canVerify()"
              (click)="verify()"
            >
              @if (state() === 'loading') {
                <span class="vt-spin"></span>
                Checking…
              } @else {
                <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Verify
              }
            </button>
          </div>

          @if (inputError()) {
            <p class="vt-input-error">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <path stroke-linecap="round" d="M12 8v4M12 16h.01"/>
              </svg>
              Not a valid UUID format
            </p>
          }

          <!-- Quick paste hint -->
          @if (state() === 'idle' && !codeInput) {
            <p class="vt-paste-hint">
              <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              Tip: Press Ctrl+V / Cmd+V to paste a code directly
            </p>
          }
        </div>

        <!-- ══════════════════════════════════════════ -->
        <!--  RESULT STATES                            -->
        <!-- ══════════════════════════════════════════ -->

        <!-- ── VALID ── -->
        @if (state() === 'valid' && result()) {
          <div class="vt-result vt-result--valid" role="region" aria-label="Valid ticket">
            <div class="vt-result__badge vt-result__badge--valid">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Valid Ticket
            </div>
            <p class="vt-result__status-msg">This ticket has not been used. Allow entry.</p>

            <!-- Ticket details card -->
            <div class="vt-ticket-card">

              <!-- Event image strip -->
              @if (result()!.eventTicket?.event?.event_img_url) {
                <div class="vt-ticket-card__img-wrap">
                  <img [src]="result()!.eventTicket!.event!.event_img_url"
                       [alt]="result()!.eventTicket?.event?.title"
                       class="vt-ticket-card__img"/>
                  <div class="vt-ticket-card__img-scrim"></div>
                </div>
              }

              <div class="vt-ticket-card__body">

                <!-- Tier badge -->
                @if (result()!.eventTicket?.ticketTemplate?.tier !== undefined) {
                  <div class="vt-tier-badge"
                       [style.color]="tierInfo(result()!.eventTicket!.ticketTemplate!.tier).color"
                       [style.border-color]="tierInfo(result()!.eventTicket!.ticketTemplate!.tier).color + '44'">
                    {{ tierInfo(result()!.eventTicket!.ticketTemplate!.tier).label }}
                    @if (result()!.eventTicket?.ticketTemplate?.name) {
                      · {{ result()!.eventTicket!.ticketTemplate!.name }}
                    }
                  </div>
                }

                <!-- Event title -->
                @if (result()!.eventTicket?.event?.title) {
                  <h2 class="vt-ticket-card__event-title">{{ result()!.eventTicket!.event!.title }}</h2>
                }

                <div class="vt-ticket-card__meta">
                  <!-- Date -->
                  @if (result()!.eventTicket?.event?.start_time) {
                    <div class="vt-meta-row">
                      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      <span>{{ fmtDate(result()!.eventTicket!.event!.start_time) }}</span>
                    </div>
                  }
                  <!-- Location -->
                  @if (result()!.eventTicket?.event?.city || result()!.eventTicket?.event?.nameOfPlace) {
                    <div class="vt-meta-row">
                      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                      <span>{{ result()!.eventTicket!.event!.nameOfPlace || result()!.eventTicket!.event!.city }}</span>
                    </div>
                  }
                  <!-- Purchase date -->
                  <div class="vt-meta-row">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round"
                            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14
                               a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                    </svg>
                    <span>Purchased: {{ fmtDate(result()!.purchaseDate) }}</span>
                  </div>
                </div>

                <!-- Divider + code -->
                <div class="vt-ticket-card__divider">
                  <span class="vt-ticket-card__divider-dot"></span>
                  <span class="vt-ticket-card__divider-dot"></span>
                  <span class="vt-ticket-card__divider-dot"></span>
                </div>

                <div class="vt-ticket-card__code-row">
                  <span class="vt-ticket-card__code-label">Ticket Code</span>
                  <code class="vt-ticket-card__code">{{ result()!.ticketUniqueCode }}</code>
                </div>

                @if (result()!.eventTicket?.actualPrice !== undefined) {
                  <div class="vt-ticket-card__price-row">
                    <span class="vt-ticket-card__code-label">Ticket Value</span>
                    <span class="vt-ticket-card__price">
                      @if (result()!.eventTicket!.actualPrice === 0) { FREE }
                      @else { EGP {{ result()!.eventTicket!.actualPrice | number:'1.0-2' }} }
                    </span>
                  </div>
                }
              </div>
            </div>

            <button class="vt-reset-btn" (click)="reset()">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Verify another ticket
            </button>
          </div>
        }

        <!-- ── ALREADY USED ── -->
        @if (state() === 'used' && result()) {
          <div class="vt-result vt-result--used" role="region" aria-label="Already used ticket">
            <div class="vt-result__badge vt-result__badge--used">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              Already Used
            </div>
            <p class="vt-result__status-msg">This ticket was already scanned — deny entry.</p>

            <div class="vt-used-details">
              <div class="vt-used-row">
                <span class="vt-used-row__label">Used at</span>
                <span class="vt-used-row__value">{{ fmtDate(result()!.usedAt) }}</span>
              </div>
              @if (result()!.eventTicket?.event?.title) {
                <div class="vt-used-row">
                  <span class="vt-used-row__label">Event</span>
                  <span class="vt-used-row__value">{{ result()!.eventTicket!.event!.title }}</span>
                </div>
              }
              <div class="vt-used-row">
                <span class="vt-used-row__label">Code</span>
                <code class="vt-used-row__code">{{ result()!.ticketUniqueCode }}</code>
              </div>
            </div>

            <button class="vt-reset-btn vt-reset-btn--used" (click)="reset()">
              Verify another ticket
            </button>
          </div>
        }

        <!-- ── INVALID ── -->
        @if (state() === 'invalid') {
          <div class="vt-result vt-result--invalid" role="region" aria-label="Invalid ticket">
            <div class="vt-result__badge vt-result__badge--invalid">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 9l-6 6M9 9l6 6"/>
              </svg>
              Invalid Ticket
            </div>
            <p class="vt-result__status-msg vt-result__status-msg--invalid">{{ errorMessage() }}</p>

            <div class="vt-invalid-code-row">
              <span class="vt-invalid-code-label">Submitted code</span>
              <code class="vt-invalid-code">{{ lastCheckedCode() }}</code>
            </div>

            <button class="vt-reset-btn vt-reset-btn--invalid" (click)="reset()">
              Try a different code
            </button>
          </div>
        }

        <!-- ── EVENT NOT ACTIVE ── -->
        @if (state() === 'inactive') {
          <div class="vt-result vt-result--inactive" role="region" aria-label="Event not active">
            <div class="vt-result__badge vt-result__badge--inactive">
              <!-- clock icon -->
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/>
              </svg>
              Event Not Active
            </div>

            <p class="vt-result__status-msg">
              This ticket code is <strong>structurally valid</strong> — the event is simply outside its active window (not yet started, or already ended).
            </p>

            <div class="vt-inactive-box">
              <div class="vt-inactive-box__row">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/>
                  <path stroke-linecap="round" d="M12 8v4M12 16h.01"/>
                </svg>
                <span>{{ errorMessage() }}</span>
              </div>
              <div class="vt-inactive-box__hint">
                Verification is only allowed while the event is running. Check the event's start and end date/time, then retry during the active window.
              </div>
            </div>

            <div class="vt-invalid-code-row">
              <span class="vt-invalid-code-label">Submitted code</span>
              <code class="vt-inactive-code">{{ lastCheckedCode() }}</code>
            </div>

            <button class="vt-reset-btn vt-reset-btn--inactive" (click)="reset()">
              Try a different code
            </button>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    :host {
      --coral:  #FF4433;
      --gold:   #F0B429;
      --green:  #10b981;
      --amber:  #f59e0b;
      --red:    #ef4444;
      --purple: #a78bfa;
      --bg:     #060608;
      --bg2:    #0c0c10;
      --bg3:    #111116;
      --text:   #F2EEE6;
      --muted:  rgba(242,238,230,.42);
      --bdr:    rgba(242,238,230,.07);
      --bdrhi:  rgba(242,238,230,.13);
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: block;
    }
    @keyframes fadeUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none} }
    @keyframes spin    { to{transform:rotate(360deg)} }
    @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.95)} }
    @keyframes shimmer { from{background-position:-400px 0}to{background-position:400px 0} }

    /* ── Root ── */
    .vt-root {
      min-height:100%; background:var(--bg); color:var(--text);
      padding:2.5rem 1.5rem;
    }
    .vt-inner {
      max-width:600px; margin:0 auto;
      display:flex; flex-direction:column; gap:1.75rem;
    }

    /* ── Page header ── */
    .vt-page-header { display:flex;flex-direction:column;gap:.5rem; }
    .vt-kicker {
      display:inline-flex;align-items:center;gap:7px;
      font-family:'DM Mono',monospace;font-size:.66rem;
      letter-spacing:.14em;text-transform:uppercase;color:var(--coral);
    }
    .vt-kicker__dot { width:5px;height:5px;border-radius:50%;background:var(--coral); }
    .vt-title {
      font-family:'Bebas Neue',sans-serif;font-size:clamp(2rem,5vw,2.8rem);
      letter-spacing:.04em;color:var(--text);margin:0;line-height:1;
    }
    .vt-accent { color:var(--coral); }
    .vt-desc { font-size:.85rem;color:var(--muted);font-weight:300;line-height:1.65;margin:0; }

    /* ── Input card ── */
    .vt-input-card {
      background:var(--bg2);border:1px solid var(--bdr);border-radius:18px;
      padding:1.4rem;display:flex;flex-direction:column;gap:1rem;
      animation:fadeUp .35s cubic-bezier(.22,1,.36,1) both;
    }
    .vt-input-card__header { display:flex;align-items:flex-start;gap:.85rem; }
    .vt-input-card__icon {
      width:40px;height:40px;border-radius:10px;flex-shrink:0;
      background:rgba(255,68,51,.08);border:1px solid rgba(255,68,51,.18);
      color:var(--coral);display:flex;align-items:center;justify-content:center;
    }
    .vt-input-card__label { font-size:.88rem;font-weight:700;color:var(--text);margin-bottom:2px; }
    .vt-input-card__hint  { font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.06em;color:var(--muted); }

    .vt-input-row { display:flex;gap:.65rem;align-items:stretch; }
    .vt-input {
      flex:1;background:var(--bg3);border:1.5px solid var(--bdr);
      border-radius:11px;color:var(--text);
      font-family:'DM Mono',monospace;font-size:.82rem;letter-spacing:.04em;
      padding:.75rem 1rem;outline:none;
      transition:border-color .2s,box-shadow .2s;
    }
    .vt-input::placeholder { color:var(--muted); }
    .vt-input:focus {
      border-color:rgba(255,68,51,.5);
      box-shadow:0 0 0 3px rgba(255,68,51,.08);
    }
    .vt-input--error { border-color:rgba(239,68,68,.5)!important; }
    .vt-input-error {
      display:flex;align-items:center;gap:5px;
      font-size:.72rem;color:var(--red);margin-top:-.25rem;
    }
    .vt-paste-hint {
      display:flex;align-items:center;gap:5px;
      font-size:.72rem;color:var(--muted);margin-top:-.25rem;
    }

    .vt-verify-btn {
      flex-shrink:0;display:inline-flex;align-items:center;gap:.5rem;
      padding:.75rem 1.35rem;border-radius:11px;border:none;
      background:var(--coral);color:#fff;
      font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:.88rem;
      cursor:pointer;transition:box-shadow .25s,transform .18s,opacity .2s;
      box-shadow:0 0 24px rgba(255,68,51,.2);white-space:nowrap;
    }
    .vt-verify-btn:hover:not(:disabled) { box-shadow:0 0 44px rgba(255,68,51,.45);transform:translateY(-1px); }
    .vt-verify-btn:disabled { opacity:.35;cursor:not-allowed;transform:none;box-shadow:none; }
    .vt-spin {
      width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;
      border-radius:50%;animation:spin .7s linear infinite;display:inline-block;
    }

    /* ── Result shared ── */
    .vt-result {
      border-radius:18px;padding:1.5rem;
      display:flex;flex-direction:column;gap:1.1rem;
      animation:fadeUp .4s cubic-bezier(.22,1,.36,1) both;
    }
    .vt-result--valid   { background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.22); }
    .vt-result--used    { background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.22); }
    .vt-result--invalid { background:rgba(239,68,68,.06); border:1px solid rgba(239,68,68,.22);  }

    /* ── Inactive (event outside window) ── */
    .vt-result--inactive { background:rgba(99,102,241,.06); border:1px solid rgba(99,102,241,.22); }
    .vt-result__badge--inactive {
      background:rgba(99,102,241,.14); color:#818cf8; border:1px solid rgba(99,102,241,.3);
    }
    .vt-inactive-box {
      background:rgba(99,102,241,.07); border:1px solid rgba(99,102,241,.18);
      border-radius:12px; padding:1rem 1.1rem;
      display:flex; flex-direction:column; gap:.6rem;
    }
    .vt-inactive-box__row {
      display:flex; align-items:flex-start; gap:.5rem;
      font-size:.82rem; font-weight:600; color:#818cf8;
    }
    .vt-inactive-box__row svg { flex-shrink:0; margin-top:1px; color:#818cf8; }
    .vt-inactive-box__hint {
      font-size:.78rem; color:rgba(99,102,241,.7); line-height:1.6; font-weight:400;
    }
    .vt-inactive-code {
      font-family:'DM Mono',monospace; font-size:.7rem; color:#818cf8;
      background:rgba(99,102,241,.08); padding:3px 8px; border-radius:6px; word-break:break-all;
    }
    .vt-reset-btn--inactive { border-color:rgba(99,102,241,.35); color:#818cf8; }
    .vt-reset-btn--inactive:hover { background:rgba(99,102,241,.08); }

    .vt-result__badge {
      display:inline-flex;align-items:center;gap:.55rem;width:fit-content;
      padding:.5rem 1rem;border-radius:100px;
      font-family:'DM Mono',monospace;font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
    }
    .vt-result__badge--valid   { background:rgba(16,185,129,.14);color:var(--green);border:1px solid rgba(16,185,129,.3); }
    .vt-result__badge--used    { background:rgba(245,158,11,.14);color:var(--amber);border:1px solid rgba(245,158,11,.3); }
    .vt-result__badge--invalid { background:rgba(239,68,68,.14); color:var(--red);  border:1px solid rgba(239,68,68,.3);  }

    .vt-result__status-msg {
      font-size:.88rem;font-weight:600;color:var(--text);margin:0;line-height:1.5;
    }
    .vt-result__status-msg--invalid { color:rgba(239,68,68,.9); }

    /* ── Ticket card (valid state) ── */
    .vt-ticket-card {
      background:var(--bg2);border:1px solid rgba(16,185,129,.2);border-radius:14px;overflow:hidden;
    }
    .vt-ticket-card__img-wrap { position:relative;height:130px;overflow:hidden; }
    .vt-ticket-card__img { width:100%;height:100%;object-fit:cover; }
    .vt-ticket-card__img-scrim {
      position:absolute;inset:0;
      background:linear-gradient(to top,rgba(12,12,16,.9) 0%,transparent 60%);
    }
    .vt-ticket-card__body { padding:1.1rem 1.25rem;display:flex;flex-direction:column;gap:.75rem; }

    .vt-tier-badge {
      display:inline-flex;align-items:center;gap:4px;width:fit-content;
      padding:3px 10px;border-radius:100px;border:1px solid transparent;
      font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;font-weight:600;
    }
    .vt-ticket-card__event-title {
      font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:.04em;
      color:var(--text);margin:0;line-height:1.1;
    }
    .vt-ticket-card__meta { display:flex;flex-direction:column;gap:.45rem; }
    .vt-meta-row {
      display:flex;align-items:center;gap:.5rem;
      font-size:.78rem;color:var(--muted);
    }
    .vt-meta-row svg { flex-shrink:0;color:var(--green);opacity:.7; }

    .vt-ticket-card__divider {
      display:flex;gap:4px;align-items:center;justify-content:center;padding:.25rem 0;
    }
    .vt-ticket-card__divider-dot {
      width:4px;height:4px;border-radius:50%;background:rgba(16,185,129,.3);
    }

    .vt-ticket-card__code-row,
    .vt-ticket-card__price-row {
      display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap;
    }
    .vt-ticket-card__code-label {
      font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.12em;
      text-transform:uppercase;color:var(--muted);
    }
    .vt-ticket-card__code {
      font-family:'DM Mono',monospace;font-size:.7rem;letter-spacing:.06em;
      color:var(--green);background:rgba(16,185,129,.08);
      padding:3px 8px;border-radius:6px;word-break:break-all;
    }
    .vt-ticket-card__price {
      font-family:'DM Mono',monospace;font-size:.88rem;font-weight:600;color:var(--green);
    }

    /* ── Already used details ── */
    .vt-used-details {
      background:var(--bg2);border:1px solid rgba(245,158,11,.15);
      border-radius:12px;padding:1rem 1.1rem;
      display:flex;flex-direction:column;gap:.6rem;
    }
    .vt-used-row { display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;flex-wrap:wrap; }
    .vt-used-row__label {
      font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.12em;
      text-transform:uppercase;color:var(--muted);flex-shrink:0;
    }
    .vt-used-row__value { font-size:.82rem;font-weight:600;color:var(--text);text-align:right; }
    .vt-used-row__code  {
      font-family:'DM Mono',monospace;font-size:.68rem;color:var(--amber);
      background:rgba(245,158,11,.08);padding:3px 7px;border-radius:5px;word-break:break-all;
    }

    /* ── Invalid code display ── */
    .vt-invalid-code-row { display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap; }
    .vt-invalid-code-label {
      font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.12em;
      text-transform:uppercase;color:var(--muted);
    }
    .vt-invalid-code {
      font-family:'DM Mono',monospace;font-size:.7rem;color:var(--red);
      background:rgba(239,68,68,.08);padding:3px 8px;border-radius:6px;word-break:break-all;
    }

    /* ── Reset button ── */
    .vt-reset-btn {
      display:inline-flex;align-items:center;gap:.5rem;width:fit-content;
      background:none;border:1px solid rgba(16,185,129,.35);border-radius:9px;
      padding:.5rem 1rem;color:var(--green);
      font-family:'Plus Jakarta Sans',sans-serif;font-size:.8rem;font-weight:600;
      cursor:pointer;transition:all .2s;
    }
    .vt-reset-btn:hover { background:rgba(16,185,129,.08); }
    .vt-reset-btn--used {
      border-color:rgba(245,158,11,.35);color:var(--amber);
    }
    .vt-reset-btn--used:hover { background:rgba(245,158,11,.08); }
    .vt-reset-btn--invalid {
      border-color:rgba(239,68,68,.35);color:var(--red);
    }
    .vt-reset-btn--invalid:hover { background:rgba(239,68,68,.08); }

    @media(max-width:480px){
      .vt-root    { padding:1.5rem 1rem; }
      .vt-input-row { flex-direction:column; }
      .vt-verify-btn { width:100%;justify-content:center; }
    }
  `],
})
export class VerifyTicketComponent implements OnDestroy {
  private readonly http     = inject(HttpClient);
  private readonly destroy$ = new Subject<void>();
  private readonly BASE      = 'https://eventora.runasp.net/api';

  // ── State ────────────────────────────────────────────────────────────
  state           = signal<ViewState>('idle');
  result          = signal<VerifyData | null>(null);
  errorMessage    = signal<string>('');
  lastCheckedCode = signal<string>('');
  inputError      = signal<boolean>(false);

  codeInput = '';

  // ── Helpers exposed to template ──────────────────────────────────────
  readonly fmtDate  = fmtDate;
  readonly tierInfo = tierInfo;

  canVerify(): boolean {
    return (
      this.state() !== 'loading' &&
      this.codeInput.trim().length > 0 &&
      !this.inputError()
    );
  }

  // ── Input handling ───────────────────────────────────────────────────

  onInputChange(): void {
    const v = this.codeInput.trim();
    // Only show error once user has typed enough to have a full UUID
    this.inputError.set(v.length >= 36 && !UUID_RE.test(v));
  }

  onPaste(e: ClipboardEvent): void {
    // Auto-trim whitespace from paste
    const pasted = e.clipboardData?.getData('text') ?? '';
    const cleaned = pasted.trim();
    if (cleaned !== pasted) {
      e.preventDefault();
      this.codeInput = cleaned;
      this.onInputChange();
    }
  }

  // ── Verify ───────────────────────────────────────────────────────────

  verify(): void {
    const code = this.codeInput.trim();
    if (!code || this.state() === 'loading') return;

    // Validate UUID format before hitting the API
    if (!UUID_RE.test(code)) {
      this.inputError.set(true);
      return;
    }

    this.lastCheckedCode.set(code);
    this.state.set('loading');
    this.result.set(null);

    this.http
      .get<VerifyResponse>(`${this.BASE}/Ticket/Verify/${code}`)
      .pipe(
        catchError(err => {
          // HTTP 400/404/etc — extract message from error body
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
          // Determine if already used or fresh
          if (res.data.isUsed) {
            this.result.set(res.data);
            this.state.set('used');
          } else {
            this.result.set(res.data);
            this.state.set('valid');
          }
        } else {
          const msg = res.message || '';
          // "Event not active" means the ticket is real but the event window
          // is closed (event hasn't started yet, or has already ended).
          // This is NOT a bad ticket — show a distinct neutral state.
          if (msg.toLowerCase().includes('not active') || msg.toLowerCase().includes('event not')) {
            this.errorMessage.set(msg);
            this.state.set('inactive');
          } else {
            this.errorMessage.set(msg || 'Ticket not found or does not exist.');
            this.state.set('invalid');
          }
        }
      });
  }

  reset(): void {
    this.codeInput = '';
    this.inputError.set(false);
    this.result.set(null);
    this.errorMessage.set('');
    this.lastCheckedCode.set('');
    this.state.set('idle');
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}