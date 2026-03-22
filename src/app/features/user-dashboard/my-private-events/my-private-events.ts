import {
 Component,
 computed,
 inject,
 OnDestroy,
 OnInit,
 signal,
 ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule }           from '@angular/router';
import { Subject }                from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { of }                     from 'rxjs';
import { EventService }           from '@core/services/event.service';
import { Event as EventModel, EventLocationType, EventType } from '@core/models/event.model';

type TabFilter = 'all' | 'upcoming' | 'past';

function isUpcoming(dateStr: string): boolean {
 return new Date(dateStr) > new Date();
}

@Component({
 selector: 'app-my-private-events',
 standalone: true,
 changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [CommonModule, DatePipe, RouterModule],
 styles: [`
   @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
   :host {
     --coral:     #FF4433;
     --coral-dim: rgba(255,68,51,.12);
     --coral-brd: rgba(255,68,51,.28);
     --violet:    #a78bfa;
     --violet-dim:rgba(167,139,250,.10);
     --violet-brd:rgba(167,139,250,.22);
     --gold:      #F0B429;
     --gold-dim:  rgba(240,180,41,.10);
     --gold-brd:  rgba(240,180,41,.22);
     --green:     #10b981;
     --green-dim: rgba(16,185,129,.10);
     --green-brd: rgba(16,185,129,.22);
     --text:      #F2EEE6;
     --muted:     rgba(242,238,230,.42);
     --bdr:       rgba(242,238,230,.07);
     --bdrhi:     rgba(242,238,230,.12);
     --bg:        #060608;
     --bg2:       #09090c;
     --bg3:       #111116;
     --fd: 'Bebas Neue', sans-serif;
     --fb: 'Plus Jakarta Sans', sans-serif;
     --fm: 'DM Mono', monospace;
     display: block;
     background: var(--bg);
     min-height: 100dvh;
     color: var(--text);
     font-family: var(--fb);
   }

   /* ── Animations ── */
   @keyframes fade-up   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
   @keyframes shimmer   { from{background-position:-800px 0} to{background-position:800px 0} }
   @keyframes bar-grow  { from{width:0} }

   /* ── Hero ── */
   .pe-hero {
     position: relative; overflow: hidden;
     border-bottom: 1px solid var(--bdr);
     padding: 2.5rem 1.5rem 0;
   }
   @media(min-width:640px) { .pe-hero { padding: 3rem 2.5rem 0; } }
   @media(min-width:1024px){ .pe-hero { padding: 3rem 3.5rem 0; } }

   .pe-hero__orb {
     position: absolute; border-radius: 50%;
     pointer-events: none; filter: blur(80px);
   }

   .pe-label {
     font-family: var(--fm); font-size: .6rem; letter-spacing: .22em;
     text-transform: uppercase; color: rgba(167,139,250,.8);
     display: flex; align-items: center; gap: 6px; margin-bottom: .6rem;
   }

   .pe-title {
     font-family: var(--fd);
     font-size: clamp(2.6rem,7vw,5rem);
     line-height: .88; letter-spacing: .03em;
     color: var(--text); margin: 0 0 .75rem;
   }
   .pe-title span { color: transparent; -webkit-text-stroke: 2px var(--violet); }

   .pe-sub {
     font-size: .88rem; color: var(--muted);
     font-weight: 300; line-height: 1.7;
     max-width: 380px; margin-bottom: 1.5rem;
   }

   /* ── Stat pills ── */
   .pe-stats {
     display: flex; gap: .6rem; flex-wrap: wrap; margin-bottom: 1.5rem;
   }
   .pe-stat {
     display: inline-flex; align-items: center; gap: .4rem;
     padding: .38rem .85rem; border-radius: 100px;
     border: 1px solid var(--bdr); background: rgba(242,238,230,.025);
     font-family: var(--fm); font-size: .6rem; letter-spacing: .1em;
     text-transform: uppercase; color: var(--muted);
   }
   .pe-stat__dot {
     width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
   }

   /* ── Tab bar ── */
   .pe-tabs {
     display: flex; gap: 0;
     border-bottom: 1px solid var(--bdr);
     overflow-x: auto; scrollbar-width: none;
   }
   .pe-tabs::-webkit-scrollbar { display: none; }
   .pe-tab {
     padding: .55rem 1.2rem;
     background: transparent; border: none; border-bottom: 2px solid transparent;
     font-family: var(--fm); font-size: .62rem; letter-spacing: .12em;
     text-transform: uppercase; cursor: pointer; transition: all .15s;
     color: var(--muted); margin-bottom: -1px; white-space: nowrap;
   }
   .pe-tab.active {
     border-bottom-color: var(--violet);
     color: var(--violet); font-weight: 700;
   }
   .pe-tab:not(.active):hover { color: var(--text); border-bottom-color: var(--bdrhi); }

   /* ── Body ── */
   .pe-body {
     padding: 2rem 1.5rem;
   }
   @media(min-width:640px) { .pe-body { padding: 2rem 2.5rem; } }
   @media(min-width:1024px){ .pe-body { padding: 2rem 3.5rem; } }

   /* ── Skeleton ── */
   .skeleton {
     background: linear-gradient(
       90deg,
       rgba(242,238,230,.04) 25%,
       rgba(242,238,230,.08) 50%,
       rgba(242,238,230,.04) 75%
     );
     background-size: 800px 100%;
     animation: shimmer 1.5s ease-in-out infinite;
     border-radius: 18px;
     border: 1px solid var(--bdr);
   }

   /* ── Grid ── */
   .pe-grid {
     display: grid;
     grid-template-columns: 1fr;
     gap: 1rem;
   }
   @media(min-width:640px) {
     .pe-grid { grid-template-columns: repeat(2, 1fr); }
   }
   @media(min-width:1024px) {
     .pe-grid { grid-template-columns: repeat(3, 1fr); }
   }

   /* ── Event card ── */
   .pe-card {
     position: relative; overflow: hidden;
     border-radius: 18px;
     border: 1px solid var(--bdr);
     background: var(--bg2);
     display: flex; flex-direction: column;
     cursor: pointer;
     transition: border-color .25s, transform .22s cubic-bezier(.22,1,.36,1);
     animation: fade-up .38s cubic-bezier(.22,1,.36,1) both;
   }
   .pe-card:hover {
     border-color: var(--bdrhi);
     transform: translateY(-3px);
   }

   /* Image */
   .pe-card__img-wrap {
     width: 100%; height: 160px; flex-shrink: 0; overflow: hidden;
     position: relative; background: var(--bg3);
   }
   .pe-card__img {
     width: 100%; height: 100%; object-fit: cover;
     transition: transform .45s cubic-bezier(.22,1,.36,1);
   }
   .pe-card:hover .pe-card__img { transform: scale(1.06); }
   .pe-card__img-scrim {
     position: absolute; inset: 0;
     background: linear-gradient(to bottom, transparent 40%, rgba(9,9,12,.85));
   }
   .pe-card__no-img {
     width: 100%; height: 160px; flex-shrink: 0;
     background: linear-gradient(135deg, rgba(167,139,250,.08), rgba(255,68,51,.04));
     display: flex; align-items: center; justify-content: center;
   }

   /* Body */
   .pe-card__body { padding: 1.1rem; display: flex; flex-direction: column; gap: .55rem; flex: 1; }

   /* Pills row */
   .pe-card__pills { display: flex; flex-wrap: wrap; gap: .35rem; }
   .pe-pill {
     display: inline-flex; align-items: center; gap: 3px;
     padding: 2px 8px; border-radius: 100px;
     font-family: var(--fm); font-size: .54rem;
     font-weight: 500; letter-spacing: .1em; text-transform: uppercase; line-height: 1;
   }
   .pe-pill--private  { background: var(--violet-dim); color: var(--violet); border: 1px solid var(--violet-brd); }
   .pe-pill--online   { background: var(--gold-dim);   color: var(--gold);   border: 1px solid var(--gold-brd);   }
   .pe-pill--inperson { background: rgba(99,102,241,.12); color: #a5b4fc; border: 1px solid rgba(99,102,241,.22); }
   .pe-pill--upcoming { background: var(--coral-dim);  color: var(--coral);  border: 1px solid var(--coral-brd);  }
   .pe-pill--past     { background: rgba(113,113,122,.1); color: #71717a; border: 1px solid rgba(113,113,122,.2); }
   .pe-pill--cat      { background: rgba(242,238,230,.06); color: var(--muted); border: 1px solid var(--bdr); }

   /* Date */
   .pe-card__date {
     font-family: var(--fm); font-size: .56rem; letter-spacing: .1em;
     text-transform: uppercase; color: var(--muted);
   }

   /* Title */
   .pe-card__title {
     font-family: var(--fd); font-size: 1.2rem; letter-spacing: .03em;
     color: var(--text); line-height: 1.05; margin: 0;
     display: -webkit-box; -webkit-line-clamp: 2;
     -webkit-box-orient: vertical; overflow: hidden;
   }

   /* Meta */
   .pe-card__meta {
     display: flex; align-items: center; justify-content: space-between;
     margin-top: auto; padding-top: .65rem;
     border-top: 1px solid var(--bdr);
   }
   .pe-card__loc {
     display: flex; align-items: center; gap: 5px;
     font-size: .75rem; color: var(--muted); font-weight: 400;
   }
   .pe-card__cta {
     font-family: var(--fm); font-size: .58rem; letter-spacing: .1em;
     color: var(--violet); text-transform: uppercase;
   }

   /* Glow accent */
   .pe-card__glow {
     position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
     background: linear-gradient(to right, var(--violet), transparent);
     opacity: 0; transition: opacity .3s;
   }
   .pe-card:hover .pe-card__glow { opacity: 1; }

   /* ── Empty state ── */
   .pe-empty {
     display: flex; flex-direction: column; align-items: center;
     gap: 1rem; padding: 5rem 1rem; text-align: center;
   }
   .pe-empty__icon-wrap {
     width: 60px; height: 60px; border-radius: 18px;
     background: var(--bg3); border: 1px solid var(--bdrhi);
     display: flex; align-items: center; justify-content: center;
   }
   .pe-empty__title {
     font-family: var(--fd); font-size: 1.6rem; letter-spacing: .06em;
     color: var(--text); margin: 0;
   }
   .pe-empty__sub {
     font-size: .85rem; color: var(--muted); font-weight: 300; margin: 0;
   }

   /* ── Error state ── */
   .pe-error {
     display: flex; flex-direction: column; align-items: center;
     gap: 1rem; padding: 5rem 1rem; text-align: center;
   }
   .pe-error__title {
     font-family: var(--fd); font-size: 1.4rem; letter-spacing: .05em;
     color: var(--coral); margin: 0;
   }
   .pe-retry-btn {
     display: inline-flex; align-items: center; gap: 6px;
     padding: .6rem 1.4rem; border-radius: 10px;
     background: var(--coral-dim); border: 1px solid var(--coral-brd);
     color: var(--coral); font-family: var(--fb); font-size: .84rem;
     font-weight: 600; cursor: pointer; transition: background .2s;
   }
   .pe-retry-btn:hover { background: rgba(255,68,51,.2); }
 `],
 template: `
   <!-- ── Hero ── -->
   <div class="pe-hero">
     <!-- Ambient orbs -->
     <div class="pe-hero__orb" style="width:40vw;height:40vw;top:-20%;left:-8%;
          background:radial-gradient(circle,rgba(167,139,250,.07) 0%,transparent 65%)"></div>
     <div class="pe-hero__orb" style="width:28vw;height:28vw;top:0;right:-5%;
          background:radial-gradient(circle,rgba(255,68,51,.05) 0%,transparent 65%)"></div>

     <div style="position:relative;z-index:1">
       <div class="pe-label">
         <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--violet)"></span>
         My Private Events
       </div>

       <h1 class="pe-title">
         PRIVATE<br>
         <span>ACCESS</span>
       </h1>

       <p class="pe-sub">
         Events you've been granted private access to — visible only to invited members.
       </p>

       <!-- Stat pills -->
       @if (!loading()) {
         <div class="pe-stats">
           <span class="pe-stat">
             <span class="pe-stat__dot" style="background:var(--violet)"></span>
             {{ events().length }} total
           </span>
           <span class="pe-stat">
             <span class="pe-stat__dot" style="background:var(--coral)"></span>
             {{ upcomingCount() }} upcoming
           </span>
           <span class="pe-stat">
             <span class="pe-stat__dot" style="background:rgba(113,113,122,.6)"></span>
             {{ pastCount() }} past
           </span>
         </div>
       }

       <!-- Tabs -->
       <div class="pe-tabs" role="tablist">
         @for (t of tabs; track t.value) {
           <button
             class="pe-tab"
             [class.active]="activeTab() === t.value"
             role="tab"
             [attr.aria-selected]="activeTab() === t.value"
             (click)="activeTab.set(t.value)"
           >
             {{ t.label }}
             @if (!loading()) {
               ({{ countFor(t.value) }})
             }
           </button>
         }
       </div>
     </div>
   </div>

   <!-- ── Body ── -->
   <div class="pe-body">

     <!-- Loading skeletons -->
     @if (loading()) {
       <div class="pe-grid">
         @for (i of skeletons; track i) {
           <div class="skeleton" [style.height.px]="280" [style.animation-delay]="i * 60 + 'ms'"></div>
         }
       </div>
     }

     <!-- Error -->
     @else if (error()) {
       <div class="pe-error">
         <div class="pe-empty__icon-wrap" style="border-color:rgba(255,68,51,.25);background:rgba(255,68,51,.06)">
           <svg width="24" height="24" fill="none" stroke="#FF4433" stroke-width="1.5" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round"
                   d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
           </svg>
         </div>
         <p class="pe-error__title">Failed to load events</p>
         <p class="pe-empty__sub">Something went wrong fetching your private events.</p>
         <button class="pe-retry-btn" (click)="load()">
           <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round"
                   d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
           </svg>
           Retry
         </button>
       </div>
     }

     <!-- Empty -->
     @else if (filtered().length === 0) {
       <div class="pe-empty">
         <div class="pe-empty__icon-wrap">
           <svg width="24" height="24" fill="none" stroke="var(--violet)" stroke-width="1.5" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round"
                   d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
           </svg>
         </div>
         @if (activeTab() === 'all') {
           <p class="pe-empty__title">No Private Events</p>
           <p class="pe-empty__sub">You haven't been given access to any private events yet.</p>
         } @else if (activeTab() === 'upcoming') {
           <p class="pe-empty__title">No Upcoming Events</p>
           <p class="pe-empty__sub">No private events scheduled ahead.</p>
         } @else {
           <p class="pe-empty__title">No Past Events</p>
           <p class="pe-empty__sub">No private events in your history yet.</p>
         }
       </div>
     }

     <!-- Event grid -->
     @else {
       <div class="pe-grid">
         @for (event of filtered(); track event.id; let i = $index) {
           <div
             class="pe-card"
             [style.animation-delay]="i * 50 + 'ms'"
             [routerLink]="['/user-dashboard/events', event.id]"
           >
             <!-- Image -->
             @if (event.event_img_url) {
               <div class="pe-card__img-wrap">
                 <img [src]="event.event_img_url" [alt]="event.title" class="pe-card__img"/>
                 <div class="pe-card__img-scrim"></div>
               </div>
             } @else {
               <div class="pe-card__no-img">
                 <svg width="32" height="32" fill="none" stroke="var(--violet)" stroke-width="1.2" viewBox="0 0 24 24" opacity=".4">
                   <path stroke-linecap="round" stroke-linejoin="round"
                         d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                 </svg>
               </div>
             }

             <div class="pe-card__body">
               <!-- Pills -->
               <div class="pe-card__pills">
                 <span class="pe-pill pe-pill--private">Private</span>

                 @if (event.event_location_type === EventLocationType.Online) {
                   <span class="pe-pill pe-pill--online">Online</span>
                 } @else {
                   <span class="pe-pill pe-pill--inperson">In-Person</span>
                 }

                 @if (isUpcoming(event.start_time)) {
                   <span class="pe-pill pe-pill--upcoming">Upcoming</span>
                 } @else {
                   <span class="pe-pill pe-pill--past">Past</span>
                 }

                 @if (event.category?.name) {
                   <span class="pe-pill pe-pill--cat">{{ event.category!.name }}</span>
                 }
               </div>

               <!-- Date -->
               <p class="pe-card__date">
                 {{ event.start_time | date:'EEE · MMM d, y' | uppercase }}
                 &nbsp;·&nbsp;
                 {{ event.start_time | date:'h:mm a' }}
               </p>

               <!-- Title -->
               <h3 class="pe-card__title">{{ event.title }}</h3>

               <!-- Meta -->
               <div class="pe-card__meta">
                 <span class="pe-card__loc">
                   @if (event.event_location_type === EventLocationType.Online) {
                     <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round"
                             d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/>
                     </svg>
                     Online
                   } @else {
                     <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round"
                             d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                       <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                     </svg>
                     {{ event.city || event.nameOfPlace || 'TBD' }}
                   }
                 </span>
                 <span class="pe-card__cta">View →</span>
               </div>
             </div>

             <div class="pe-card__glow"></div>
           </div>
         }
       </div>
     }
   </div>
 `,
})
export class MyPrivateEventsPage implements OnInit, OnDestroy {
 private readonly eventSvc = inject(EventService);
 private readonly d$       = new Subject<void>();

 readonly EventLocationType = EventLocationType;
 readonly EventType         = EventType;
 readonly isUpcoming        = isUpcoming;
 readonly skeletons         = Array.from({ length: 6 }, (_, i) => i);

 events    = signal<EventModel[]>([]);
 loading   = signal(true);
 error     = signal(false);
 activeTab = signal<TabFilter>('all');

 readonly tabs: { label: string; value: TabFilter }[] = [
   { label: 'All',      value: 'all'      },
   { label: 'Upcoming', value: 'upcoming' },
   { label: 'Past',     value: 'past'     },
 ];

 readonly filtered = computed(() => {
   const tab  = this.activeTab();
   const list = this.events();
   if (tab === 'upcoming') return list.filter(e =>  isUpcoming(e.start_time));
   if (tab === 'past')     return list.filter(e => !isUpcoming(e.start_time));
   return list;
 });

 readonly upcomingCount = computed(() =>
   this.events().filter(e =>  isUpcoming(e.start_time)).length
 );
 readonly pastCount = computed(() =>
   this.events().filter(e => !isUpcoming(e.start_time)).length
 );

 countFor(tab: TabFilter): number {
   if (tab === 'upcoming') return this.upcomingCount();
   if (tab === 'past')     return this.pastCount();
   return this.events().length;
 }

 ngOnInit():    void { this.load(); }
 ngOnDestroy(): void { this.d$.next(); this.d$.complete(); }

 load(): void {
   this.loading.set(true);
   this.error.set(false);

   this.eventSvc.getPrivateEventsByUser().pipe(
     catchError(() => {
       this.error.set(true);
       this.loading.set(false);
       return of([] as EventModel[]);
     }),
     takeUntil(this.d$),
   ).subscribe(list => {
     // Sort soonest upcoming first, then past events by most recent
     const sorted = [...list].sort((a, b) => {
       const aUp = isUpcoming(a.start_time);
       const bUp = isUpcoming(b.start_time);
       if (aUp && !bUp) return -1;
       if (!aUp && bUp) return 1;
       if (aUp)  return +new Date(a.start_time) - +new Date(b.start_time);
       return +new Date(b.start_time) - +new Date(a.start_time);
     });
     this.events.set(sorted);
     this.loading.set(false);
   });
 }
}