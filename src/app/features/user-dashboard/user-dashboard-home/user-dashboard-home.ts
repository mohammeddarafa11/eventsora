// src/app/features/user-dashboard/user-dashboard-home/user-dashboard-home.ts
//
// ROOT CAUSE FIXES:
//  1. Categories → GET /api/User/favorites (not localStorage)
//  2. Org discovery → organizationId from events → GET /api/Organization/{id}
//     (because organization: null in event list responses)
//  3. "Who to Follow" section always visible in feed (Spotify-style)
//  4. Four feed sections: For You · Who to Follow · Following · Trending
//
import {
  Component, inject, signal, computed, OnInit, OnDestroy,
  ElementRef, ViewChildren, QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { CategoryService, Category } from '@core/services/category';
import { EventService } from '@core/services/event.service';
import { FollowService } from '@core/services/follow.service';
import { Event as EsEvent } from '@core/models/event.model';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-EG', { month: 'short', day: 'numeric', year: 'numeric' });
}
function isUpcoming(iso?: string) { return !!iso && new Date(iso) > new Date(); }
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime() - Date.now();
  return d < 0 ? null : Math.ceil(d / 86_400_000);
}

interface CategoryRow { cat: Category; events: EsEvent[]; color: string; }
interface DiscoveredOrg {
  id: number; name: string; logoUrl: string | null;
  bio: string | null; city: string | null; eventCount: number;
}

const ROW_COLORS = ['#F0B429','#FF4433','#1DB954','#a78bfa','#0ea5e9','#f97316','#ec4899','#22d3ee','#84cc16','#6366f1','#14b8a6','#fb7185'];
const CHIP_BG    = ['rgba(240,180,41,.14)','rgba(255,68,51,.14)','rgba(29,185,84,.14)','rgba(167,139,250,.14)','rgba(14,165,233,.14)','rgba(249,115,22,.14)','rgba(236,72,153,.14)','rgba(34,211,238,.14)','rgba(132,204,22,.14)','rgba(99,102,241,.14)','rgba(20,184,166,.14)','rgba(251,113,133,.14)'];
const CHIP_BDR   = ['rgba(240,180,41,.4)','rgba(255,68,51,.4)','rgba(29,185,84,.4)','rgba(167,139,250,.4)','rgba(14,165,233,.4)','rgba(249,115,22,.4)','rgba(236,72,153,.4)','rgba(34,211,238,.4)','rgba(132,204,22,.4)','rgba(99,102,241,.4)','rgba(20,184,166,.4)','rgba(251,113,133,.4)'];
const CHIP_TXT   = ['#F0B429','#FF4433','#1DB954','#a78bfa','#0ea5e9','#f97316','#ec4899','#22d3ee','#84cc16','#6366f1','#14b8a6','#fb7185'];

@Component({
  selector: 'app-user-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <div class="udh">

      <!-- ═══ GREETING HERO ═══ -->
      <header class="udh-hero">
        <div class="udh-orb-a"></div><div class="udh-orb-b"></div>
        <div class="udh-hero__body">
          <div class="udh-hero__eye">
            <span class="udh-tag">For You</span>
            <span class="udh-tag udh-tag--dim">{{ todayLabel() }}</span>
          </div>
          <h1 class="udh-hero__title">
            @if (userName()) { Hey, <em class="udh-em">{{ userName() }}</em> }
            @else             { Welcome back }
          </h1>
          <p class="udh-hero__sub">
            @if (loading()) { Loading your personalised feed… }
            @else if (totalEvents() > 0) {
              <strong class="udh-em">{{ totalEvents() }}</strong> events across
              <strong class="udh-em">{{ rows().length }}</strong> {{ rows().length === 1 ? 'genre' : 'genres' }} — curated for you.
            } @else { Explore events below. }
          </p>
        </div>
      </header>

      <!-- ═══ CATEGORY FILTER CHIPS ═══ -->
      @if (!loading() && userCats().length > 0) {
        <div class="udh-chips-wrap">
          <div class="udh-chips" role="toolbar" aria-label="Filter by genre">
            @for (cat of userCats(); track cat.id; let i = $index) {
              <button
                class="udh-chip"
                [class.udh-chip--active]="activeFilter() === cat.id"
                [style.--cb]="chipBg(i)"
                [style.--cd]="chipBdr(i)"
                [style.--ct]="chipTxt(i)"
                [attr.aria-pressed]="activeFilter() === cat.id"
                (click)="setFilter(cat.id)"
                (mousedown)="startLP(cat.id,$event)" (mouseup)="stopLP()" (mouseleave)="stopLP()"
                (touchstart)="startLP(cat.id,$event)" (touchend)="stopLP()"
              >{{ cat.name }}
                @if (activeFilter() === cat.id) {
                  <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                }
              </button>
            }
            <button class="udh-chip udh-chip--add" (click)="goEdit()">
              <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              Add
            </button>
          </div>
          @if (removingName()) {
            <div class="udh-rm-toast" role="alert">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Removing "{{ removingName() }}"…
            </div>
          }
        </div>
      }

      <!-- ═══ SKELETONS ═══ -->
      @if (loading()) {
        <div class="udh-spotlight-wrap"><div class="udh-skel-hero"></div></div>
        @for (n of [0,1,2]; track n) {
          <section class="udh-row">
            <div class="udh-row__head">
              <div class="udh-skel" style="width:3px;height:18px;border-radius:99px"></div>
              <div class="udh-skel" style="width:120px;height:14px;border-radius:6px"></div>
            </div>
            <div class="udh-row__track">
              @for (c of [0,1,2,3,4]; track c) {
                <div class="udh-skel-card">
                  <div class="udh-skel" style="aspect-ratio:3/2"></div>
                  <div class="udh-skel-card__body">
                    <div class="udh-skel" style="height:9px;width:50%"></div>
                    <div class="udh-skel" style="height:13px;width:85%"></div>
                    <div class="udh-skel" style="height:9px;width:55%"></div>
                  </div>
                </div>
              }
            </div>
          </section>
        }
      }

      @else if (error()) {
        <div class="udh-empty">
          <p class="udh-empty__ico">!</p>
          <p class="udh-empty__title">Couldn't load events</p>
          <button class="udh-btn" (click)="reload()">Retry</button>
        </div>
      }

      @else {

        <!-- ═══ SPOTLIGHT ═══ -->
        @if (spotlight()) {
          <div class="udh-spotlight-wrap">
            <div class="udh-spotlight" (click)="open(spotlight()!)">
              @if (spotlight()!.event_img_url) {
                <img [src]="spotlight()!.event_img_url" class="udh-spotlight__bg" [alt]="spotlight()!.title"/>
              } @else {
                <div class="udh-spotlight__bg udh-spotlight__bg--empty"></div>
              }
              <div class="udh-spotlight__scrim"></div>
              <div class="udh-spotlight__content">
                <div class="udh-spotlight__tags">
                  <span class="udh-tag udh-tag--live"><span class="udh-pulse"></span>Upcoming</span>
                  @if (daysUntil(spotlight()!.start_time) !== null) {
                    <span class="udh-tag udh-tag--dim">In {{ daysUntil(spotlight()!.start_time) }}d</span>
                  }
                </div>
                <h2 class="udh-spotlight__title">{{ spotlight()!.title }}</h2>
                <button class="udh-spotlight__btn" (click)="open(spotlight()!);$event.stopPropagation()">
                  Get Tickets
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        }

        <!-- ══════════════════════════════════════ -->
        <!--  A: FOR YOU                           -->
        <!-- ══════════════════════════════════════ -->
        @if (filteredRows().length > 0) {
          <div class="udh-section-hd">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
            For You
            @if (activeFilter() !== null) {
              <button class="udh-clear" (click)="clearFilter()">Show all ×</button>
            }
          </div>

          @for (row of filteredRows(); track row.cat.id; let ri = $index) {
            @if (row.events.length > 0) {
              <section class="udh-row" [style.--rc]="row.color">
                <div class="udh-row__head">
                  <span class="udh-row__bar"></span>
                  <h2 class="udh-row__title">{{ row.cat.name }}</h2>
                  <span class="udh-row__n">{{ row.events.length }}</span>
                  <div class="udh-row__btns">
                    <button class="udh-row__btn" (click)="scrollQ(forYouQ, ri, -1)">‹</button>
                    <button class="udh-row__btn" (click)="scrollQ(forYouQ, ri,  1)">›</button>
                  </div>
                </div>
                <div class="udh-row__track" #forYouTrack>
                  @for (ev of row.events; track ev.id; let i = $index) {
                    <ng-container *ngTemplateOutlet="cardTpl; context:{ev, rc: row.color, i}"></ng-container>
                  }
                </div>
              </section>
            }
          }
        }

        <!-- ══════════════════════════════════════ -->
        <!--  B: WHO TO FOLLOW  (Spotify-style)    -->
        <!-- ══════════════════════════════════════ -->
        @if (discoveredOrgs().length > 0 || orgsLoading()) {
          <div class="udh-section-hd udh-section-hd--follow">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
            Who to Follow
            <span class="udh-section-hd__sub">Based on your genres</span>
          </div>
          <section class="udh-row" style="--rc:#a78bfa;margin-bottom:2.5rem">
            <div class="udh-row__track udh-row__track--orgs">
              @if (orgsLoading()) {
                @for (n of [0,1,2,3,4]; track n) {
                  <div class="udh-org-skel" [style.animation-delay]="n*70+'ms'"></div>
                }
              } @else {
                @for (org of discoveredOrgs(); track org.id; let i = $index) {
                  <div class="udh-org-card" [style.animation-delay]="i*55+'ms'">
                    <div class="udh-org-card__av" [class.udh-org-card__av--default]="!org.logoUrl">
                      @if (org.logoUrl) {
                        <img [src]="org.logoUrl" [alt]="org.name" class="udh-org-card__img"
                             (error)="onImgError($event)"/>
                      } @else {
                        <div class="udh-org-card__default">
                          <svg width="26" height="26" fill="none" stroke="currentColor"
                               stroke-width="1.4" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                          </svg>
                          <span class="udh-org-card__init-letter">{{ org.name.charAt(0).toUpperCase() }}</span>
                        </div>
                      }
                    </div>
                    <h3 class="udh-org-card__name">{{ org.name }}</h3>
                    @if (org.city) {
                      <p class="udh-org-card__city">
                        <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        {{ org.city }}
                      </p>
                    }
                    <p class="udh-org-card__events">{{ org.eventCount }} event{{ org.eventCount !== 1 ? 's' : '' }}</p>
                    <button
                      class="udh-org-card__btn"
                      [class.udh-org-card__btn--on]="followSvc.isFollowing(org.id)"
                      (click)="toggleFollow(org)"
                    >
                      @if (followSvc.isFollowing(org.id)) {
                        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.8" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                        Following
                      } @else { + Follow }
                    </button>
                  </div>
                }
              }
            </div>
          </section>
        }

        <!-- ══════════════════════════════════════ -->
        <!--  C: FROM ORGS YOU FOLLOW              -->
        <!-- ══════════════════════════════════════ -->
        @if (followingEvents().length > 0) {
          <div class="udh-section-hd udh-section-hd--following">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            From Orgs You Follow
          </div>
          <section class="udh-row" style="--rc:#a78bfa">
            <div class="udh-row__head">
              <span class="udh-row__bar" style="background:#a78bfa"></span>
              <h2 class="udh-row__title">Following</h2>
              <span class="udh-row__n">{{ followingEvents().length }}</span>
            </div>
            <div class="udh-row__track">
              @for (ev of followingEvents(); track ev.id; let i = $index) {
                <ng-container *ngTemplateOutlet="cardTpl; context:{ev, rc:'#a78bfa', i}"></ng-container>
              }
            </div>
          </section>
        }

        <!-- ══════════════════════════════════════ -->
        <!--  D: TRENDING                          -->
        <!-- ══════════════════════════════════════ -->
        @if (trendingEvents().length > 0) {
          <div class="udh-section-hd udh-section-hd--trending">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            Trending Now
          </div>
          <section class="udh-row" style="--rc:#FF4433">
            <div class="udh-row__head">
              <span class="udh-row__bar" style="background:#FF4433"></span>
              <h2 class="udh-row__title">Upcoming Events</h2>
              <span class="udh-row__n">{{ trendingEvents().length }}</span>
            </div>
            <div class="udh-row__track">
              @for (ev of trendingEvents(); track ev.id; let i = $index) {
                <ng-container *ngTemplateOutlet="cardTpl; context:{ev, rc:'#FF4433', i}"></ng-container>
              }
            </div>
          </section>
        }

        @if (rows().length === 0 && trendingEvents().length === 0) {
          <div class="udh-empty">
            <p class="udh-empty__ico"></p>
            <p class="udh-empty__title">No events yet</p>
            <p class="udh-empty__sub">Check back soon.</p>
          </div>
        }
      }

      <!-- ═══ SHARED EVENT CARD TEMPLATE ═══ -->
      <ng-template #cardTpl let-ev="ev" let-rc="rc" let-i="i">
        <article class="udh-card" [style.--rc]="rc" [style.animation-delay]="i*40+'ms'" (click)="open(ev)">
          <div class="udh-card__img-wrap">
            @if (ev.event_img_url) {
              <img [src]="ev.event_img_url" [alt]="ev.title" class="udh-card__img" loading="lazy"/>
            } @else {
              <div class="udh-card__noimg">
                <svg width="26" height="26" fill="none" stroke="currentColor" stroke-width=".8" viewBox="0 0 24 24" opacity=".2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 3v4M8 3v4M3 11h18"/>
                </svg>
              </div>
            }
            @if (isUpcoming(ev.start_time)) {
              <span class="udh-card__dot"><span class="udh-mini-pulse"></span></span>
            }
            <div class="udh-card__grad"></div>
          </div>
          <div class="udh-card__body">
            @if (ev.start_time) {
              <div class="udh-card__date">{{ fmtDate(ev.start_time) }}</div>
            }
            <h3 class="udh-card__name">{{ ev.title }}</h3>
            @if (ev.city || ev.nameOfPlace) {
              <div class="udh-card__loc">
                <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                {{ ev.nameOfPlace || ev.city }}
              </div>
            }
            <div class="udh-card__foot">
              @if (ev.eventTickets?.length) {
                <span class="udh-card__price">
                  @if (minPrice(ev) === 0) { Free } @else { EGP {{ minPrice(ev) | number:'1.0-0' }} }
                </span>
              }
              <span class="udh-card__arrow">→</span>
            </div>
          </div>
        </article>
      </ng-template>

      <div style="height:3rem"></div>
    </div>
  `,
  styles: [`
    :host {
      --gold:#F0B429;--coral:#FF4433;--green:#22c55e;--purple:#a78bfa;
      --bg:#060608;--bg2:#09090c;--bg3:#111116;
      --text:#F2EEE6;--muted:rgba(242,238,230,.42);
      --bdr:rgba(242,238,230,.07);--hi:rgba(242,238,230,.12);
      font-family:'Plus Jakarta Sans',sans-serif;display:block;background:var(--bg);color:var(--text);min-height:100%;
    }
    .udh-tag {
      display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;
      font-family:'DM Mono',monospace;font-size:.59rem;letter-spacing:.12em;text-transform:uppercase;
      background:rgba(240,180,41,.1);border:1px solid rgba(240,180,41,.2);color:var(--gold);
    }
    .udh-tag--dim  { background:rgba(242,238,230,.05);border-color:var(--bdr);color:var(--muted); }
    .udh-tag--live { background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.25);color:var(--green); }
    .udh-pulse,.udh-mini-pulse {
      display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);
      animation:pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.6)}}
    .udh-em{color:var(--gold);font-style:normal;}

    /* Hero */
    .udh-hero{position:relative;overflow:hidden;padding:2.5rem 1.75rem 2rem;}
    .udh-orb-a,.udh-orb-b{position:absolute;border-radius:50%;pointer-events:none;z-index:0;}
    .udh-orb-a{width:420px;height:420px;top:-160px;right:-80px;background:radial-gradient(circle,rgba(240,180,41,.07) 0%,transparent 65%);}
    .udh-orb-b{width:280px;height:280px;bottom:-80px;left:-50px;background:radial-gradient(circle,rgba(255,68,51,.05) 0%,transparent 65%);}
    .udh-hero__body{position:relative;z-index:1;}
    .udh-hero__eye{display:flex;gap:.5rem;margin-bottom:.9rem;}
    .udh-hero__title{font-family:'Bebas Neue',sans-serif;font-size:clamp(2.8rem,7vw,4.8rem);letter-spacing:.03em;line-height:.9;color:var(--text);margin:0 0 .65rem;}
    .udh-hero__sub{font-size:.84rem;color:var(--muted);margin:0;font-weight:300;line-height:1.6;}

    /* Chips */
    .udh-chips-wrap{padding:0 1.75rem .75rem;}
    .udh-chips{display:flex;gap:.45rem;overflow-x:auto;padding:.2rem .05rem .4rem;scrollbar-width:none;scroll-snap-type:x mandatory;}
    .udh-chips::-webkit-scrollbar{display:none;}
    .udh-chip{
      flex-shrink:0;display:inline-flex;align-items:center;gap:.35rem;
      padding:.38rem .88rem;border-radius:100px;
      background:var(--cb,rgba(242,238,230,.06));border:1.5px solid var(--cd,rgba(242,238,230,.1));color:var(--ct,var(--muted));
      font-family:'Plus Jakarta Sans',sans-serif;font-size:.76rem;font-weight:600;
      cursor:pointer;user-select:none;transition:all .2s;scroll-snap-align:start;-webkit-tap-highlight-color:transparent;
    }
    .udh-chip--active{border-color:var(--ct)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--ct) 18%,transparent);}
    .udh-chip--add{background:rgba(242,238,230,.04)!important;border-color:rgba(242,238,230,.1)!important;color:var(--muted)!important;}
    .udh-chip--add:hover{border-color:rgba(242,238,230,.22)!important;color:var(--text)!important;}
    .udh-clear{background:none;border:none;padding:0;font-size:.72rem;color:var(--coral);font-weight:600;cursor:pointer;margin-left:auto;}
    .udh-rm-toast{
      display:flex;align-items:center;gap:.5rem;margin-top:.35rem;
      padding:.45rem .75rem;border-radius:9px;
      background:rgba(255,68,51,.1);border:1px solid rgba(255,68,51,.22);
      color:var(--coral);font-size:.75rem;font-weight:500;animation:fadeIn .2s both;
    }
    @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}

    /* Section headers */
    .udh-section-hd{
      display:flex;align-items:center;gap:.55rem;padding:0 1.75rem .7rem;
      font-family:'DM Mono',monospace;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);
    }
    .udh-section-hd--follow{color:#a78bfa;}
    .udh-section-hd--following{color:#a78bfa;}
    .udh-section-hd--trending{color:var(--coral);}
    .udh-section-hd__sub{font-size:.55rem;color:var(--muted);text-transform:none;letter-spacing:.06em;margin-left:.25rem;}

    /* Spotlight */
    .udh-spotlight-wrap{padding:0 1.75rem 2.5rem;}
    .udh-spotlight{
      position:relative;border-radius:20px;overflow:hidden;height:320px;
      cursor:pointer;border:1px solid var(--bdr);transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s;
    }
    .udh-spotlight:hover{transform:translateY(-3px);box-shadow:0 24px 60px rgba(0,0,0,.6);}
    .udh-spotlight__bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.22,1,.36,1);}
    .udh-spotlight:hover .udh-spotlight__bg{transform:scale(1.05);}
    .udh-spotlight__bg--empty{background:var(--bg3);}
    .udh-spotlight__scrim{position:absolute;inset:0;background:linear-gradient(to right,rgba(6,6,8,.96) 0%,rgba(6,6,8,.7) 40%,rgba(6,6,8,.1) 100%);}
    .udh-spotlight__content{position:relative;z-index:1;padding:1.75rem 2rem;height:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:.75rem;max-width:500px;}
    .udh-spotlight__tags{display:flex;gap:.4rem;flex-wrap:wrap;}
    .udh-spotlight__title{font-family:'Bebas Neue',sans-serif;font-size:clamp(1.7rem,4vw,2.6rem);letter-spacing:.03em;line-height:.95;color:var(--text);margin:0;}
    .udh-spotlight__btn{
      display:inline-flex;align-items:center;gap:.5rem;width:fit-content;
      padding:.6rem 1.25rem;border-radius:10px;background:var(--gold);color:#1a1200;border:none;
      font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:.88rem;
      cursor:pointer;transition:box-shadow .25s,transform .2s;box-shadow:0 0 24px rgba(240,180,41,.28);
    }
    .udh-spotlight__btn:hover{box-shadow:0 0 44px rgba(240,180,41,.5);transform:translateY(-2px);}
    .udh-skel-hero{height:320px;border-radius:20px;background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);background-size:800px 100%;animation:shimmer 1.5s ease-in-out infinite;}
    @keyframes shimmer{from{background-position:-600px 0}to{background-position:600px 0}}

    /* Rows */
    .udh-row{--rc:var(--gold);position:relative;margin-bottom:2rem;}
    .udh-row::after{content:'';pointer-events:none;position:absolute;top:36px;right:0;bottom:0;width:52px;background:linear-gradient(to left,var(--bg) 0%,transparent 100%);z-index:2;}
    .udh-row__head{display:flex;align-items:center;gap:.7rem;padding:0 1.75rem .75rem;}
    .udh-row__bar{width:3px;height:20px;border-radius:99px;background:var(--rc);flex-shrink:0;}
    .udh-row__title{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:.06em;color:var(--text);margin:0;flex:1;}
    .udh-row__n{font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.1em;color:var(--muted);padding:2px 7px;border-radius:100px;background:rgba(242,238,230,.05);border:1px solid var(--bdr);}
    .udh-row__btns{display:none;gap:.3rem;}
    @media(min-width:768px){.udh-row__btns{display:flex;}}
    .udh-row__btn{width:26px;height:26px;border-radius:6px;flex-shrink:0;background:var(--bg3);border:1px solid var(--bdr);display:flex;align-items:center;justify-content:center;color:var(--muted);cursor:pointer;transition:all .2s;font-size:1rem;}
    .udh-row__btn:hover{background:var(--bg);border-color:var(--hi);color:var(--text);}
    .udh-row__track{display:flex;gap:.75rem;overflow-x:auto;overflow-y:visible;padding:.2rem 1.75rem .85rem;scrollbar-width:none;scroll-behavior:smooth;scroll-snap-type:x mandatory;}
    .udh-row__track::-webkit-scrollbar{display:none;}
    .udh-row__track--orgs{padding-top:.3rem;}

    /* Org cards (Spotify) */
    .udh-org-card{
      flex-shrink:0;width:158px;background:var(--bg2);border:1px solid var(--bdr);border-radius:16px;
      padding:1.1rem .9rem .9rem;display:flex;flex-direction:column;align-items:center;gap:.5rem;
      text-align:center;cursor:default;scroll-snap-align:start;
      transition:border-color .2s,box-shadow .25s,transform .22s cubic-bezier(.22,1,.36,1);
      animation:cardIn .45s cubic-bezier(.22,1,.36,1) both;
    }
    .udh-org-card:hover{border-color:rgba(167,139,250,.3);box-shadow:0 12px 32px rgba(0,0,0,.45);transform:translateY(-4px);}
    .udh-org-skel{flex-shrink:0;width:158px;height:218px;border-radius:16px;background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);background-size:600px 100%;animation:shimmer 1.5s ease-in-out infinite;scroll-snap-align:start;}
    .udh-org-card__av{width:64px;height:64px;border-radius:50%;overflow:hidden;background:rgba(167,139,250,.12);border:2px solid rgba(167,139,250,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .udh-org-card__img{width:100%;height:100%;object-fit:cover;}

    /* Default avatar when no logo */
    .udh-org-card__av--default {
      background: linear-gradient(135deg,rgba(167,139,250,.18) 0%,rgba(99,102,241,.22) 100%) !important;
      border-color: rgba(167,139,250,.35) !important;
    }
    .udh-org-card__default {
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:2px;width:100%;height:100%;
      color:rgba(167,139,250,.75);
    }
    .udh-org-card__init-letter {
      font-family:'Bebas Neue',sans-serif;font-size:.85rem;letter-spacing:.08em;
      color:rgba(167,139,250,.55);line-height:1;
    }
    .udh-org-card__name{font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:.04em;color:var(--text);margin:0;line-height:1.1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .udh-org-card__city{display:flex;align-items:center;gap:3px;font-size:.65rem;color:var(--muted);margin:0;}
    .udh-org-card__events{font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.08em;color:rgba(167,139,250,.65);margin:0;}
    .udh-org-card__btn{
      display:inline-flex;align-items:center;gap:.35rem;
      padding:.38rem .9rem;border-radius:100px;
      border:1.5px solid rgba(167,139,250,.45);background:transparent;color:#a78bfa;
      font-family:'Plus Jakarta Sans',sans-serif;font-size:.72rem;font-weight:600;
      cursor:pointer;transition:all .2s;white-space:nowrap;margin-top:.25rem;
    }
    .udh-org-card__btn:hover{background:rgba(167,139,250,.12);}
    .udh-org-card__btn--on{background:rgba(167,139,250,.15)!important;border-color:#a78bfa!important;}

    /* Event cards */
    .udh-card{
      flex-shrink:0;width:210px;border-radius:14px;overflow:hidden;
      background:var(--bg2);border:1px solid var(--bdr);cursor:pointer;position:relative;
      transition:transform .25s cubic-bezier(.22,1,.36,1),border-color .2s,box-shadow .2s;
      animation:cardIn .45s cubic-bezier(.22,1,.36,1) both;scroll-snap-align:start;
    }
    @keyframes cardIn{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
    .udh-card:hover{transform:translateY(-7px) scale(1.025);border-color:var(--hi);box-shadow:0 18px 44px rgba(0,0,0,.55);z-index:10;}
    .udh-card__img-wrap{position:relative;aspect-ratio:3/2;overflow:hidden;background:var(--bg3);}
    .udh-card__img{width:100%;height:100%;object-fit:cover;transition:transform .45s;}
    .udh-card:hover .udh-card__img{transform:scale(1.08);}
    .udh-card__noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;}
    .udh-card__dot{position:absolute;top:.5rem;left:.5rem;width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 3px rgba(34,197,94,.2);}
    .udh-mini-pulse{display:block;width:100%;height:100%;border-radius:50%;}
    .udh-card__grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(6,6,8,.65) 0%,transparent 55%);opacity:0;transition:opacity .3s;}
    .udh-card:hover .udh-card__grad{opacity:1;}
    .udh-card__body{padding:.7rem .85rem .8rem;display:flex;flex-direction:column;gap:.26rem;}
    .udh-card__date{font-family:'DM Mono',monospace;font-size:.57rem;letter-spacing:.1em;text-transform:uppercase;color:var(--rc,var(--gold));}
    .udh-card__name{font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:.03em;color:var(--text);margin:0;line-height:1.1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .udh-card__loc{display:flex;align-items:center;gap:3px;font-size:.65rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .udh-card__foot{display:flex;align-items:center;justify-content:space-between;margin-top:.28rem;}
    .udh-card__price{font-family:'DM Mono',monospace;font-size:.64rem;color:var(--gold);letter-spacing:.06em;}
    .udh-card__arrow{font-size:.7rem;font-weight:700;color:var(--rc,var(--gold));opacity:0;transform:translateX(-4px);transition:opacity .2s,transform .2s;}
    .udh-card:hover .udh-card__arrow{opacity:1;transform:translateX(0);}

    /* Skeletons */
    .udh-skel{background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);background-size:600px 100%;animation:shimmer 1.5s ease-in-out infinite;border-radius:6px;}
    .udh-skel-card{flex-shrink:0;width:210px;border-radius:14px;overflow:hidden;background:var(--bg2);border:1px solid var(--bdr);scroll-snap-align:start;}
    .udh-skel-card__body{padding:.7rem .85rem;display:flex;flex-direction:column;gap:.38rem;}

    /* Empty */
    .udh-empty{display:flex;flex-direction:column;align-items:center;gap:.75rem;padding:5rem 1rem;text-align:center;}
    .udh-empty__ico{font-size:2.5rem;}
    .udh-empty__title{font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:.04em;color:var(--text);margin:0;}
    .udh-empty__sub{font-size:.84rem;color:var(--muted);margin:0;font-weight:300;}
    .udh-btn{padding:.55rem 1.5rem;border-radius:10px;background:var(--gold);color:#1a1200;border:none;font-weight:700;font-size:.85rem;cursor:pointer;}

    @media(max-width:640px){
      .udh-hero,.udh-chips-wrap{padding-inline:1.1rem;}
      .udh-spotlight-wrap{padding:0 1.1rem 2rem;}
      .udh-spotlight{height:240px;}
      .udh-section-hd,.udh-row__head{padding-inline:1.1rem;}
      .udh-row__track{padding-inline:1.1rem;}
      .udh-row::after{width:28px;}
      .udh-card{width:185px;}
      .udh-org-card{width:145px;}
    }
  `],
})
export class UserDashboardHome implements OnInit, OnDestroy {
  private readonly auth      = inject(AuthService);
  private readonly catSvc    = inject(CategoryService);
  private readonly eventSvc  = inject(EventService);
  private readonly router    = inject(Router);
  private readonly http      = inject(HttpClient);
  readonly followSvc         = inject(FollowService);
  private readonly destroy$  = new Subject<void>();
  private readonly BASE       = 'https://eventora.runasp.net/api';

  @ViewChildren('forYouTrack') forYouQ!: QueryList<ElementRef<HTMLDivElement>>;

  userName        = signal<string>('');
  rows            = signal<CategoryRow[]>([]);
  loading         = signal(true);
  error           = signal(false);
  discoveredOrgs  = signal<DiscoveredOrg[]>([]);
  orgsLoading     = signal(false);
  followingEvents = signal<EsEvent[]>([]);
  trendingEvents  = signal<EsEvent[]>([]);
  activeFilter    = signal<number | null>(null);
  removingCatId   = signal<number | null>(null);
  private lpTimer: ReturnType<typeof setTimeout> | null = null;

  userCats     = computed(() => this.rows().map(r => r.cat).filter(c => c.id !== -1));
  filteredRows = computed(() => {
    const f = this.activeFilter();
    return f === null ? this.rows() : this.rows().filter(r => r.cat.id === f);
  });
  totalEvents  = computed(() => this.rows().reduce((n, r) => n + r.events.length, 0));
  spotlight    = computed<EsEvent | null>(() => {
    const all = this.rows().flatMap(r => r.events);
    return all.filter(e => isUpcoming(e.start_time))
              .sort((a, b) => +new Date(a.start_time!) - +new Date(b.start_time!))[0]
           ?? all[0] ?? null;
  });
  removingName = computed(() => {
    const id = this.removingCatId();
    return id !== null ? (this.userCats().find(c => c.id === id)?.name ?? '') : '';
  });

  readonly fmtDate    = fmtDate;
  readonly isUpcoming = isUpcoming;
  readonly daysUntil  = daysUntil;
  chipBg(i: number)  { return CHIP_BG[i  % CHIP_BG.length]; }
  chipBdr(i: number) { return CHIP_BDR[i % CHIP_BDR.length]; }
  chipTxt(i: number) { return CHIP_TXT[i % CHIP_TXT.length]; }
  todayLabel() { return new Date().toLocaleDateString('en-EG', { weekday:'long', month:'long', day:'numeric' }); }
  minPrice(ev: EsEvent) {
    if (!ev.eventTickets?.length) return 0;
    return Math.min(...ev.eventTickets.map(t => t.actualPrice ?? 0));
  }

  ngOnInit()    { this.loadAll(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); this.stopLP(); }
  reload()      { this.loadAll(); }
  open(ev: EsEvent) { this.router.navigate(['/user-dashboard/events', ev.id]); }
  goEdit()      { this.router.navigate(['/user-dashboard/edit-interests']); }

  setFilter(id: number) { if (!this.lpTimer) this.activeFilter.update(f => f === id ? null : id); }
  clearFilter()         { this.activeFilter.set(null); }
  startLP(catId: number, e: Event) {
    e.preventDefault();
    this.lpTimer = setTimeout(() => { this.lpTimer = null; this.removeCategory(catId); }, 650);
  }
  stopLP() { if (this.lpTimer) { clearTimeout(this.lpTimer); this.lpTimer = null; } }

  toggleFollow(org: DiscoveredOrg) {
    this.followSvc.toggle({ id: org.id, name: org.name, logoUrl: org.logoUrl });
    this.loadFollowing();
  }
  scrollQ(ql: QueryList<ElementRef<HTMLDivElement>>, idx: number, dir: -1|1) {
    ql.toArray()[idx]?.nativeElement.scrollBy({ left: dir * 650, behavior:'smooth' });
  }

  /** Replace broken org logo with null so the default avatar shows */
  onImgError(e: Event) {
    const img = e.target as HTMLImageElement;
    // Hide the broken img; Angular's @if will re-evaluate on next change detection
    // via toggling org.logoUrl — simplest approach: hide the element directly
    img.style.display = 'none';
    if (img.parentElement) {
      img.parentElement.classList.add('udh-org-card__av--default');
      img.parentElement.innerHTML = `
        <div class="udh-org-card__default">
          <svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.4" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
        </div>`;
    }
  }

  // ── Data ─────────────────────────────────────────────────────────────

  private loadAll() {
    this.loading.set(true);
    this.error.set(false);
    const profile = this.auth.getUserProfile() as any;
    this.userName.set(profile?.firstName ?? '');

    // ① Categories from API
    this.http
      .get<{ data: Category[]; success: boolean }>(`${this.BASE}/User/favorites`)
      .pipe(catchError(() => of({ data: [] as Category[], success: false })), takeUntil(this.destroy$))
      .subscribe(resp => {
        let cats = resp.data ?? [];

        // Fallback: localStorage + getAllCategories
        if (cats.length === 0) {
          const ids = this.auth.getSavedCategoryIds() ?? [];
          if (ids.length > 0) {
            this.catSvc.getAllCategories().pipe(
              catchError(() => of([] as Category[])), takeUntil(this.destroy$),
            ).subscribe(all => this.fetchEventsForCats(all.filter(c => ids.includes(c.id))));
            return;
          }
        }
        this.fetchEventsForCats(cats);
      });
  }

  private fetchEventsForCats(cats: Category[]) {
    if (cats.length === 0) {
      this.eventSvc.getAllEvents().pipe(
        catchError(() => of([] as EsEvent[])), takeUntil(this.destroy$),
      ).subscribe(evs => {
        this.rows.set([{ cat: { id: -1, name: 'All Events' } as any, events: evs, color: ROW_COLORS[0] }]);
        this.loading.set(false);
        this.discoverOrgs(evs);
        this.loadTrending([]);
        this.loadFollowing();
      });
      return;
    }

    // ② Events per category
    forkJoin(
      cats.map(c =>
        this.http
          .get<{ data: EsEvent[] }>(`${this.BASE}/Event/Category?categoryId=${c.id}`)
          .pipe(catchError(() => of({ data: [] as EsEvent[] })))
      )
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: results => {
        const allEvs: EsEvent[] = [];
        const builtRows = cats.map((cat, i) => {
          const evs = (results[i]?.data ?? []).sort((a, b) => {
            const d = (isUpcoming(b.start_time) ? 1 : 0) - (isUpcoming(a.start_time) ? 1 : 0);
            return d !== 0 ? d : +new Date(a.start_time ?? 0) - +new Date(b.start_time ?? 0);
          });
          allEvs.push(...evs);
          return { cat, events: evs, color: ROW_COLORS[i % ROW_COLORS.length] };
        });
        this.auth.saveCategoryIds(cats.map(c => c.id));
        this.rows.set(builtRows);
        this.loading.set(false);
        this.discoverOrgs(allEvs);
        this.loadTrending(allEvs.map(e => e.id));
        this.loadFollowing();
      },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  /**
   * ③ Org discovery — organisation: null in event list responses.
   *    Collect unique organizationIds → fetch org profile + real event list
   *    in parallel so eventCount reflects the true total, not just the
   *    number of events that happened to appear in the category results.
   */
  private discoverOrgs(events: EsEvent[]) {
    // Deduplicate org IDs from what we already have
    const seenIds = new Set<number>();
    events.forEach(ev => { if (ev.organizationId) seenIds.add(ev.organizationId); });
    if (seenIds.size === 0) { this.discoveredOrgs.set([]); return; }

    this.orgsLoading.set(true);
    const ids = Array.from(seenIds).slice(0, 10);

    // For each org: fetch profile AND their full event list in parallel
    forkJoin(
      ids.map(id =>
        forkJoin({
          profile: this.http
            .get<{ data: any }>(`${this.BASE}/Organization/${id}`)
            .pipe(catchError(() => of({ data: null }))),
          orgEvents: this.http
            .get<{ data: EsEvent[] }>(`${this.BASE}/Event/organization?organizationId=${id}`)
            .pipe(catchError(() => of({ data: [] as EsEvent[] }))),
        })
      )
    ).pipe(takeUntil(this.destroy$)).subscribe(results => {
      const orgs: DiscoveredOrg[] = [];

      results.forEach(({ profile, orgEvents }) => {
        if (!profile?.data) return;
        const d          = profile.data;
        // Use the real count from the org's own event list
        const realCount  = (orgEvents?.data ?? []).length;

        orgs.push({
          id:         d.id,
          name:       d.name  ?? 'Organizer',
          logoUrl:    d.logoUrl ?? null,
          bio:        d.bio    ?? null,
          city:       d.city   ?? null,
          eventCount: realCount,
        });
      });

      // Unfollowed first, then sort by most events
      this.discoveredOrgs.set(
        orgs.sort((a, b) => {
          const diff = (this.followSvc.isFollowing(a.id) ? 1 : 0)
                     - (this.followSvc.isFollowing(b.id) ? 1 : 0);
          return diff !== 0 ? diff : b.eventCount - a.eventCount;
        })
      );
      this.orgsLoading.set(false);
    });
  }

  private loadTrending(excludeIds: number[]) {
    const ex = new Set(excludeIds);
    this.http.get<{ data: EsEvent[] }>(`${this.BASE}/Event/upcoming`)
      .pipe(catchError(() => of({ data: [] as EsEvent[] })), takeUntil(this.destroy$))
      .subscribe(r => this.trendingEvents.set((r.data ?? []).filter(e => !ex.has(e.id)).slice(0, 20)));
  }

  private loadFollowing() {
    const ids = this.followSvc.followedIds();
    if (ids.length === 0) { this.followingEvents.set([]); return; }
    forkJoin(
      ids.map(id =>
        this.http.get<{ data: EsEvent[] }>(`${this.BASE}/Event/organization?organizationId=${id}`)
          .pipe(catchError(() => of({ data: [] as EsEvent[] })))
      )
    ).pipe(takeUntil(this.destroy$)).subscribe(res => {
      const seen = new Set<number>();
      const all  = (res as {data:EsEvent[]}[])
        .flatMap(r => r.data ?? [])
        .filter(e => !seen.has(e.id) && seen.add(e.id));
      this.followingEvents.set(all.sort((a, b) => +new Date(a.start_time??0) - +new Date(b.start_time??0)));
    });
  }

  private removeCategory(catId: number) {
    this.removingCatId.set(catId);
    if (this.activeFilter() === catId) this.activeFilter.set(null);
    const cur = this.auth.getSavedCategoryIds() ?? [];
    this.auth.saveCategoryIds(cur.filter(id => id !== catId));
    this.http.delete(`${this.BASE}/User/remove-favorite/${catId}`)
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.rows.update(r => r.filter(row => row.cat.id !== catId));
        setTimeout(() => this.removingCatId.set(null), 700);
      });
  }
}