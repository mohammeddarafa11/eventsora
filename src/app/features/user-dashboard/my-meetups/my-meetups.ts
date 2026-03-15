// src/app/features/user-dashboard/my-meetups/my-meetups.ts
//
// Shows meetups the logged-in user has joined.
// GET /api/Meetup/joinedmeetupsbyuser/{userId}
//
import {
 Component, inject, signal, computed, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router }       from '@angular/router';
import { Subject, of }  from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { MeetupService } from '@core/services/meetup.service';
import { AuthService }   from '@core/services/auth.service';
import { Meetup, MeetupLocationType } from '@core/models/meetup.model';

function fmtDate(iso?: string | null): string {
 if (!iso) return '—';
 return new Date(iso).toLocaleDateString('en-EG', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
function fmtTime(iso?: string | null): string {
 if (!iso) return '';
 return new Date(iso).toLocaleTimeString('en-EG', { hour:'2-digit', minute:'2-digit' });
}
function isUpcoming(iso?: string | null): boolean {
 return !!iso && new Date(iso) > new Date();
}

type TabFilter = 'all' | 'upcoming' | 'past';

@Component({
 selector:   'app-my-meetups',
 standalone: true,
 imports:    [CommonModule],
 template: `
   <link rel="preconnect" href="https://fonts.googleapis.com"/>
   <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

   <div class="mm-root">

     <!-- ── HERO ── -->
     <header class="mm-hero">
       <div class="mm-orb" aria-hidden="true"></div>
       <div class="mm-hero__body">
         <div class="mm-eyebrow">
           <span class="mm-tag">My Community</span>
           @if (!loading() && meetups().length > 0) {
             <span class="mm-tag mm-tag--dim">{{ meetups().length }} joined</span>
           }
         </div>
         <h1 class="mm-title">My <em class="mm-accent">Meetups</em></h1>
         <p class="mm-sub">Meetups you've registered to attend.</p>
       </div>
     </header>

     <!-- ── FILTER TABS ── -->
     @if (!loading() && meetups().length > 0) {
       <div class="mm-tabs-wrap">
         @for (tab of tabs; track tab.value) {
           <button
             class="mm-tab"
             [class.mm-tab--on]="activeTab() === tab.value"
             (click)="activeTab.set(tab.value)"
           >{{ tab.label }}</button>
         }
       </div>
     }

     <!-- ── LOADING ── -->
     @if (loading()) {
       <div class="mm-list">
         @for (n of skeletons; track n) {
           <div class="mm-skel" [style.animation-delay]="n * 65 + 'ms'"></div>
         }
       </div>
     }

     <!-- ── ERROR ── -->
     @else if (error()) {
       <div class="mm-empty">
         <p class="mm-empty__ico">!</p>
         <p class="mm-empty__title">Couldn't load meetups</p>
         <button class="mm-btn" (click)="load()">Retry</button>
       </div>
     }

     <!-- ── EMPTY STATE ── -->
     @else if (meetups().length === 0) {
       <div class="mm-empty">
         <div class="mm-empty__icon-wrap">
           <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.4" viewBox="0 0 24 24" style="color:var(--muted)">
             <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
           </svg>
         </div>
         <p class="mm-empty__title">No meetups yet</p>
         <p class="mm-empty__sub">Browse and join a community meetup to get started.</p>
         <button class="mm-btn" (click)="router.navigate(['/user-dashboard/meetups'])">
           Browse Meetups
         </button>
       </div>
     }

     <!-- ── FILTERED EMPTY ── -->
     @else if (filtered().length === 0) {
       <div class="mm-empty mm-empty--sm">
         <p class="mm-empty__ico"></p>
         <p class="mm-empty__title">No {{ activeTab() }} meetups</p>
       </div>
     }

     <!-- ── LIST ── -->
     @else {
       <div class="mm-list">
         @for (m of filtered(); track m.id; let i = $index) {
           <div class="mm-card" [class.mm-card--past]="!isUpcoming(m.start_Time)"
                [style.animation-delay]="i * 50 + 'ms'">

             <!-- Image strip -->
             @if (m.meetup_img_url) {
               <div class="mm-card__img-wrap">
                 <img [src]="m.meetup_img_url" [alt]="m.title ?? ''" class="mm-card__img" loading="lazy"/>
                 <div class="mm-card__img-scrim"></div>
               </div>
             }

             <div class="mm-card__body">
               <div class="mm-card__left">

                 <!-- Badges row -->
                 <div class="mm-badges">
                   @if (m.category?.name) {
                     <span class="mm-badge mm-badge--cat">{{ m.category!.name }}</span>
                   }
                   <span class="mm-badge" [class.mm-badge--online]="m.meetup_location_type === 1">
                     {{ m.meetup_location_type === 1 ? 'Online' : 'In-Person' }}
                   </span>
                   @if (isUpcoming(m.start_Time)) {
                     <span class="mm-badge mm-badge--upcoming">
                       <span class="mm-dot"></span> Upcoming
                     </span>
                   } @else {
                     <span class="mm-badge mm-badge--past-badge">Past</span>
                   }
                 </div>

                 <!-- Title -->
                 <h3 class="mm-card__title">{{ m.title }}</h3>

                 <!-- Description excerpt -->
                 @if (m.description) {
                   <p class="mm-card__desc">{{ m.description }}</p>
                 }

                 <!-- Meta -->
                 <div class="mm-card__meta-list">
                   @if (m.start_Time) {
                     <div class="mm-card__meta">
                       <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                       </svg>
                       {{ fmtDate(m.start_Time) }} · {{ fmtTime(m.start_Time) }}
                       @if (m.end_Time) { → {{ fmtTime(m.end_Time) }} }
                     </div>
                   }
                   @if (m.nameOfPlace || m.city) {
                     <div class="mm-card__meta">
                       <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                         <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                       </svg>
                       {{ m.nameOfPlace || m.city }}
                     </div>
                   }
                   @if (m.online_url && m.meetup_location_type === 1) {
                     <div class="mm-card__meta">
                       <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                       </svg>
                       <a [href]="m.online_url" target="_blank" rel="noopener" class="mm-card__link">
                         Join online
                       </a>
                     </div>
                   }
                   @if (m.manager) {
                     <div class="mm-card__meta">
                       <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                       </svg>
                       Hosted by {{ m.manager.firstName }} {{ m.manager.lastName }}
                     </div>
                   }
                 </div>

               </div>

               <!-- Right side: participants -->
               <div class="mm-card__right">
                 <div class="mm-part-count">
                   <span class="mm-part-num">{{ (m.participants ?? []).length }}</span>
                   @if (m.maxAttendees) {
                     <span class="mm-part-max"> / {{ m.maxAttendees }}</span>
                   }
                   <span class="mm-part-label">attendees</span>
                 </div>

                 <span class="mm-joined-badge">
                   <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.8" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                   </svg>
                   Joined
                 </span>
               </div>
             </div>

           </div>
         }
       </div>
     }

     <div style="height:3rem"></div>
   </div>
 `,
 styles: [`
   :host {
     --gold:  #F0B429; --coral: #FF4433; --green: #22c55e;
     --bg:    #060608; --bg2:  #09090c;  --bg3: #111116;
     --text:  #F2EEE6; --muted: rgba(242,238,230,.42);
     --bdr:   rgba(242,238,230,.07); --bdrhi: rgba(242,238,230,.12);
     font-family: 'Plus Jakarta Sans', sans-serif;
     display: block; background: var(--bg); color: var(--text); min-height: 100%;
   }

   /* Hero */
   .mm-hero { position:relative;overflow:hidden;padding:2.5rem 1.75rem 2rem; }
   .mm-orb {
     position:absolute;width:360px;height:360px;top:-140px;right:-80px;border-radius:50%;
     pointer-events:none;z-index:0;
     background:radial-gradient(circle,rgba(34,197,94,.07) 0%,transparent 65%);
   }
   .mm-hero__body { position:relative;z-index:1; }
   .mm-eyebrow { display:flex;gap:.5rem;margin-bottom:.9rem; }
   .mm-tag {
     display:inline-flex;align-items:center;padding:3px 10px;border-radius:100px;
     font-family:'DM Mono',monospace;font-size:.59rem;letter-spacing:.12em;text-transform:uppercase;
     background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.22);color:var(--green);
   }
   .mm-tag--dim { background:rgba(242,238,230,.05);border-color:var(--bdr);color:var(--muted); }
   .mm-title {
     font-family:'Bebas Neue',sans-serif;font-size:clamp(2.8rem,7vw,4.8rem);
     letter-spacing:.03em;line-height:.9;color:var(--text);margin:0 0 .65rem;
   }
   .mm-accent { color:var(--green);font-style:normal; }
   .mm-sub { font-size:.84rem;color:var(--muted);margin:0;font-weight:300;line-height:1.6; }

   /* Tabs */
   .mm-tabs-wrap { display:flex;gap:.4rem;padding:0 1.75rem 1.25rem;flex-wrap:wrap; }
   .mm-tab {
     padding:.38rem .9rem;border-radius:100px;
     background:var(--bg3);border:1px solid var(--bdr);
     color:var(--muted);font-size:.8rem;font-weight:500;cursor:pointer;transition:all .2s;
   }
   .mm-tab:hover { border-color:var(--bdrhi);color:var(--text); }
   .mm-tab--on { background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.3)!important;color:var(--green)!important;font-weight:700; }

   /* List */
   .mm-list { display:flex;flex-direction:column;gap:.85rem;padding:0 1.75rem; }

   /* Card */
   .mm-card {
     background:var(--bg2);border:1px solid var(--bdr);border-radius:16px;overflow:hidden;
     transition:border-color .2s,box-shadow .22s;
     animation:slideUp .4s cubic-bezier(.22,1,.36,1) both;
   }
   @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
   .mm-card:hover { border-color:var(--bdrhi);box-shadow:0 8px 28px rgba(0,0,0,.35); }
   .mm-card--past { opacity:.65; }
   .mm-card--past:hover { opacity:1; }

   .mm-card__img-wrap { position:relative;height:110px;overflow:hidden; }
   .mm-card__img { width:100%;height:100%;object-fit:cover; }
   .mm-card__img-scrim {
     position:absolute;inset:0;
     background:linear-gradient(to top,rgba(9,9,12,.8) 0%,transparent 60%);
   }

   .mm-card__body {
     display:flex;align-items:flex-start;gap:1rem;padding:1rem 1.1rem;
   }
   .mm-card__left { flex:1;min-width:0;display:flex;flex-direction:column;gap:.5rem; }

   /* Badges */
   .mm-badges { display:flex;gap:.35rem;flex-wrap:wrap; }
   .mm-badge {
     display:inline-flex;align-items:center;gap:4px;
     padding:2px 8px;border-radius:6px;
     font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;
     background:rgba(242,238,230,.06);border:1px solid var(--bdr);color:var(--muted);
   }
   .mm-badge--cat { color:var(--green);background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.2); }
   .mm-badge--online { color:#0ea5e9;background:rgba(14,165,233,.08);border-color:rgba(14,165,233,.2); }
   .mm-badge--upcoming { color:var(--green);background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.2); }
   .mm-badge--past-badge { color:var(--muted);opacity:.7; }
   .mm-dot { width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 1.4s ease-in-out infinite; }
   @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.6)}}

   .mm-card__title {
     font-family:'Bebas Neue',sans-serif;font-size:1.15rem;letter-spacing:.04em;
     color:var(--text);margin:0;line-height:1.1;
   }
   .mm-card__desc {
     font-size:.76rem;color:var(--muted);line-height:1.55;margin:0;
     display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
   }
   .mm-card__meta-list { display:flex;flex-direction:column;gap:.3rem; }
   .mm-card__meta { display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:var(--muted); }
   .mm-card__meta svg { flex-shrink:0;opacity:.6; }
   .mm-card__link { color:#0ea5e9;text-decoration:none; }
   .mm-card__link:hover { text-decoration:underline; }

   /* Right */
   .mm-card__right {
     display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;
     gap:.75rem;flex-shrink:0;min-width:80px;
   }
   .mm-part-count { text-align:right;display:flex;align-items:baseline;gap:2px; }
   .mm-part-num   { font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:.04em;color:var(--green);line-height:1; }
   .mm-part-max   { font-size:.7rem;color:var(--muted); }
   .mm-part-label { font-family:'DM Mono',monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted); }
   .mm-joined-badge {
     display:inline-flex;align-items:center;gap:.35rem;
     padding:3px 10px;border-radius:100px;
     background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);
     color:var(--green);font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;
   }

   /* Skeleton */
   .mm-skel {
     height:120px;border-radius:16px;
     background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);
     background-size:600px 100%;animation:shimmer 1.5s ease-in-out infinite;
   }
   @keyframes shimmer{from{background-position:-600px 0}to{background-position:600px 0}}

   /* Empty */
   .mm-empty { display:flex;flex-direction:column;align-items:center;gap:.75rem;padding:5rem 1rem;text-align:center; }
   .mm-empty--sm { padding:2rem 1rem; }
   .mm-empty__icon-wrap {
     width:56px;height:56px;border-radius:16px;
     background:var(--bg3);border:1px solid var(--bdrhi);
     display:flex;align-items:center;justify-content:center;
   }
   .mm-empty__ico   { font-size:2.5rem; }
   .mm-empty__title { font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:.04em;color:var(--text);margin:0; }
   .mm-empty__sub   { font-size:.84rem;color:var(--muted);margin:0;font-weight:300; }
   .mm-btn {
     padding:.6rem 1.5rem;border-radius:10px;background:var(--green);color:#052e12;
     border:none;font-weight:700;font-size:.85rem;cursor:pointer;
   }

   @media(max-width:640px){
     .mm-hero { padding:1.75rem 1.1rem 1.5rem; }
     .mm-tabs-wrap,.mm-list { padding-inline:1.1rem; }
     .mm-card__divider { display:none; }
   }
 `],
})
export class MyMeetupsPage implements OnInit, OnDestroy {
 readonly router      = inject(Router);
 private readonly svc  = inject(MeetupService);
 private readonly auth = inject(AuthService);
 private readonly d$   = new Subject<void>();

 meetups   = signal<Meetup[]>([]);
 loading   = signal(true);
 error     = signal(false);
 activeTab = signal<TabFilter>('all');

 readonly skeletons  = Array.from({ length: 3 }, (_, i) => i);
 readonly fmtDate    = fmtDate;
 readonly fmtTime    = fmtTime;
 readonly isUpcoming = isUpcoming;

 readonly tabs: { label: string; value: TabFilter }[] = [
   { label: 'All',      value: 'all'      },
   { label: 'Upcoming', value: 'upcoming' },
   { label: 'Past',     value: 'past'     },
 ];

 filtered = computed(() => {
   const t    = this.activeTab();
   const list = this.meetups();
   if (t === 'upcoming') return list.filter(m =>  isUpcoming(m.start_Time));
   if (t === 'past')     return list.filter(m => !isUpcoming(m.start_Time));
   return list;
 });

 ngOnInit()    { this.load(); }
 ngOnDestroy() { this.d$.next(); this.d$.complete(); }

 load() {
   const userId = this.auth.getUserProfile()?.id;
   if (!userId) { this.loading.set(false); return; }

   this.loading.set(true);
   this.error.set(false);

   this.svc.getJoinedByUser(userId).pipe(
     catchError(() => { this.error.set(true); this.loading.set(false); return of([] as Meetup[]); }),
     takeUntil(this.d$),
   ).subscribe(list => {
     this.meetups.set(
       [...list].sort((a, b) => +new Date(b.start_Time) - +new Date(a.start_Time))
     );
     this.loading.set(false);
   });
 }
}