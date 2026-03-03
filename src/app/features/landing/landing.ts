import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  afterNextRender,
  ChangeDetectionStrategy,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingNavbar } from '@core/layout/landing-navbar/landing-navbar';
import { DarkModeService } from '@core/services/darkmode.service';
import { ZardDialogService } from '@shared/components/dialog/dialog.service';
import { AuthDialog } from '@features/auth/auth-dialog/auth-dialog';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowRight,
  faCalendar,
  faLocationDot,
  faFire,
} from '@fortawesome/free-solid-svg-icons';

interface HeroStat    { num: string; label: string; }
interface NearbyEvent { title: string; distance: string; date: string; }
interface Step        { title: string; desc: string; }

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LandingNavbar, FontAwesomeModule],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preconnect" href="https://images.pexels.com" />
    <link rel="preconnect" href="https://i.pravatar.cc" />
    <link
      href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,700&family=DM+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />

    <div class="es-root">

      <!--
        Cursor: positioned ONLY via CSS custom props + transform.
        JS sets --cx/--cy on <html>. The elements sit at top:0 left:0
        and shift with translate3d() — pure Composite, zero Layout/Paint.
      -->
      <div id="esCursor"    class="es-cursor"     aria-hidden="true"></div>
      <div id="esCursorDot" class="es-cursor-dot" aria-hidden="true"></div>

      <app-landing-navbar class="fixed top-0 w-full z-50"></app-landing-navbar>

      <!-- ════ HERO ════ -->
      <section class="es-hero" aria-label="Hero">

        <div class="es-mesh" aria-hidden="true"></div>
        <div class="es-hero__watermark" aria-hidden="true">EVENTSORA</div>

        <div class="es-hero__inner max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">

          <!-- Left -->
          <div class="es-hero__left">
            <div class="es-pill es-anim-pill">
              <span class="es-pill__dot" aria-hidden="true"></span>
              <span>15,000+ live events across Egypt</span>
            </div>

            <h1 class="es-hero__h1">
              <span class="es-lmask"><span class="es-lword es-lword--1">DISCOVER</span></span>
              <span class="es-lmask"><span class="es-lword es-lword--stroke es-lword--2">EGYPT'S</span></span>
              <span class="es-lmask"><span class="es-lword es-lword--3">FINEST.</span></span>
            </h1>

            <p class="es-hero__desc es-anim-fade">
              The premium platform for creators &amp; communities — curated events
              in Cairo, Giza &amp; Alexandria.
            </p>

            <div class="es-hero__ctas es-anim-fade es-anim-fade--d1">
              <button class="es-btn-primary es-magnetic" (click)="handleHostEventClick()" aria-label="Start hosting events">
                <span>Start Hosting</span>
                <span class="es-btn-primary__icon" aria-hidden="true">
                  <fa-icon [icon]="faArrowRight"></fa-icon>
                </span>
              </button>
              <button class="es-btn-ghost" aria-label="Explore all events">Explore Events</button>
            </div>

            <div class="es-hero__stats es-anim-fade es-anim-fade--d2" aria-label="Platform statistics">
              <div class="es-stat" *ngFor="let s of heroStats">
                <span class="es-stat__num">{{ s.num }}</span>
                <span class="es-stat__label">{{ s.label }}</span>
              </div>
            </div>
          </div>

          <!-- Right -->
          <div class="es-hero__right es-anim-slide-right">

            <div class="es-hero__card" id="heroCard" role="img" aria-label="SOUNDSTORM Giza Edition event card">
              <img
                src="https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=900"
                alt="Large crowd at an outdoor concert under colourful lights"
                class="es-hero__card-img"
                width="420" height="560"
                fetchpriority="high"
                decoding="sync"
              />
              <div class="es-hero__card-overlay" aria-hidden="true">
                <span class="es-hero__card-tag">
                  <fa-icon [icon]="faFire"></fa-icon> Most Popular
                </span>
                <div>
                  <p class="es-hero__card-date">SAT — DEC 15, 2025</p>
                  <h2 class="es-hero__card-title">SOUNDSTORM<br/>Giza Edition</h2>
                  <div class="es-hero__card-meta">
                    <span><fa-icon [icon]="faLocationDot"></fa-icon> Near The Pyramids</span>
                    <span class="es-hero__card-price">EGP 1,500</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="es-float es-float--top" id="floatA" aria-label="2,400+ attending">
              <div class="es-float__avatars" aria-hidden="true">
                <img src="https://i.pravatar.cc/32?img=1" alt="" width="26" height="26" loading="lazy" decoding="async"/>
                <img src="https://i.pravatar.cc/32?img=2" alt="" width="26" height="26" loading="lazy" decoding="async"/>
                <img src="https://i.pravatar.cc/32?img=5" alt="" width="26" height="26" loading="lazy" decoding="async"/>
              </div>
              <div>
                <p class="es-float__num">2,400+</p>
                <p class="es-float__sub">Attending</p>
              </div>
            </div>

            <div class="es-float-ticket" id="floatB" aria-label="Sample ticket for Siwa Festival">
              <div class="es-float-ticket__left">
                <p class="es-float-ticket__label">YOUR TICKET</p>
                <p class="es-float-ticket__name">Siwa Festival</p>
                <p class="es-float-ticket__date">Dec 20 · Siwa Oasis</p>
              </div>
              <div class="es-float-ticket__sep" aria-hidden="true">
                <span class="es-float-ticket__notch es-float-ticket__notch--t"></span>
                <span class="es-float-ticket__notch es-float-ticket__notch--b"></span>
              </div>
              <div class="es-float-ticket__right" aria-hidden="true">
                <svg class="es-qr" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1"  y="1"  width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <rect x="3"  y="3"  width="3" height="3" fill="currentColor"/>
                  <rect x="12" y="1"  width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <rect x="14" y="3"  width="3" height="3" fill="currentColor"/>
                  <rect x="1"  y="12" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <rect x="3"  y="14" width="3" height="3" fill="currentColor"/>
                  <rect x="12" y="12" width="3" height="3" fill="currentColor"/>
                  <rect x="16" y="12" width="3" height="3" fill="currentColor"/>
                  <rect x="12" y="16" width="3" height="3" fill="currentColor"/>
                  <rect x="16" y="16" width="3" height="3" fill="currentColor"/>
                </svg>
              </div>
            </div>

          </div>
        </div>

        <div class="es-scroll-cue es-anim-fade es-anim-fade--d3" aria-hidden="true">
          <div class="es-scroll-cue__line"></div>
          <span>SCROLL</span>
        </div>

      </section>

      <!-- ════ MARQUEE ════ -->
      <div class="es-marquee-wrap" aria-hidden="true">
        <div class="es-marquee__track">
          <span *ngFor="let item of marqueeItems">{{ item }}</span>
        </div>
      </div>

      <!-- ════ FEATURED / BENTO ════ -->
      <section class="es-featured" aria-label="Featured Events">
        <div class="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
          <div class="es-section-head">
            <div>
              <div class="es-kicker"><span class="es-kicker__dot" aria-hidden="true"></span>Trending Now</div>
              <h2 class="es-section-h2 es-reveal">Events in<br/><em>Egypt Right Now</em></h2>
            </div>
            <a href="#" class="es-section-link es-reveal" aria-label="See all events">
              See all events <fa-icon [icon]="faArrowRight" aria-hidden="true"></fa-icon>
            </a>
          </div>
          <div class="es-bento" role="list">
            <article class="es-bento__card es-bento__card--a es-reveal" role="listitem">
              <div class="es-bento__img-wrap">
                <img src="https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg?auto=compress&cs=tinysrgb&w=1200"
                     alt="Outdoor concert with crowd and stage lighting"
                     class="es-bento__img" width="800" height="600" loading="lazy" decoding="async"/>
                <div class="es-bento__grad" aria-hidden="true"></div>
              </div>
              <div class="es-bento__body">
                <div class="es-bento__tags"><span class="es-tag es-tag--fire">🔥 Trending</span><span class="es-tag">Music</span></div>
                <h3 class="es-bento__title">SOUNDSTORM<br/>Giza Edition</h3>
                <div class="es-bento__foot">
                  <div class="es-bento__meta">
                    <span><fa-icon [icon]="faCalendar" aria-hidden="true"></fa-icon> Dec 15</span>
                    <span><fa-icon [icon]="faLocationDot" aria-hidden="true"></fa-icon> Near The Pyramids</span>
                  </div>
                  <span class="es-bento__price">EGP 1,500</span>
                </div>
              </div>
            </article>
            <article class="es-bento__card es-bento__card--b es-reveal" role="listitem">
              <div class="es-bento__img-wrap">
                <img src="https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&w=900"
                     alt="Desert landscape at sunset" class="es-bento__img" width="600" height="400" loading="lazy" decoding="async"/>
                <div class="es-bento__grad" aria-hidden="true"></div>
              </div>
              <div class="es-bento__body">
                <div class="es-bento__tags"><span class="es-tag">Culture</span></div>
                <h3 class="es-bento__title">Siwa Cultural<br/>Festival</h3>
                <div class="es-bento__foot">
                  <div class="es-bento__meta"><span><fa-icon [icon]="faCalendar" aria-hidden="true"></fa-icon> Dec 20</span></div>
                  <span class="es-bento__price">EGP 450</span>
                </div>
              </div>
            </article>
            <article class="es-bento__card es-bento__card--c es-reveal" role="listitem">
              <div class="es-bento__img-wrap">
                <img src="https://images.pexels.com/photos/1181400/pexels-photo-1181400.jpeg?auto=compress&cs=tinysrgb&w=900"
                     alt="Business conference room" class="es-bento__img" width="600" height="400" loading="lazy" decoding="async"/>
                <div class="es-bento__grad" aria-hidden="true"></div>
              </div>
              <div class="es-bento__body">
                <div class="es-bento__tags"><span class="es-tag">Conference</span></div>
                <h3 class="es-bento__title">Tech Leaders<br/>Summit</h3>
                <div class="es-bento__foot">
                  <div class="es-bento__meta"><span><fa-icon [icon]="faCalendar" aria-hidden="true"></fa-icon> Dec 25</span></div>
                  <span class="es-bento__price">EGP 999</span>
                </div>
              </div>
            </article>
            <article class="es-bento__card es-bento__card--d es-reveal" role="listitem">
              <div class="es-bento__img-wrap">
                <img src="https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=1200"
                     alt="Jazz musician on stage" class="es-bento__img" width="800" height="300" loading="lazy" decoding="async"/>
                <div class="es-bento__grad" aria-hidden="true"></div>
              </div>
              <div class="es-bento__body">
                <div class="es-bento__tags"><span class="es-tag es-tag--new">NEW</span><span class="es-tag">Jazz</span></div>
                <h3 class="es-bento__title">Nile Jazz Night</h3>
                <div class="es-bento__foot">
                  <div class="es-bento__meta">
                    <span><fa-icon [icon]="faCalendar" aria-hidden="true"></fa-icon> Every Friday</span>
                    <span><fa-icon [icon]="faLocationDot" aria-hidden="true"></fa-icon> Zamalek, Cairo</span>
                  </div>
                  <span class="es-bento__price">EGP 250</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- ════ NEARBY ════ -->
      <section class="es-nearby" id="nearbySection" aria-label="Nearby Events">
        <div class="es-nearby__head">
          <div class="es-kicker light"><span class="es-kicker__dot light" aria-hidden="true"></span>Near You</div>
          <h2 class="es-nearby__h2">DISCOVER<br/><em>NEARBY GEMS</em></h2>
          <p class="es-nearby__sub">Events within walking distance in Cairo</p>
        </div>
        <div class="es-nearby__track" id="nearbyTrack" role="list">
          <div class="es-nearby__spacer" aria-hidden="true"></div>
          <article *ngFor="let ev of nearbyEvents; let i = index" class="es-nearby__card" [attr.data-i]="i" role="listitem">
            <img *ngIf="i===0" loading="lazy" decoding="async" width="390" height="490" alt="Guided tour at Tahrir Square"
              src="https://images.pexels.com/photos/1692693/pexels-photo-1692693.jpeg?auto=compress&cs=tinysrgb&w=800" class="es-nearby__img"/>
            <img *ngIf="i===1" loading="lazy" decoding="async" width="390" height="490" alt="Rooftop jazz in Zamalek"
              src="https://images.pexels.com/photos/248797/pexels-photo-248797.jpeg?auto=compress&cs=tinysrgb&w=800" class="es-nearby__img"/>
            <img *ngIf="i===2" loading="lazy" decoding="async" width="390" height="490" alt="Night walk at Khan el-Khalili"
              src="https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=800" class="es-nearby__img"/>
            <img *ngIf="i===3" loading="lazy" decoding="async" width="390" height="490" alt="Food tasting in Old Cairo"
              src="https://images.pexels.com/photos/460740/pexels-photo-460740.jpeg?auto=compress&cs=tinysrgb&w=800" class="es-nearby__img"/>
            <img *ngIf="i===4" loading="lazy" decoding="async" width="390" height="490" alt="Felucca on the Nile at sunset"
              src="https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=800" class="es-nearby__img"/>
            <div class="es-nearby__overlay">
              <span class="es-nearby__badge">{{ ev.distance }} Away</span>
              <div class="es-nearby__info">
                <span class="es-nearby__date">{{ ev.date }}</span>
                <h3 class="es-nearby__title">{{ ev.title }}</h3>
                <button class="es-nearby__link" [attr.aria-label]="'Explore ' + ev.title">
                  Explore <fa-icon [icon]="faArrowRight" aria-hidden="true"></fa-icon>
                </button>
              </div>
            </div>
            <span class="es-nearby__num" aria-hidden="true">0{{ i + 1 }}</span>
          </article>
          <div class="es-nearby__spacer-sm" aria-hidden="true"></div>
        </div>
      </section>

      <!-- ════ STEPS ════ -->
      <section class="es-steps" aria-label="How it works">
        <div class="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
          <div class="es-steps__grid">
            <div class="es-step es-reveal" *ngFor="let s of steps; let i = index">
              <span class="es-step__num" aria-hidden="true">0{{ i + 1 }}</span>
              <h3 class="es-step__title">{{ s.title }}</h3>
              <p class="es-step__desc">{{ s.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ════ CTA ════ -->
      <section class="es-cta" id="ctaSection" aria-label="Call to action">
        <div id="ctaBg" class="es-cta__bg" aria-hidden="true"></div>
        <div class="es-cta__glow" aria-hidden="true"></div>
        <div class="es-cta__inner max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 text-center">
          <div class="es-kicker gold es-reveal justify-center mb-4">
            <span class="es-kicker__dot gold" aria-hidden="true"></span>Get Started Today
          </div>
          <h2 class="es-cta__h2 es-reveal">Your Event<br/><em>Starts Now.</em></h2>
          <p class="es-cta__sub es-reveal">
            Join Egypt's most vibrant community of event creators and<br class="hidden md:block"/>
            bring unforgettable experiences to life.
          </p>
          <div class="es-cta__actions es-reveal">
            <button class="es-btn-primary es-btn-primary--light es-magnetic" (click)="handleHostEventClick()" aria-label="Create your event">
              <span>Create Your Event</span>
              <span class="es-btn-primary__icon" aria-hidden="true"><fa-icon [icon]="faArrowRight"></fa-icon></span>
            </button>
            <span class="es-cta__note">Free to start · No credit card required</span>
          </div>
        </div>
      </section>

      <!-- ════ FOOTER ════ -->
      <footer class="es-footer">
        <div class="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
          <div class="es-footer__top">
            <div>
              <span class="es-footer__logo">Eventsora</span>
              <p class="es-footer__tagline">Egypt's Premier Events Platform</p>
            </div>
            <nav class="es-footer__nav" aria-label="Footer navigation">
              <a href="#">Discover</a><a href="#">Host Events</a>
              <a href="#">Pricing</a><a href="#">About</a><a href="#">Blog</a>
            </nav>
          </div>
          <div class="es-footer__bottom">
            <span>© {{ currentYear }} Eventsora. All rights reserved.</span>
            <div class="es-footer__legal">
              <a href="#">Terms</a><a href="#">Privacy</a><a href="#">Support</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  `,
  styles: [`
:host {
  --bg:        #060608;
  --bg2:       #0c0c10;
  --coral:     #FF4433;
  --coral-dim: rgba(255,68,51,.12);
  --gold:      #F0B429;
  --text:      #F2EEE6;
  --muted:     rgba(242,238,230,.42);
  --border:    rgba(242,238,230,.08);
  --r:         18px;
  --fd: 'Bebas Neue', sans-serif;
  --fb: 'Plus Jakarta Sans', sans-serif;
  --fm: 'DM Mono', monospace;
  display: block;
}
*,*::before,*::after { box-sizing: border-box; }
.es-root { background:var(--bg); color:var(--text); font-family:var(--fb); overflow-x:hidden; min-height:100vh; cursor:none; }

/* ─────────────────────────────────────────
   CURSOR — composite-only, zero layout/paint
   Anchored at top:0 left:0 permanently.
   Only transform changes → GPU composite only.
   CSS custom props --cx/--cy set by JS RAF loop.
───────────────────────────────────────── */
.es-cursor,.es-cursor-dot { display:none; }
@media (pointer:fine) {
  * { cursor:none; }
  .es-cursor {
    display:block; position:fixed; top:0; left:0; z-index:9999;
    width:36px; height:36px;
    border:1.5px solid rgba(255,68,51,.55); border-radius:50%;
    pointer-events:none; will-change:transform;
    transform:translate3d(calc(var(--cx,-200px) - 50%), calc(var(--cy,-200px) - 50%), 0);
    transition:border-color .3s, scale .2s;
  }
  .es-cursor.is-hovered { scale:1.6; border-color:rgba(255,68,51,.9); }
  .es-cursor-dot {
    display:block; position:fixed; top:0; left:0; z-index:9999;
    width:6px; height:6px; background:var(--coral); border-radius:50%;
    pointer-events:none; will-change:transform;
    transform:translate3d(calc(var(--dx,-200px) - 50%), calc(var(--dy,-200px) - 50%), 0);
  }
}

/* ─────────────────────────────────────────
   MESH — static orbs, NO CSS animation.
   filter:blur on a CSS-animated element forces
   GPU re-blur every frame → 60fps blur = lag.
   Orbs are static; JS nudges them on mousemove
   via a RAF-gated GSAP tween (overwrite:auto).
───────────────────────────────────────── */
/* Mesh: pure radial-gradient, NO filter:blur.
   filter:blur on a large element forces GPU re-compositing on every
   scroll tick even when the element is static. At 55vw + 90px blur on
   integrated graphics this causes visible jank. Radial gradients with
   alpha falloff look identical and run at zero GPU cost. */
.es-mesh {
  position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden;
  background:
    radial-gradient(ellipse 55vw 55vw at -5% -10%,  rgba(255,68,51,.13)   0%, transparent 70%),
    radial-gradient(ellipse 45vw 45vw at 105% 40%,  rgba(240,180,41,.08)  0%, transparent 70%),
    radial-gradient(ellipse 65vw 50vw at 40% 110%,  rgba(40,20,80,.2)     0%, transparent 70%);
}

/* ─────────────────────────────────────────
   CSS ENTRANCE ANIMATIONS (no GSAP above fold)
───────────────────────────────────────── */
@keyframes fadeUp  { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideIn { from{opacity:0;transform:translateX(60px)}  to{opacity:1;transform:translateX(0)} }
@keyframes lWordIn { from{transform:translateY(110%)}             to{transform:translateY(0)} }

.es-lword { display:block; transform:translateY(110%); animation:lWordIn 1.5s cubic-bezier(.16,1,.3,1) forwards; }
.es-lword--1 { animation-delay:.10s; }
.es-lword--2 { animation-delay:.28s; }
.es-lword--3 { animation-delay:.46s; }
.es-anim-pill        { opacity:0; animation:fadeUp  .9s ease           forwards .05s; }
.es-anim-fade        { opacity:0; animation:fadeUp  .85s ease          forwards .70s; }
.es-anim-fade--d1    { animation-delay:.85s; }
.es-anim-fade--d2    { animation-delay:1.0s; }
.es-anim-fade--d3    { animation-delay:1.35s;}
.es-anim-slide-right { opacity:0; animation:slideIn 1.1s cubic-bezier(.16,1,.3,1) forwards .55s; }
#floatA { opacity:0; animation:fadeUp .7s cubic-bezier(.34,1.56,.64,1) forwards 1.25s; }
#floatB { opacity:0; animation:fadeUp .7s cubic-bezier(.34,1.56,.64,1) forwards 1.10s; }

/* Scroll reveal */
.es-reveal { opacity:0; transform:translateY(36px); transition:opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
.es-reveal.is-visible { opacity:1; transform:translateY(0); }

/* ─────────────────────────────────────────
   HERO
───────────────────────────────────────── */
.es-hero { position:relative; min-height:100svh; display:flex; flex-direction:column; justify-content:center; padding:7rem 0 5rem; overflow:hidden; }
.es-hero__watermark {
  position:absolute; bottom:-4vw; left:50%; transform:translateX(-50%);
  font-family:var(--fd); font-size:clamp(5rem,18vw,22rem);
  letter-spacing:.06em; color:transparent; -webkit-text-stroke:1px rgba(242,238,230,.04);
  white-space:nowrap; pointer-events:none; user-select:none; z-index:0;
}
.es-hero__inner { position:relative; z-index:2; display:grid; grid-template-columns:1fr; gap:3rem; align-items:center; }
@media(min-width:1024px){ .es-hero__inner{ grid-template-columns:1fr 1fr; gap:4rem; } }

.es-pill {
  display:inline-flex; align-items:center; gap:9px;
  padding:7px 18px 7px 10px;
  background:rgba(255,255,255,.04); border:1px solid var(--border); border-radius:100px;
  font-family:var(--fm); font-size:.72rem; letter-spacing:.06em; color:var(--muted);
  background:rgba(12,12,16,.82); margin-bottom:1.75rem; width:fit-content;
}
.es-pill__dot {
  display:inline-block; width:7px; height:7px; border-radius:50%; background:#22d662;
  box-shadow:0 0 8px #22d662; flex-shrink:0; animation:pg 2.2s infinite;
}
@keyframes pg {
  0%,100%{ box-shadow:0 0 6px #22d662; transform:scale(.9); }
  50%    { box-shadow:0 0 14px #22d662; transform:scale(1.1); }
}
.es-hero__h1 { font-family:var(--fd); font-size:clamp(4.5rem,11vw,10rem); line-height:.92; letter-spacing:.01em; margin:0 0 2rem; display:flex; flex-direction:column; }
.es-lmask { overflow:hidden; display:block; }
.es-lword--stroke { color:transparent; -webkit-text-stroke:2px var(--coral); }
.es-hero__desc { font-size:clamp(.9rem,1.5vw,1.1rem); color:var(--muted); line-height:1.75; margin-bottom:2.25rem; font-weight:300; }
.es-hero__ctas { display:flex; flex-wrap:wrap; gap:1rem; margin-bottom:2.75rem; }

.es-btn-primary {
  display:inline-flex; align-items:center; gap:10px;
  padding:.85rem 1.75rem; background:var(--coral); color:#fff;
  border:none; border-radius:100px;
  font-family:var(--fb); font-weight:700; font-size:.9rem; letter-spacing:.02em;
  cursor:none; position:relative; overflow:hidden;
  transition:box-shadow .3s, transform .2s;
  box-shadow:0 0 30px rgba(255,68,51,.3);
}
.es-btn-primary::before {
  content:''; position:absolute; inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.14) 0%,transparent 55%);
  border-radius:inherit; pointer-events:none;
}
.es-btn-primary:hover { box-shadow:0 0 55px rgba(255,68,51,.5); transform:translateY(-2px); }
.es-btn-primary:focus-visible { outline:2px solid var(--coral); outline-offset:4px; }
.es-btn-primary--light { background:var(--text); color:var(--bg); box-shadow:0 0 30px rgba(242,238,230,.15); }
.es-btn-primary--light:hover { box-shadow:0 0 55px rgba(242,238,230,.3); }
.es-btn-primary__icon {
  display:flex; align-items:center; justify-content:center;
  width:26px; height:26px; background:rgba(255,255,255,.2); border-radius:50%;
  font-size:.75rem; flex-shrink:0; transition:transform .25s;
}
.es-btn-primary:hover .es-btn-primary__icon { transform:rotate(45deg); }
.es-btn-ghost {
  display:inline-flex; align-items:center;
  padding:.85rem 1.75rem; background:transparent; color:var(--text);
  border:1px solid var(--border); border-radius:100px;
  font-family:var(--fb); font-weight:500; font-size:.9rem;
  cursor:none; transition:border-color .25s, background .25s;
}
.es-btn-ghost:hover { border-color:rgba(255,68,51,.4); background:var(--coral-dim); color:#ff7060; }
.es-btn-ghost:focus-visible { outline:2px solid var(--coral); outline-offset:4px; }

.es-hero__stats { display:flex; gap:1.75rem; flex-wrap:wrap; padding-top:2rem; border-top:1px solid var(--border); }
.es-stat { display:flex; flex-direction:column; gap:3px; }
.es-stat__num   { font-family:var(--fd); font-size:2rem; color:var(--coral); line-height:1; letter-spacing:.04em; }
.es-stat__label { font-size:.65rem; text-transform:uppercase; letter-spacing:.12em; color:var(--muted); }

.es-hero__right { position:relative; display:flex; justify-content:center; }
.es-hero__card  { position:relative; width:100%; max-width:420px; aspect-ratio:3/4; border-radius:24px; overflow:hidden; border:1px solid var(--border); contain:layout; }
.es-hero__card-img { width:100%; height:100%; object-fit:cover; transition:transform .6s; display:block; }
.es-hero__card:hover .es-hero__card-img { transform:scale(1.05); }
.es-hero__card-overlay {
  position:absolute; inset:0; padding:1.5rem;
  display:flex; flex-direction:column; justify-content:space-between;
  background:linear-gradient(to top, rgba(6,6,8,.92) 0%, rgba(6,6,8,.22) 50%, transparent 100%);
}
.es-hero__card-tag {
  display:inline-flex; align-items:center; gap:6px; width:fit-content;
  padding:5px 14px; background:var(--coral); color:#fff;
  border-radius:100px; font-size:.7rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
}
.es-hero__card-date  { font-family:var(--fm); font-size:.68rem; letter-spacing:.12em; color:var(--muted); margin-bottom:.4rem; }
.es-hero__card-title { font-family:var(--fd); font-size:clamp(1.8rem,4vw,2.5rem); line-height:.95; color:#fff; margin:0 0 .75rem; }
.es-hero__card-meta  { display:flex; align-items:center; justify-content:space-between; font-size:.76rem; color:rgba(255,255,255,.58); gap:8px; flex-wrap:wrap; }
.es-hero__card-meta fa-icon { margin-right:4px; }
.es-hero__card-price { font-family:var(--fm); font-size:.8rem; color:var(--gold); white-space:nowrap; }

/* Floaters — no backdrop-filter (GPU cost); solid bg instead */
.es-float {
  position:absolute; display:flex; align-items:center; gap:10px;
  padding:10px 16px; background:rgba(12,12,16,.95);
  border:1px solid var(--border); border-radius:100px;
  box-shadow:0 16px 40px rgba(0,0,0,.45);
}
.es-float--top { top:1.5rem; right:-.75rem; }
@media(min-width:1024px){ .es-float--top{ right:-1.75rem; } }
.es-float__avatars { display:flex; }
.es-float__avatars img { width:26px; height:26px; border-radius:50%; border:2px solid var(--bg2); margin-left:-8px; object-fit:cover; }
.es-float__avatars img:first-child { margin-left:0; }
.es-float__num { font-family:var(--fd); font-size:1.1rem; color:var(--coral); line-height:1; letter-spacing:.04em; }
.es-float__sub { font-size:.63rem; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); }
.es-float-ticket {
  position:absolute; bottom:1.25rem; left:-.75rem;
  display:flex; align-items:center; background:rgba(12,12,16,.97);
  border:1px solid var(--border); border-radius:14px; overflow:hidden;
  box-shadow:0 16px 40px rgba(0,0,0,.45); min-width:205px;
}
@media(min-width:1024px){ .es-float-ticket{ left:-1.75rem; } }
.es-float-ticket__left   { padding:13px 15px; }
.es-float-ticket__label  { font-family:var(--fm); font-size:.57rem; letter-spacing:.14em; color:var(--muted); margin-bottom:3px; }
.es-float-ticket__name   { font-family:var(--fd); font-size:1.1rem; letter-spacing:.04em; color:var(--text); line-height:1.1; }
.es-float-ticket__date   { font-size:.63rem; color:var(--muted); margin-top:2px; }
.es-float-ticket__sep    { position:relative; width:1px; align-self:stretch; background:var(--border); flex-shrink:0; }
.es-float-ticket__notch  { position:absolute; left:50%; transform:translateX(-50%); width:11px; height:11px; border-radius:50%; background:var(--bg); border:1px solid var(--border); }
.es-float-ticket__notch--t { top:-5.5px; }
.es-float-ticket__notch--b { bottom:-5.5px; }
.es-float-ticket__right  { padding:13px 15px; }
.es-qr { width:42px; height:42px; color:var(--coral); opacity:.85; }

.es-scroll-cue { position:absolute; bottom:2rem; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:7px; z-index:3; }
.es-scroll-cue__line { width:1px; height:48px; background:linear-gradient(to bottom, var(--coral), transparent); animation:sc 2.2s ease-in-out infinite; }
.es-scroll-cue span { font-family:var(--fm); font-size:.58rem; letter-spacing:.22em; color:var(--muted); }
@keyframes sc { 0%,100%{opacity:.3;transform:scaleY(.7);transform-origin:top} 50%{opacity:1;transform:scaleY(1)} }

/* ─────────────────────────────────────────
   MARQUEE
───────────────────────────────────────── */
.es-marquee-wrap { overflow:hidden; background:var(--coral); padding:9px 0; border-top:1px solid rgba(255,255,255,.1); border-bottom:1px solid rgba(255,255,255,.1); }
.es-marquee__track { display:flex; white-space:nowrap; animation:mq 30s linear infinite; width:max-content; }
.es-marquee__track span { font-family:var(--fd); font-size:.85rem; letter-spacing:.1em; color:rgba(255,255,255,.9); padding:0 2rem; text-transform:uppercase; }
.es-marquee__track span::after { content:'◆'; margin-left:2rem; opacity:.45; }
@keyframes mq { from{transform:translateX(0)} to{transform:translateX(-50%)} }

/* ─────────────────────────────────────────
   FEATURED / BENTO
───────────────────────────────────────── */
.es-featured { padding:6.5rem 0; }
.es-section-head { display:flex; flex-direction:column; gap:1rem; margin-bottom:3.5rem; }
@media(min-width:768px){ .es-section-head{ flex-direction:row; align-items:flex-end; justify-content:space-between; } }
.es-kicker { display:inline-flex; align-items:center; gap:8px; font-family:var(--fm); font-size:.68rem; letter-spacing:.15em; text-transform:uppercase; color:var(--coral); margin-bottom:.75rem; }
.es-kicker.light { color:var(--muted); }
.es-kicker.gold  { color:var(--gold);  }
.es-kicker__dot  { width:5px; height:5px; border-radius:50%; background:var(--coral); flex-shrink:0; }
.es-kicker__dot.light { background:var(--muted); }
.es-kicker__dot.gold  { background:var(--gold);  }
.es-section-h2 { font-family:var(--fd); font-size:clamp(2.5rem,5.5vw,5rem); line-height:1; letter-spacing:.02em; color:var(--text); margin:0; }
.es-section-h2 em { font-style:italic; color:var(--coral); }
.es-section-link { display:inline-flex; align-items:center; gap:7px; font-size:.8rem; font-weight:600; color:var(--muted); text-decoration:none; letter-spacing:.04em; transition:color .2s; align-self:flex-start; }
.es-section-link:hover { color:var(--coral); }
.es-section-link:focus-visible { outline:2px solid var(--coral); outline-offset:4px; border-radius:4px; }
@media(min-width:768px){ .es-section-link{ align-self:auto; } }

.es-bento { display:grid; gap:1.1rem; grid-template-areas:"a" "b" "c" "d"; }
@media(min-width:600px)  { .es-bento{ grid-template-columns:1fr 1fr; grid-template-areas:"a a" "b c" "d d"; } }
@media(min-width:1024px) { .es-bento{ grid-template-columns:2fr 1fr 1fr; grid-template-rows:auto auto; grid-template-areas:"a b c" "a d d"; } }
.es-bento__card--a { grid-area:a; min-height:520px; }
.es-bento__card--b { grid-area:b; min-height:260px; }
.es-bento__card--c { grid-area:c; min-height:260px; }
.es-bento__card--d { grid-area:d; min-height:190px; }
@media(max-width:599px){ .es-bento__card--a,.es-bento__card--b,.es-bento__card--c,.es-bento__card--d{ min-height:280px; } }
.es-bento__card { position:relative; border-radius:var(--r); overflow:hidden; border:1px solid var(--border); cursor:none; transition:border-color .35s; contain:layout; }
.es-bento__card:hover { border-color:rgba(255,68,51,.35); }
.es-bento__img-wrap { position:absolute; inset:0; }
.es-bento__img { width:100%; height:100%; object-fit:cover; transition:transform .7s cubic-bezier(.25,.46,.45,.94); display:block; }
.es-bento__card:hover .es-bento__img { transform:scale(1.065); }
.es-bento__grad { position:absolute; inset:0; background:linear-gradient(to top, rgba(6,6,8,.93) 0%, rgba(6,6,8,.28) 50%, transparent 100%); }
.es-bento__body { position:absolute; inset:0; padding:1.25rem 1.5rem; display:flex; flex-direction:column; justify-content:flex-end; }
.es-bento__tags { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:.65rem; }
.es-tag { display:inline-block; padding:3px 10px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1); border-radius:100px; font-size:.63rem; font-weight:600; text-transform:uppercase; letter-spacing:.1em; color:rgba(255,255,255,.65); }
.es-tag--fire { background:rgba(255,68,51,.18); border-color:rgba(255,68,51,.3); color:#ff7060; }
.es-tag--new  { background:rgba(240,180,41,.14); border-color:rgba(240,180,41,.28); color:var(--gold); }
.es-bento__title { font-family:var(--fd); font-size:clamp(1.5rem,3.2vw,2.6rem); line-height:.95; letter-spacing:.02em; color:#fff; margin:0 0 .9rem; }
.es-bento__card--d .es-bento__title { font-size:clamp(1.3rem,2.3vw,2rem); }
.es-bento__foot { display:flex; align-items:flex-end; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.es-bento__meta { display:flex; flex-direction:column; gap:3px; font-size:.75rem; color:rgba(255,255,255,.48); }
.es-bento__meta fa-icon { margin-right:5px; opacity:.7; }
.es-bento__price { font-family:var(--fm); font-size:.84rem; font-weight:500; color:var(--gold); white-space:nowrap; padding:4px 12px; background:rgba(240,180,41,.1); border:1px solid rgba(240,180,41,.2); border-radius:100px; }

/* ─────────────────────────────────────────
   NEARBY
───────────────────────────────────────── */
.es-nearby { position:relative; min-height:100svh; background:var(--bg2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); display:flex; flex-direction:column; justify-content:center; overflow:hidden; }
.es-nearby__head { position:absolute; top:3rem; left:clamp(1.25rem,5vw,3rem); z-index:10; }
.es-nearby__h2 { font-family:var(--fd); font-size:clamp(2.8rem,7vw,7rem); line-height:.92; color:var(--text); margin:0; }
.es-nearby__h2 em { font-style:italic; color:var(--coral); }
.es-nearby__sub { font-size:.8rem; color:var(--muted); margin-top:.6rem; }
.es-nearby__track { display:flex; gap:1.1rem; align-items:center; width:max-content; padding:0 1.5rem; will-change:transform; }
.es-nearby__spacer    { width:clamp(18vw,30vw,40vw); flex-shrink:0; }
.es-nearby__spacer-sm { width:5vw; flex-shrink:0; }
.es-nearby__card { position:relative; width:min(390px,82vw); height:min(490px,62vh); border-radius:20px; overflow:hidden; flex-shrink:0; border:1px solid var(--border); cursor:none; transition:border-color .35s; contain:layout; }
.es-nearby__card:hover { border-color:rgba(255,68,51,.35); }
.es-nearby__img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform .6s; display:block; }
.es-nearby__card:hover .es-nearby__img { transform:scale(1.05); }
.es-nearby__overlay { position:absolute; inset:0; padding:1.25rem 1.5rem; display:flex; flex-direction:column; justify-content:space-between; background:linear-gradient(to top, rgba(6,6,8,.88) 0%, transparent 50%); color:#fff; }
.es-nearby__badge { display:inline-block; width:fit-content; padding:5px 12px; background:rgba(6,6,8,.65); border:1px solid rgba(255,255,255,.12); border-radius:100px; font-family:var(--fm); font-size:.66rem; letter-spacing:.1em; text-transform:uppercase; }
.es-nearby__date  { font-family:var(--fm); font-size:.66rem; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.48); margin-bottom:3px; display:block; }
.es-nearby__title { font-family:var(--fd); font-size:clamp(1.7rem,3.5vw,2.3rem); letter-spacing:.02em; margin:0 0 .65rem; line-height:.95; }
.es-nearby__link  { display:inline-flex; align-items:center; gap:6px; font-size:.78rem; font-weight:700; color:var(--coral); background:none; border:none; padding:0; cursor:none; font-family:var(--fb); letter-spacing:.04em; transition:gap .2s; }
.es-nearby__link:hover { gap:10px; }
.es-nearby__link:focus-visible { outline:2px solid var(--coral); outline-offset:4px; border-radius:4px; }
.es-nearby__num { position:absolute; top:1.25rem; right:1.25rem; font-family:var(--fd); font-size:3.5rem; color:rgba(255,255,255,.05); line-height:1; pointer-events:none; user-select:none; }

/* ─────────────────────────────────────────
   STEPS
───────────────────────────────────────── */
.es-steps { padding:7rem 0; border-top:1px solid var(--border); }
.es-steps__grid { display:grid; grid-template-columns:1fr; gap:3rem; }
@media(min-width:768px){ .es-steps__grid{ grid-template-columns:1fr 1fr 1fr; gap:2rem; } }
.es-step        { display:flex; flex-direction:column; gap:.9rem; }
.es-step__num   { font-family:var(--fd); font-size:3.5rem; color:var(--coral); opacity:.55; line-height:1; letter-spacing:.04em; }
.es-step__title { font-family:var(--fd); font-size:1.55rem; letter-spacing:.04em; color:var(--text); margin:0; line-height:1.1; }
.es-step__desc  { font-size:.86rem; color:var(--muted); line-height:1.75; margin:0; font-weight:300; }

/* ─────────────────────────────────────────
   CTA
───────────────────────────────────────── */
.es-cta { position:relative; padding:9rem 0; overflow:hidden; border-top:1px solid var(--border); }
.es-cta__bg { position:absolute; inset:0; background:linear-gradient(135deg, rgba(255,68,51,.07) 0%, rgba(240,180,41,.04) 100%); transform:scaleY(0); transform-origin:bottom; transition:transform 1.3s cubic-bezier(.16,1,.3,1); }
.es-cta__bg.is-visible { transform:scaleY(1); }
.es-cta__glow { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:600px; height:600px; background:radial-gradient(circle, rgba(255,68,51,.06) 0%, transparent 65%); pointer-events:none; }
.es-cta__inner { position:relative; z-index:2; }
.es-cta__h2 { font-family:var(--fd); font-size:clamp(4rem,10vw,9.5rem); line-height:.9; letter-spacing:.02em; color:var(--text); margin:.75rem 0 1.4rem; }
.es-cta__h2 em { font-style:italic; color:var(--coral); }
.es-cta__sub { font-size:clamp(.88rem,1.5vw,1.05rem); color:var(--muted); line-height:1.75; margin-bottom:3rem; font-weight:300; }
.es-cta__actions { display:flex; flex-direction:column; align-items:center; gap:1.1rem; }
.es-cta__note { font-family:var(--fm); font-size:.64rem; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }

/* ─────────────────────────────────────────
   FOOTER
───────────────────────────────────────── */
.es-footer { border-top:1px solid var(--border); padding:2.75rem 0; background:var(--bg2); }
.es-footer__top { display:flex; flex-direction:column; gap:2rem; margin-bottom:2.25rem; }
@media(min-width:768px){ .es-footer__top{ flex-direction:row; align-items:flex-start; justify-content:space-between; } }
.es-footer__logo    { display:block; font-family:var(--fd); font-size:1.9rem; letter-spacing:.06em; color:var(--text); margin-bottom:3px; }
.es-footer__tagline { font-family:var(--fm); font-size:.62rem; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin:0; }
.es-footer__nav     { display:flex; flex-wrap:wrap; gap:1.25rem 1.75rem; align-items:center; }
.es-footer__nav a   { font-size:.82rem; color:var(--muted); text-decoration:none; letter-spacing:.03em; transition:color .2s; }
.es-footer__nav a:hover { color:var(--coral); }
.es-footer__nav a:focus-visible { outline:2px solid var(--coral); outline-offset:4px; border-radius:4px; }
.es-footer__bottom { display:flex; flex-direction:column; gap:.75rem; padding-top:2rem; border-top:1px solid var(--border); font-family:var(--fm); font-size:.66rem; letter-spacing:.08em; color:var(--muted); text-transform:uppercase; }
@media(min-width:640px){ .es-footer__bottom{ flex-direction:row; justify-content:space-between; align-items:center; } }
.es-footer__legal   { display:flex; gap:1.5rem; }
.es-footer__legal a { color:var(--muted); text-decoration:none; transition:color .2s; }
.es-footer__legal a:hover { color:var(--coral); }
.es-footer__legal a:focus-visible { outline:2px solid var(--coral); outline-offset:4px; border-radius:4px; }

/* ─────────────────────────────────────────
   REDUCED MOTION
───────────────────────────────────────── */
@media (prefers-reduced-motion:reduce) {
  .es-lword, .es-anim-pill, .es-anim-fade, .es-anim-slide-right,
  #floatA, #floatB, .es-scroll-cue__line, .es-pill__dot, .es-marquee__track {
    animation:none !important; opacity:1 !important;
    transform:none !important; transition:none !important;
  }
  .es-reveal { opacity:1; transform:none; transition:none; }
  .es-cta__bg.is-visible { transition:none; }
}
  `],
})
export class LandingComponent implements OnInit, OnDestroy {

  private readonly darkmodeService = inject(DarkModeService);
  private readonly dialogService   = inject(ZardDialogService);
  private readonly platformId      = inject(PLATFORM_ID);
  private readonly ngZone          = inject(NgZone);

  readonly faArrowRight  = faArrowRight;
  readonly faCalendar    = faCalendar;
  readonly faLocationDot = faLocationDot;
  readonly faFire        = faFire;

  readonly currentYear = new Date().getFullYear();

  readonly heroStats: HeroStat[] = [
    { num: '15K+',  label: 'Live Events'  },
    { num: '350K+', label: 'Attendees'    },
    { num: '3.2K+', label: 'Organizers'   },
    { num: '4.9★',  label: 'Avg. Rating'  },
  ];

  readonly marqueeItems: string[] = [
    '● SOUNDSTORM GIZA','● SIWA CULTURAL FESTIVAL','● NILE JAZZ NIGHT',
    '● TECH SUMMIT CAIRO','● KHAN EL-KHALILI NIGHT WALK','● ZAMALEK ROOFTOP JAZZ',
    '● OLD CAIRO FOOD TASTING','● RED SEA DIVING TRIP',
    '● SOUNDSTORM GIZA','● SIWA CULTURAL FESTIVAL','● NILE JAZZ NIGHT',
    '● TECH SUMMIT CAIRO','● KHAN EL-KHALILI NIGHT WALK','● ZAMALEK ROOFTOP JAZZ',
    '● OLD CAIRO FOOD TASTING','● RED SEA DIVING TRIP',
  ];

  readonly nearbyEvents: NearbyEvent[] = [
    { title: 'Tahrir Square Guided Tour',  distance: '0.5 km', date: 'TONIGHT'     },
    { title: 'Zamalek Rooftop Jazz',       distance: '1.2 km', date: 'SAT · 8 PM' },
    { title: 'Khan el-Khalili Night Walk', distance: '2.5 km', date: 'SUNDAY'      },
    { title: 'Old Cairo Food Tasting',     distance: '3.1 km', date: 'FRIDAY'      },
    { title: 'Nile Felucca Sunset Ride',   distance: '5.0 km', date: 'DAILY'       },
  ];

  readonly steps: Step[] = [
    { title: 'CREATE YOUR EVENT',    desc: 'Set up your event page in minutes — add details, photos, and ticket tiers tailored to your audience.' },
    { title: 'REACH YOUR AUDIENCE',  desc: 'Eventsora surfaces your event to thousands across Cairo, Giza, and Alexandria automatically.'          },
    { title: 'SELL & MANAGE EASILY', desc: 'Track attendance, manage check-ins, and get paid — all from one beautiful dashboard.'                  },
  ];

  isUserLoggedIn = false;

  // ── Private state (never touches Angular CD)
  private gsapCtx: { revert(): void } | null = null;
  private revealObserver: IntersectionObserver | null = null;
  private ctaObserver: IntersectionObserver | null = null;
  private cursorRafId = 0;
  private mouseX = -200; private mouseY = -200;
  private cursorX = -200; private cursorY = -200;

  ngOnInit(): void { this.darkmodeService.initTheme(); }

  constructor() {
    afterNextRender(() => {
      // Everything outside Angular zone → zero extra change-detection runs
      this.ngZone.runOutsideAngular(() => {
        this.initCursor();
        this.initRevealObserver();
        this.initCtaObserver();
        this.lazyInitGsap();
      });
    });
  }

  ngOnDestroy(): void {
    this.gsapCtx?.revert();
    this.revealObserver?.disconnect();
    this.ctaObserver?.disconnect();
    cancelAnimationFrame(this.cursorRafId);
  }

  handleHostEventClick(): void {
    if (this.isUserLoggedIn) {
      // redirect to event creation
    } else {
      this.dialogService.create({ zContent: AuthDialog, zWidth: '425px' });
    }
  }

  // ══════════════════════════════════════════════════════
  // CURSOR
  // Key fix: write --cx/--cy to document.documentElement
  // (CSS custom property). The elements read them via
  // translate3d(calc(var(--cx) - 50%), ...). Setting a
  // custom property only schedules a Composite update —
  // the browser never has to recalculate layout or paint.
  // Previous code used `el.style.left = ...` which is
  // Layout → Paint → Composite on every RAF tick.
  // ══════════════════════════════════════════════════════
  private initCursor(): void {
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const cursor    = document.getElementById('esCursor');
    const cursorDot = document.getElementById('esCursorDot');
    if (!cursor || !cursorDot) return;

    const root = document.documentElement;

    window.addEventListener('mousemove', (e: MouseEvent) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    }, { passive: true });

    const hoverSel = 'button, a, .es-bento__card, .es-nearby__card, .es-hero__card';
    document.querySelectorAll<HTMLElement>(hoverSel).forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-hovered'),    { passive: true });
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-hovered'), { passive: true });
    });

    // Only write CSS props when cursor moved — skips DOM writes while idle
    let prevCx = -200, prevDx = -200;
    const tick = () => {
      this.cursorX += (this.mouseX - this.cursorX) * 0.18;
      this.cursorY += (this.mouseY - this.cursorY) * 0.18;
      if (Math.abs(this.cursorX - prevCx) > 0.04) {
        prevCx = this.cursorX;
        root.style.setProperty('--cx', `${this.cursorX}px`);
        root.style.setProperty('--cy', `${this.cursorY}px`);
      }
      if (this.mouseX !== prevDx) {
        prevDx = this.mouseX;
        root.style.setProperty('--dx', `${this.mouseX}px`);
        root.style.setProperty('--dy', `${this.mouseY}px`);
      }
      this.cursorRafId = requestAnimationFrame(tick);
    };
    this.cursorRafId = requestAnimationFrame(tick);
  }

  // ══════════════════════════════════════════════════════
  // SCROLL REVEAL — IntersectionObserver (no GSAP needed)
  // ══════════════════════════════════════════════════════
  private initRevealObserver(): void {
    this.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, idx) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.style.transitionDelay = `${idx * 75}ms`;
          el.classList.add('is-visible');
          this.revealObserver!.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('.es-reveal').forEach(el => this.revealObserver!.observe(el));
  }

  private initCtaObserver(): void {
    const ctaBg  = document.getElementById('ctaBg');
    const ctaSec = document.getElementById('ctaSection');
    if (!ctaBg || !ctaSec) return;
    this.ctaObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          ctaBg.classList.add('is-visible');
          this.ctaObserver!.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    this.ctaObserver.observe(ctaSec);
  }

  // ══════════════════════════════════════════════════════
  // GSAP — lazy-loaded, used only for:
  //   • 3D card tilt (mousemove on a single card)
  //   • Magnetic buttons
  //   • Orb parallax — RAF-GATED (one tween per frame max)
  //   • Horizontal scroll pin
  //
  // Key fix for orb lag: previous code called gsap.to()
  // inside mousemove directly. Mouse fires 100-200x/sec.
  // Each gsap.to() queues a new tween even if the previous
  // one hasn't finished → hundreds of stacked tweens = lag.
  // Fix: store latest mouse values, schedule a single RAF,
  // and use overwrite:'auto' so only one tween runs at once.
  // ══════════════════════════════════════════════════════
  private async lazyInitGsap(): Promise<void> {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]);
    gsap.registerPlugin(ScrollTrigger);

    this.gsapCtx = gsap.context(() => {

      // 3D card tilt
      const card = document.getElementById('heroCard');
      if (card) {
        card.addEventListener('mousemove', (e: MouseEvent) => {
          const r  = card.getBoundingClientRect();
          const rx = ((e.clientX - r.left) / r.width  - 0.5) *  18;
          const ry = ((e.clientY - r.top)  / r.height - 0.5) * -14;
          gsap.to(card, {
            rotateY: rx, rotateX: ry,
            duration: 0.4, ease: 'power2.out',
            transformPerspective: 800,
            overwrite: 'auto',   // kills any previous tilt tween
          });
        }, { passive: true });
        card.addEventListener('mouseleave', () =>
          gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.8, ease: 'elastic.out(1,.45)' })
        );
      }


      // Magnetic buttons
      document.querySelectorAll<HTMLElement>('.es-magnetic').forEach(btn => {
        btn.addEventListener('mousemove', (e: MouseEvent) => {
          const r  = btn.getBoundingClientRect();
          const bx = (e.clientX - r.left - r.width  / 2) * 0.38;
          const by = (e.clientY - r.top  - r.height / 2) * 0.38;
          gsap.to(btn, { x: bx, y: by, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
        }, { passive: true });
        btn.addEventListener('mouseleave', () =>
          gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,.4)' })
        );
      });

      // Horizontal scroll
      const track = document.getElementById('nearbyTrack') as HTMLElement | null;
      const cards = gsap.utils.toArray('.es-nearby__card');
      if (track && cards.length >= 2) {
        const dist = track.scrollWidth - window.innerWidth;
        gsap.to(track, {
          x: -dist, ease: 'none',
          scrollTrigger: {
            trigger: '.es-nearby', pin: true, scrub: 1.6,
            snap: { snapTo: 1 / (cards.length - 1), duration: .45, ease: 'power1.inOut' },
            end: () => '+=' + track.scrollWidth,
          },
        });
      }

    });
  }
}