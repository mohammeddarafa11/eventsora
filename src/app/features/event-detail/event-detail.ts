// src/app/features/event-detail/event-detail.ts
//
// Additions vs original:
//  Flow A – Follow Organizer button in the meta section
//  Flow B – Post-booking "follow organizer" prompt
//
import {
  Component, inject, signal, computed, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { EventService } from '@core/services/event.service';
import { TicketService, EventTicket, TicketTier } from '@core/services/ticket.service';
import { ZardIconComponent } from '@shared/components/icon/icon.component';
import { ZARD_ICONS } from '@shared/components/icon/icons';
import { FollowService } from '@core/services/follow.service';
import { Event as EsEvent } from '@core/models/event.model';

type ZardIcon = keyof typeof ZARD_ICONS;

function fmt(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-EG', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}
function fmtTime(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
}

interface TierMeta {
  label: string; icon: ZardIcon;
  accent: string; accentDim: string; accentBdr: string;
}

const TIER_META: Record<number, TierMeta> = {
  [TicketTier.Standard]: {
    label:'Standard', icon:'ticket',
    accent:'#10b981', accentDim:'rgba(16,185,129,.1)', accentBdr:'rgba(16,185,129,.22)',
  },
  [TicketTier.VIP]: {
    label:'VIP', icon:'zap',
    accent:'#F0B429', accentDim:'rgba(240,180,41,.1)', accentBdr:'rgba(240,180,41,.22)',
  },
  [TicketTier.Premium]: {
    label:'Premium', icon:'badge-check',
    accent:'#a78bfa', accentDim:'rgba(167,139,250,.1)', accentBdr:'rgba(167,139,250,.22)',
  },
};

interface TierGroup { meta: TierMeta; tickets: EventTicket[]; }

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, UpperCasePipe, ZardIconComponent],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <div class="ed-root">

      <button class="ed-back" (click)="goBack()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12"/>
        </svg>
        Back
      </button>

      @if (loading()) {
        <div class="ed-skel">
          <div class="ed-skel__hero"></div>
          <div class="ed-skel__body">
            <div class="ed-skel__line ed-skel__line--xl"></div>
            <div class="ed-skel__line ed-skel__line--md"></div>
            <div class="ed-skel__line ed-skel__line--sm"></div>
          </div>
        </div>
      } @else if (error()) {
        <div class="ed-empty">
          <div class="ed-empty__icon">!</div>
          <p class="ed-empty__title">Couldn't load event</p>
          <button class="ed-btn" (click)="load()">Try again</button>
        </div>
      } @else if (event()) {

        <div class="ed-hero">
          @if (event()!.event_img_url) {
            <img [src]="event()!.event_img_url" [alt]="event()!.title" class="ed-hero__img"/>
          } @else {
            <div class="ed-hero__placeholder">
              <svg width="56" height="56" fill="none" stroke="currentColor" stroke-width=".8" viewBox="0 0 24 24" opacity=".2">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M3 7a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 3v4M8 3v4M3 11h18"/>
              </svg>
            </div>
          }
          @if (event()!.category?.name) {
            <span class="ed-cat-badge">{{ event()!.category?.name }}</span>
          }
        </div>

        <div class="ed-content">

          <!-- ── INFO SECTION ── -->
          <section class="ed-info">
            <h1 class="ed-title">{{ event()!.title }}</h1>

            <div class="ed-meta-row">

              <!-- Date -->
              @if (event()!.start_time) {
                <div class="ed-meta-item">
                  <div class="ed-meta-item__icon">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <div>
                    <div class="ed-meta-item__label">Date &amp; Time</div>
                    <div class="ed-meta-item__value">{{ fmt(event()!.start_time) }}</div>
                    <div class="ed-meta-item__sub">
                      {{ fmtTime(event()!.start_time) }}
                      @if (event()!.end_time) { – {{ fmtTime(event()!.end_time) }} }
                    </div>
                  </div>
                </div>
              }

              <!-- Location -->
              @if (event()!.city || event()!.nameOfPlace) {
                <div class="ed-meta-item">
                  <div class="ed-meta-item__icon">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  </div>
                  <div>
                    <div class="ed-meta-item__label">Location</div>
                    <div class="ed-meta-item__value">{{ event()!.nameOfPlace || event()!.city }}</div>
                    @if (event()!.nameOfPlace && event()!.city) {
                      <div class="ed-meta-item__sub">{{ event()!.city }}</div>
                    }
                  </div>
                </div>
              }

              <!-- ══ ORGANISER + FOLLOW BUTTON (Flow A) ══ -->
              @if (event()!.organization?.name) {
                <div class="ed-meta-item">
                  <div class="ed-meta-item__icon">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round"
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                    </svg>
                  </div>
                  <div class="ed-org-row">
                    <div>
                      <div class="ed-meta-item__label">Organiser</div>
                      <div class="ed-meta-item__value">{{ event()!.organization?.name }}</div>
                    </div>
                    <!-- Follow / Following button -->
                    <button
                      class="ed-follow-btn"
                      [class.ed-follow-btn--on]="isFollowingOrg()"
                      (click)="toggleFollow()"
                      [attr.aria-label]="isFollowingOrg() ? 'Unfollow ' + event()!.organization?.name : 'Follow ' + event()!.organization?.name"
                    >
                      @if (isFollowingOrg()) {
                        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.8" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                        Following
                      } @else {
                        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.8" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                        Follow Organizer
                      }
                    </button>
                  </div>
                </div>
              }

            </div>

            <!-- Description -->
            @if (event()!.description) {
              <div>
                <h2 class="ed-section__title">About this event</h2>
                <p class="ed-desc">{{ event()!.description }}</p>
              </div>
            }
          </section>

          <!-- ── TICKET PANEL ── -->
          <aside class="ed-ticket-panel">

            <div class="ed-panel-header">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
              </svg>
              TICKETS
            </div>

            @if (ticketsLoading()) {
              <div class="ed-skel-wrap">
                @for (n of [0,1,2]; track n) {
                  <div class="ed-skel-item" [style.animation-delay]="n*80+'ms'"></div>
                }
              </div>

            } @else if (tickets().length === 0) {
              <div class="ed-no-tkt">
                <span></span>
                <p>No tickets available.</p>
              </div>

            } @else {
              <div class="ed-groups">
                @for (group of tierGroups(); track group.meta.label) {
                  <div class="ed-tier-row"
                       [style.background]="group.meta.accentDim"
                       [style.border-color]="group.meta.accentBdr">
                    <div z-icon [zType]="group.meta.icon" class="ed-tier-row__icon"></div>
                    <span class="ed-tier-row__label" [style.color]="group.meta.accent">
                      {{ group.meta.label | uppercase }}
                    </span>
                    <span class="ed-tier-row__count">
                      {{ group.tickets.length }} OPTION{{ group.tickets.length !== 1 ? 'S' : '' }}
                    </span>
                  </div>

                  @for (t of group.tickets; track t.id) {
                    <button
                      class="ed-tkt"
                      [class.ed-tkt--selected]="selectedTicketId() === t.id"
                      [class.ed-tkt--sold-out]="isSoldOut(t)"
                      [disabled]="isSoldOut(t)"
                      [style.--a]="group.meta.accent"
                      [style.--a-dim]="group.meta.accentDim"
                      [style.--a-bdr]="group.meta.accentBdr"
                      (click)="selectTicket(t)"
                    >
                      <div class="ed-tkt__bar" [style.background]="group.meta.accent"></div>
                      <div class="ed-tkt__body">
                        <div class="ed-tkt__left">
                          <div class="ed-tkt__name">{{ t.ticketTemplate?.name || (group.meta.label + ' Ticket') }}</div>
                          @if (t.ticketTemplate?.description) {
                            <div class="ed-tkt__desc">{{ t.ticketTemplate?.description }}</div>
                          }
                          <div class="ed-tkt__avail">
                            @if (isSoldOut(t)) {
                              <span class="ed-badge ed-badge--sold">SOLD OUT</span>
                            } @else {
                              <span class="ed-badge"
                                    [style.background]="group.meta.accentDim"
                                    [style.border-color]="group.meta.accentBdr"
                                    [style.color]="group.meta.accent">
                                {{ t.totalQuantity - t.soldQuantity }} LEFT
                              </span>
                            }
                          </div>
                        </div>
                        <div class="ed-tkt__price">
                          @if (t.actualPrice === 0) {
                            <span class="ed-price--free" [style.color]="group.meta.accent">FREE</span>
                          } @else {
                            <span class="ed-price--amt" [style.color]="group.meta.accent">{{ t.actualPrice | number:'1.0-0' }}</span>
                            <span class="ed-price--cur">EGP</span>
                          }
                        </div>
                      </div>
                      @if (selectedTicketId() === t.id) {
                        <div class="ed-tkt__check" [style.background]="group.meta.accent">
                          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                          </svg>
                        </div>
                      }
                    </button>
                  }
                }
              </div>

              <!-- CTA area -->
              <div class="ed-cta">

                @if (bookingError()) {
                  <div class="ed-error-msg">{{ bookingError() }}</div>
                }

                @if (!bookingSuccess()) {
                  <button class="ed-book-btn" [disabled]="!selectedTicketId() || booking()" (click)="book()">
                    @if (booking()) {
                      <span class="ed-spin"></span> Booking…
                    } @else if (!selectedTicketId()) {
                      Select a ticket
                    } @else {
                      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                      </svg>
                      Book Ticket
                    }
                  </button>
                }

                <!-- ══ BOOKING SUCCESS + FLOW B ══ -->
                @if (bookingSuccess()) {
                  <div class="ed-success">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <div>
                      <div class="ed-success__title">You're going to this event! </div>
                      <div class="ed-success__sub">Check <strong>My Bookings</strong> for your ticket.</div>
                    </div>
                  </div>

                  <!-- Flow B: follow prompt (only if org exists and not already following) -->
                  @if (event()!.organization && !isFollowingOrg()) {
                    <div class="ed-follow-prompt">
                      <div class="ed-follow-prompt__avatar">
                        @if (event()!.organization!.logoUrl) {
                          <img [src]="event()!.organization!.logoUrl" [alt]="event()!.organization!.name" class="ed-follow-prompt__img"/>
                        } @else {
                          <span class="ed-follow-prompt__initial">
                            {{ event()!.organization!.name?.charAt(0) ?? 'O' }}
                          </span>
                        }
                      </div>
                      <div class="ed-follow-prompt__body">
                        <p class="ed-follow-prompt__text">
                          Follow <strong>{{ event()!.organization!.name }}</strong> to see their future events
                        </p>
                      </div>
                      <button class="ed-follow-prompt__btn" (click)="toggleFollow()">
                        Follow
                      </button>
                    </div>
                  }

                  @if (event()!.organization && isFollowingOrg()) {
                    <div class="ed-following-confirm">
                      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Following <strong>{{ event()!.organization!.name }}</strong>
                    </div>
                  }
                }

              </div>
            }
          </aside>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      --coral:#FF4433; --gold:#F0B429; --green:#10b981; --purple:#a78bfa;
      --bg:#060608; --bg2:#0c0c10; --bg3:#111116;
      --text:#F2EEE6; --muted:rgba(242,238,230,.42);
      --bdr:rgba(242,238,230,.07); --bdrhi:rgba(242,238,230,.13);
      font-family:'Plus Jakarta Sans',sans-serif;
      display:block; background:var(--bg); color:var(--text); min-height:100%;
    }
    @keyframes shimmer { from{background-position:-600px 0}to{background-position:600px 0} }
    @keyframes pop     { from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1} }
    @keyframes spin    { to{transform:rotate(360deg)} }
    @keyframes slideIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} }

    .ed-root { padding:1.5rem; max-width:1100px; margin:0 auto; }

    .ed-back {
      display:inline-flex;align-items:center;gap:6px;
      padding:.45rem .9rem;border-radius:8px;margin-bottom:1.25rem;
      background:none;border:1px solid var(--bdr);
      color:var(--muted);font-size:.8rem;font-weight:500;cursor:pointer;
      transition:color .2s,border-color .2s;
    }
    .ed-back:hover { color:var(--text);border-color:var(--bdrhi); }

    .ed-hero {
      position:relative;border-radius:20px;overflow:hidden;
      aspect-ratio:21/9;background:var(--bg3);margin-bottom:1.75rem;
    }
    .ed-hero__img { width:100%;height:100%;object-fit:cover; }
    .ed-hero__placeholder { width:100%;height:100%;display:flex;align-items:center;justify-content:center; }
    .ed-cat-badge {
      position:absolute;bottom:1rem;left:1rem;
      padding:4px 12px;border-radius:8px;
      background:rgba(9,9,12,.75);backdrop-filter:blur(6px);
      font-family:'DM Mono',monospace;font-size:.6rem;
      letter-spacing:.1em;text-transform:uppercase;color:var(--gold);
      border:1px solid rgba(240,180,41,.25);
    }

    .ed-content {
      display:grid;grid-template-columns:1fr 380px;gap:2rem;align-items:start;
    }
    @media(max-width:860px){ .ed-content{grid-template-columns:1fr;} }

    /* Info */
    .ed-title {
      font-family:'Bebas Neue',sans-serif;font-size:clamp(2rem,5vw,3rem);
      letter-spacing:.04em;line-height:1;color:var(--text);margin:0 0 1.25rem;
    }
    .ed-meta-row { display:flex;flex-direction:column;gap:.85rem;margin-bottom:1.75rem; }
    .ed-meta-item { display:flex;gap:.75rem;align-items:flex-start; }
    .ed-meta-item__icon {
      width:32px;height:32px;border-radius:8px;flex-shrink:0;
      background:rgba(240,180,41,.08);border:1px solid rgba(240,180,41,.15);
      display:flex;align-items:center;justify-content:center;color:var(--gold);margin-top:2px;
    }
    .ed-meta-item__label { font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:2px; }
    .ed-meta-item__value { font-weight:600;font-size:.9rem;color:var(--text); }
    .ed-meta-item__sub   { font-size:.78rem;color:var(--muted); }

    /* Organiser row with follow button */
    .ed-org-row {
      display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex:1;
    }

    /* Follow button (Flow A) */
    .ed-follow-btn {
      flex-shrink:0;display:inline-flex;align-items:center;gap:.4rem;
      padding:.4rem 1rem;border-radius:8px;
      border:1.5px solid rgba(240,180,41,.45);
      background:transparent;color:var(--gold);
      font-family:'Plus Jakarta Sans',sans-serif;font-size:.76rem;font-weight:600;
      cursor:pointer;transition:all .22s;white-space:nowrap;
    }
    .ed-follow-btn:hover { background:rgba(240,180,41,.1); }
    .ed-follow-btn--on {
      background:rgba(240,180,41,.12)!important;
      border-color:var(--gold)!important;
    }

    .ed-section__title { font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:.05em;color:var(--text);margin:0 0 .65rem; }
    .ed-desc { font-size:.88rem;color:var(--muted);line-height:1.75;margin:0;white-space:pre-wrap; }

    /* Panel */
    .ed-ticket-panel {
      background:var(--bg2);border:1px solid var(--bdr);border-radius:20px;
      overflow:hidden;position:sticky;top:1.5rem;
    }
    .ed-panel-header {
      display:flex;align-items:center;gap:.55rem;padding:.85rem 1.1rem;
      border-bottom:1px solid var(--bdr);
      font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.16em;color:var(--muted);
    }
    .ed-skel-wrap { display:flex;flex-direction:column;gap:.5rem;padding:1rem; }
    .ed-skel-item {
      height:90px;border-radius:14px;
      background:linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.03) 75%);
      background-size:800px 100%;animation:shimmer 1.5s ease-in-out infinite;
    }
    .ed-no-tkt { display:flex;flex-direction:column;align-items:center;gap:.5rem;padding:2.5rem 1rem;text-align:center;color:var(--muted);font-size:.85rem; }
    .ed-no-tkt span { font-size:2rem; }
    .ed-groups { display:flex;flex-direction:column;gap:.4rem;padding:.75rem; }
    .ed-tier-row {
      display:flex;align-items:center;gap:.5rem;
      padding:.5rem .85rem;border-radius:10px;border:1px solid transparent;margin-bottom:.15rem;
    }
    .ed-tier-row__icon  { width:14px;height:14px;flex-shrink:0; }
    .ed-tier-row__label { font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.14em;font-weight:600;flex:1; }
    .ed-tier-row__count { font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.1em;color:var(--muted); }

    /* Ticket card */
    .ed-tkt {
      position:relative;width:100%;text-align:left;
      background:var(--bg3);border:1px solid var(--bdr);
      border-radius:14px;cursor:pointer;overflow:hidden;
      transition:border-color .2s,background .2s,box-shadow .22s;
      margin-bottom:.35rem;
    }
    .ed-tkt:last-child { margin-bottom:0; }
    .ed-tkt:hover:not(:disabled):not(.ed-tkt--selected) {
      border-color:var(--a-bdr,var(--bdrhi));
      background:color-mix(in srgb,var(--a,white) 4%,var(--bg3));
    }
    .ed-tkt--selected {
      border-color:var(--a,var(--gold))!important;
      background:var(--a-dim,rgba(240,180,41,.06))!important;
      box-shadow:0 0 20px color-mix(in srgb,var(--a,#F0B429) 28%,transparent);
    }
    .ed-tkt--sold-out { opacity:.38;cursor:not-allowed; }
    .ed-tkt__bar { height:3px;width:100%;opacity:0;transition:opacity .2s; }
    .ed-tkt--selected .ed-tkt__bar { opacity:1; }
    .ed-tkt__body { display:flex;align-items:center;justify-content:space-between;padding:.85rem 1rem;gap:.75rem; }
    .ed-tkt__left { flex:1;min-width:0;display:flex;flex-direction:column;gap:.3rem; }
    .ed-tkt__name { font-weight:700;font-size:.9rem;color:var(--text); }
    .ed-tkt__desc { font-size:.72rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px; }
    .ed-badge {
      display:inline-block;padding:3px 8px;border-radius:6px;
      font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.09em;border:1px solid transparent;
    }
    .ed-badge--sold { background:rgba(255,68,51,.1);color:var(--coral);border-color:rgba(255,68,51,.22); }
    .ed-tkt__price { display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0; }
    .ed-price--free { font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:.06em;line-height:1; }
    .ed-price--amt  { font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:.04em;line-height:1; }
    .ed-price--cur  { font-family:'DM Mono',monospace;font-size:.6rem;color:var(--muted);letter-spacing:.08em; }
    .ed-tkt__check {
      position:absolute;top:.6rem;right:.6rem;width:18px;height:18px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;color:#060608;animation:pop .22s cubic-bezier(.34,1.56,.64,1);
    }

    /* CTA */
    .ed-cta { padding:.25rem .75rem .75rem;display:flex;flex-direction:column;gap:.6rem; }
    .ed-book-btn {
      width:100%;padding:.9rem;border-radius:12px;border:none;
      background:var(--coral);color:#fff;
      font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:.9rem;
      cursor:pointer;transition:box-shadow .25s,transform .18s,opacity .2s;
      display:inline-flex;align-items:center;justify-content:center;gap:.5rem;
      box-shadow:0 0 28px rgba(255,68,51,.25);position:relative;overflow:hidden;
    }
    .ed-book-btn::before {
      content:'';position:absolute;inset:0;
      background:linear-gradient(135deg,rgba(255,255,255,.12) 0%,transparent 55%);pointer-events:none;
    }
    .ed-book-btn:hover:not(:disabled) { box-shadow:0 0 48px rgba(255,68,51,.45);transform:translateY(-1px); }
    .ed-book-btn:disabled { opacity:.35;cursor:not-allowed;transform:none;box-shadow:none; }
    .ed-spin {
      width:15px;height:15px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;
      border-radius:50%;animation:spin .7s linear infinite;display:inline-block;
    }

    /* Success (booking confirmed) */
    .ed-success {
      display:flex;align-items:flex-start;gap:.65rem;
      padding:.85rem 1rem;border-radius:12px;
      background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.22);
      color:var(--green);font-size:.82rem;animation:slideIn .3s both;
    }
    .ed-success__title { font-weight:700;margin-bottom:2px; }
    .ed-success__sub   { color:rgba(16,185,129,.7);font-size:.77rem; }

    /* Follow prompt (Flow B) */
    .ed-follow-prompt {
      display:flex;align-items:center;gap:.75rem;
      padding:.8rem .9rem;border-radius:12px;
      background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.22);
      animation:slideIn .35s .15s both;
    }
    .ed-follow-prompt__avatar {
      width:36px;height:36px;border-radius:10px;flex-shrink:0;overflow:hidden;
      background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.25);
      display:flex;align-items:center;justify-content:center;
    }
    .ed-follow-prompt__img { width:100%;height:100%;object-fit:cover; }
    .ed-follow-prompt__initial {
      font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.04em;color:var(--purple);
    }
    .ed-follow-prompt__body { flex:1;min-width:0; }
    .ed-follow-prompt__text {
      font-size:.78rem;color:rgba(167,139,250,.85);line-height:1.4;margin:0;
    }
    .ed-follow-prompt__text strong { color:var(--text); }
    .ed-follow-prompt__btn {
      flex-shrink:0;padding:.38rem .85rem;border-radius:7px;
      border:1.5px solid rgba(167,139,250,.5);
      background:rgba(167,139,250,.12);color:var(--purple);
      font-family:'Plus Jakarta Sans',sans-serif;font-size:.76rem;font-weight:600;
      cursor:pointer;transition:all .2s;white-space:nowrap;
    }
    .ed-follow-prompt__btn:hover { background:rgba(167,139,250,.22);border-color:var(--purple); }

    /* Following confirmation */
    .ed-following-confirm {
      display:flex;align-items:center;gap:.45rem;
      padding:.6rem .9rem;border-radius:10px;font-size:.78rem;font-weight:500;
      background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2);
      color:var(--purple);animation:slideIn .25s both;
    }
    .ed-following-confirm strong { color:var(--text); }

    .ed-error-msg {
      padding:.55rem .85rem;border-radius:8px;
      background:rgba(255,68,51,.08);border:1px solid rgba(255,68,51,.2);
      color:var(--coral);font-size:.77rem;
    }

    /* Global skeletons */
    .ed-skel__hero {
      border-radius:20px;aspect-ratio:21/9;margin-bottom:1.75rem;
      background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);
      background-size:600px 100%;animation:shimmer 1.4s ease-in-out infinite;
    }
    .ed-skel__body { display:flex;flex-direction:column;gap:.75rem; }
    .ed-skel__line {
      border-radius:8px;
      background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);
      background-size:600px 100%;animation:shimmer 1.4s ease-in-out infinite;
    }
    .ed-skel__line--xl { height:48px;width:60%; }
    .ed-skel__line--md { height:18px;width:40%; }
    .ed-skel__line--sm { height:14px;width:30%; }
    .ed-empty { display:flex;flex-direction:column;align-items:center;gap:.75rem;padding:5rem 1rem;text-align:center; }
    .ed-empty__icon { font-size:2.5rem; }
    .ed-empty__title { font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:.04em;color:var(--text);margin:0; }
    .ed-btn { padding:.55rem 1.5rem;border-radius:10px;background:var(--coral);color:#fff;border:none;font-weight:700;font-size:.85rem;cursor:pointer; }

    @media(max-width:640px){ .ed-root{padding:1rem;} .ed-hero{aspect-ratio:16/9;} }
  `],
})
export class EventDetail implements OnInit, OnDestroy {
  private readonly route     = inject(ActivatedRoute);
  private readonly router    = inject(Router);
  private readonly eventSvc  = inject(EventService);
  private readonly ticketSvc = inject(TicketService);
  private readonly followSvc = inject(FollowService);
  private readonly destroy$  = new Subject<void>();

  event            = signal<EsEvent | null>(null);
  tickets          = signal<EventTicket[]>([]);
  selectedTicketId = signal<number | null>(null);
  loading          = signal(true);
  error            = signal(false);
  ticketsLoading   = signal(false);
  booking          = signal(false);
  bookingSuccess   = signal(false);
  bookingError     = signal<string | null>(null);

  readonly fmt     = fmt;
  readonly fmtTime = fmtTime;

  /** Is the current event's organizer followed? (reactive via signal) */
  isFollowingOrg = computed(() => {
    const ev = this.event();
    if (!ev?.organizationId) return false;
    return this.followSvc.isFollowing(ev.organizationId);
  });

  readonly tierGroups = computed<TierGroup[]>(() =>
    [TicketTier.VIP, TicketTier.Premium, TicketTier.Standard]
      .map(tier => ({
        meta:    TIER_META[tier],
        tickets: this.tickets().filter(t => t.tier === tier),
      }))
      .filter(g => g.tickets.length > 0),
  );

  ngOnInit()    { this.load(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  load() {
    this.loading.set(true); this.error.set(false);
    this.route.paramMap.pipe(
      takeUntil(this.destroy$),
      switchMap(p => this.eventSvc.getEventById(Number(p.get('id'))).pipe(catchError(() => of(null)))),
    ).subscribe(ev => {
      this.loading.set(false);
      if (!ev) { this.error.set(true); return; }
      this.event.set(ev);
      this.loadTickets(ev.id);
    });
  }

  private loadTickets(eventId: number) {
    this.ticketsLoading.set(true);
    this.ticketSvc.getEventTickets(eventId).pipe(
      catchError(() => of([] as EventTicket[])), takeUntil(this.destroy$),
    ).subscribe(t => { this.tickets.set(t); this.ticketsLoading.set(false); });
  }

  selectTicket(t: EventTicket) {
    if (this.isSoldOut(t)) return;
    this.selectedTicketId.set(this.selectedTicketId() === t.id ? null : t.id);
    this.bookingError.set(null); this.bookingSuccess.set(false);
  }

  book() {
    const id = this.selectedTicketId();
    if (!id || this.booking()) return;
    this.booking.set(true); this.bookingError.set(null);
    this.ticketSvc.bookTicket(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.booking.set(false); this.bookingSuccess.set(true); this.selectedTicketId.set(null);
        this.tickets.update(l => l.map(t => t.id === id ? { ...t, soldQuantity: t.soldQuantity + 1 } : t));
      },
      error: (err: any) => {
        this.booking.set(false);
        this.bookingError.set(err?.error?.message ?? 'Booking failed. Please try again.');
      },
    });
  }

  /** Flow A & B: toggle follow on current event's organizer */
  toggleFollow(): void {
    const ev = this.event();
    if (!ev?.organization) return;
    this.followSvc.toggle({
      id:      ev.organizationId,
      name:    ev.organization.name ?? 'Organizer',
      logoUrl: (ev.organization as any).logoUrl ?? null,
    });
  }

  isSoldOut(t: EventTicket) { return t.soldQuantity >= t.totalQuantity; }

  goBack() {
    window.history.length > 1 ? window.history.back() : this.router.navigate(['/user-dashboard']);
  }
}