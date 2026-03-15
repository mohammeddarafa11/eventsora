// src/app/features/user-dashboard/meetups/meetups-page.ts
import {
 Component, inject, signal, computed, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { MeetupService } from '@core/services/meetup.service';
import { AuthService } from '@core/services/auth.service';
import { Meetup, MeetupLocationType } from '@core/models/meetup.model';

function fmtDate(iso?: string | null): string {
 if (!iso) return '—';
 return new Date(iso).toLocaleDateString('en-EG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso?: string | null): string {
 if (!iso) return '';
 return new Date(iso).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
}
function isUpcoming(iso?: string | null): boolean {
 return !!iso && new Date(iso) > new Date();
}

type TabFilter = 'all' | 'upcoming' | 'online' | 'offline';

@Component({
 selector: 'app-meetups-page',
 standalone: true,
 imports: [CommonModule],
 template: `
   <link rel="preconnect" href="https://fonts.googleapis.com"/>
   <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

   <div class="min-h-screen bg-[#060608] text-[#F2EEE6] font-[Plus_Jakarta_Sans,sans-serif]">

     <!-- ── HERO ── -->
     <header class="relative overflow-hidden px-4 pt-8 pb-6 sm:px-6 md:px-10 md:pt-12 md:pb-8">
       <div class="pointer-events-none absolute -top-36 -right-20 w-80 h-80 md:w-96 md:h-96 rounded-full"
            style="background:radial-gradient(circle,rgba(240,180,41,.07) 0%,transparent 65%)"></div>
       <div class="pointer-events-none absolute -bottom-20 -left-12 w-56 h-56 rounded-full"
            style="background:radial-gradient(circle,rgba(34,197,94,.05) 0%,transparent 65%)"></div>

       <div class="relative z-10 max-w-5xl mx-auto">
         <div class="flex gap-2 mb-3">
           <span class="inline-flex items-center px-3 py-0.5 rounded-full font-[DM_Mono,monospace] text-[0.58rem] tracking-widest uppercase
                        bg-green-500/10 border border-green-500/25 text-green-400">Community</span>
           <span class="inline-flex items-center px-3 py-0.5 rounded-full font-[DM_Mono,monospace] text-[0.58rem] tracking-widest uppercase
                        bg-white/5 border border-white/7 text-[#F2EEE6]/40">Meetups</span>
         </div>
         <h1 class="font-[Bebas_Neue,sans-serif] text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-none tracking-wide mb-2">
           Discover <em class="text-green-400 not-italic">Meetups</em>
         </h1>
         <p class="text-sm text-[#F2EEE6]/40 font-light leading-relaxed max-w-md">
           Community-led gatherings — find one that fits and join in.
         </p>
       </div>
     </header>

     <!-- ── FILTER TABS ── -->
     <div class="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 pb-4 flex flex-wrap items-center justify-between gap-3">
       <div class="flex flex-wrap gap-1.5" role="tablist">
         @for (tab of tabs; track tab.value) {
           <button
             class="px-3 py-1.5 rounded-full text-[0.78rem] font-medium border transition-all duration-200 cursor-pointer"
             [class]="activeTab() === tab.value
               ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold'
               : 'bg-[#111116] border-white/7 text-[#F2EEE6]/40 hover:border-white/12 hover:text-[#F2EEE6]'"
             role="tab"
             [attr.aria-selected]="activeTab() === tab.value"
             (click)="setTab(tab.value)"
           >{{ tab.label }}</button>
         }
       </div>
       <span class="font-[DM_Mono,monospace] text-[0.6rem] tracking-widest text-[#F2EEE6]/40
                    px-3 py-1 rounded-full bg-white/[0.03] border border-white/7">
         {{ filtered().length }} meetup{{ filtered().length !== 1 ? 's' : '' }}
       </span>
     </div>

     <div class="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 pb-16">

       <!-- ── LOADING ── -->
       @if (loading()) {
         <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           @for (n of skeletons; track n) {
             <div class="h-72 rounded-2xl skeleton-shimmer" [style.animation-delay]="n * 60 + 'ms'"></div>
           }
         </div>
       }

       <!-- ── ERROR ── -->
       @else if (error()) {
         <div class="flex flex-col items-center gap-3 py-24 text-center">
           <span class="text-4xl">⚠</span>
           <p class="font-[Bebas_Neue,sans-serif] text-2xl tracking-wide">Couldn't load meetups</p>
           <button class="mt-2 px-6 py-2.5 rounded-xl bg-green-400 text-[#052e12] font-bold text-sm cursor-pointer"
                   (click)="load()">Retry</button>
         </div>
       }

       <!-- ── EMPTY ── -->
       @else if (filtered().length === 0) {
         <div class="flex flex-col items-center gap-3 py-24 text-center">
           <span class="text-5xl">🔍</span>
           <p class="font-[Bebas_Neue,sans-serif] text-2xl tracking-wide">No meetups here yet</p>
           <p class="text-sm text-[#F2EEE6]/40 font-light">Try a different filter.</p>
         </div>
       }

       <!-- ── GRID ── -->
       @else {
         <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           @for (m of filtered(); track m.id; let i = $index) {
             <article
               class="bg-[#09090c] border border-white/7 rounded-2xl overflow-hidden
                      transition-all duration-200 hover:border-white/12 hover:shadow-2xl hover:-translate-y-0.5
                      card-in"
               [style.animation-delay]="i * 45 + 'ms'">

               <!-- Image -->
               <div class="relative aspect-video overflow-hidden bg-[#111116]">
                 @if (m.meetup_img_url) {
                   <img [src]="m.meetup_img_url" [alt]="m.title ?? ''" loading="lazy"
                        class="w-full h-full object-cover transition-transform duration-500"/>
                 } @else {
                   <div class="w-full h-full flex items-center justify-center">
                     <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width=".8"
                          viewBox="0 0 24 24" class="opacity-15 text-[#F2EEE6]">
                       <path stroke-linecap="round" stroke-linejoin="round"
                             d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857
                                M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857
                                m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                     </svg>
                   </div>
                 }

                 <!-- Location badge -->
                 <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md
                              font-[DM_Mono,monospace] text-[0.56rem] tracking-widest uppercase
                              bg-black/70 backdrop-blur-sm border"
                       [class]="m.meetup_location_type === 1
                         ? 'text-green-400 border-green-500/30'
                         : 'text-[#F2EEE6]/70 border-white/12'">
                   {{ m.meetup_location_type === 1 ? 'Online' : 'In-Person' }}
                 </span>

                 <!-- Upcoming pulse dot -->
                 @if (isUpcoming(m.start_Time)) {
                   <span class="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
                     <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60"></span>
                     <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
                   </span>
                 }
               </div>

               <!-- Body -->
               <div class="p-4 flex flex-col gap-2">
                 @if (m.category?.name) {
                   <div class="font-[DM_Mono,monospace] text-[0.56rem] tracking-widest uppercase text-green-400">
                     {{ m.category!.name }}
                   </div>
                 }

                 <h2 class="font-[Bebas_Neue,sans-serif] text-lg leading-tight tracking-wide text-[#F2EEE6] line-clamp-2">
                   {{ m.title }}
                 </h2>

                 <div class="flex flex-col gap-1.5">
                   @if (m.start_Time) {
                     <div class="flex items-center gap-1.5 text-[0.7rem] text-[#F2EEE6]/40">
                       <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="shrink-0 opacity-60">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                       </svg>
                       {{ fmtDate(m.start_Time) }} · {{ fmtTime(m.start_Time) }}
                     </div>
                   }
                   @if (m.nameOfPlace || m.city) {
                     <div class="flex items-center gap-1.5 text-[0.7rem] text-[#F2EEE6]/40">
                       <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="shrink-0 opacity-60">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                         <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                       </svg>
                       {{ m.nameOfPlace || m.city }}
                     </div>
                   }
                   @if (m.manager?.firstName || m.manager?.lastName) {
                     <div class="flex items-center gap-1.5 text-[0.7rem] text-[#F2EEE6]/40">
                       <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="shrink-0 opacity-60">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                       </svg>
                       Hosted by {{ m.manager!.firstName }} {{ m.manager!.lastName }}
                     </div>
                   }
                 </div>

                 <!-- Footer -->
                 <div class="flex items-center justify-between gap-2 mt-1">
                   <div class="flex items-center gap-2">
                     <div class="flex">
                       @for (p of (m.participants ?? []).slice(0, 4); track p.userId) {
                         <div class="w-6 h-6 rounded-full bg-green-500/15 border-2 border-[#09090c] -ml-1.5 first:ml-0
                                     flex items-center justify-center font-[Bebas_Neue,sans-serif] text-[0.65rem] text-green-400">
                           {{ (p.user?.firstName ?? '?').charAt(0).toUpperCase() }}
                         </div>
                       }
                     </div>
                     <span class="font-[DM_Mono,monospace] text-[0.58rem] tracking-wide text-[#F2EEE6]/40">
                       {{ (m.participants ?? []).length }}{{ m.maxAttendees ? ' / ' + m.maxAttendees : '' }} joined
                     </span>
                   </div>

                   <!-- Join / Joined / Full -->
                   @if (isJoined(m)) {
                     <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.73rem] font-semibold
                                  bg-green-500/8 border border-green-500/25 text-green-400">
                       <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                       </svg>
                       Joined
                     </span>
                   } @else if (isFull(m)) {
                     <span class="px-3 py-1.5 rounded-full text-[0.73rem] font-semibold
                                  border border-white/10 text-[#F2EEE6]/30">Full</span>
                   } @else {
                     <button
                       class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.73rem] font-semibold
                              border border-green-500/45 text-green-400 bg-transparent
                              hover:bg-green-500/10 transition-colors duration-200
                              disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                       [disabled]="joiningId() === m.id || !m.id"
                       (click)="join(m)">
                       @if (joiningId() === m.id) {
                         <span class="w-3 h-3 rounded-full border-2 border-green-500/30 border-t-green-400 animate-spin inline-block"></span>
                       } @else {
                         + Join
                       }
                     </button>
                   }
                 </div>
               </div>
             </article>
           }
         </div>
       }
     </div>

     <!-- ── TOAST ── -->
     @if (toast()) {
       <div class="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl
                   text-[0.82rem] font-semibold whitespace-nowrap z-50 toast-in"
            [class]="toast()!.type === 'error'
              ? 'bg-[#FF4433]/12 border border-[#FF4433]/30 text-[#FF4433]'
              : 'bg-green-500/12 border border-green-500/30 text-green-400'"
            role="status" aria-live="polite">
         {{ toast()!.msg }}
       </div>
     }
   </div>
 `,
 styles: [`
   @keyframes cardIn {
     from { opacity: 0; transform: translateY(10px); }
     to   { opacity: 1; transform: none; }
   }
   @keyframes toastIn {
     from { opacity: 0; transform: translateX(-50%) translateY(12px); }
     to   { opacity: 1; transform: translateX(-50%) translateY(0); }
   }
   @keyframes shimmer {
     from { background-position: -600px 0; }
     to   { background-position:  600px 0; }
   }
   .card-in { animation: cardIn .45s cubic-bezier(.22,1,.36,1) both; }
   .toast-in { animation: toastIn .3s cubic-bezier(.22,1,.36,1); }
   .skeleton-shimmer {
     background: linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);
     background-size: 600px 100%;
     animation: shimmer 1.5s ease-in-out infinite;
   }
 `],
})
export class MeetupsPage implements OnInit, OnDestroy {
 private readonly svc      = inject(MeetupService);
 private readonly auth     = inject(AuthService);
 private readonly router   = inject(Router);
 private readonly http     = inject(HttpClient);
 private readonly destroy$ = new Subject<void>();

 meetups   = signal<Meetup[]>([]);
 loading   = signal(true);
 error     = signal(false);
 activeTab = signal<TabFilter>('all');
 joiningId = signal<number | null>(null);
 toast     = signal<{ msg: string; type: 'success' | 'error' } | null>(null);
 joinedIds = signal<Set<number>>(new Set());

 private toastTimer: ReturnType<typeof setTimeout> | null = null;

 readonly skeletons  = Array.from({ length: 6 }, (_, i) => i);
 readonly fmtDate    = fmtDate;
 readonly fmtTime    = fmtTime;
 readonly isUpcoming = isUpcoming;

 readonly tabs: { label: string; value: TabFilter }[] = [
   { label: 'All',       value: 'all'      },
   { label: 'Upcoming',  value: 'upcoming' },
   { label: 'Online',    value: 'online'   },
   { label: 'In-Person', value: 'offline'  },
 ];

 filtered = computed(() => {
   const tab  = this.activeTab();
   const list = this.meetups();
   switch (tab) {
     case 'upcoming': return list.filter(m => isUpcoming(m.start_Time));
     case 'online':   return list.filter(m => m.meetup_location_type === MeetupLocationType.Online);
     case 'offline':  return list.filter(m => m.meetup_location_type === MeetupLocationType.Offline);
     default:         return list;
   }
 });

 ngOnInit()    { this.load(); }
 ngOnDestroy() {
   this.destroy$.next(); this.destroy$.complete();
   if (this.toastTimer) clearTimeout(this.toastTimer);
 }

 setTab(t: TabFilter) { this.activeTab.set(t); }
 load() {
  this.loading.set(true);
  this.error.set(false);

  this.svc.getAllMeetupsWithIds().pipe(
    catchError(() => {
      this.error.set(true);
      this.loading.set(false);
      return of([] as Meetup[]);
    }),
    takeUntil(this.destroy$),
  ).subscribe(list => {
    this.meetups.set(list);
    this.loading.set(false);

    const userId = this.auth.getUserProfile()?.id;
    if (userId) {
      this.joinedIds.set(new Set(
        list
          .filter(m => (m.participants ?? []).some(p => p.userId === userId))
          .map(m => m.id)
          .filter((id): id is number => !!id)
      ));
    }
  });
}

 isJoined(m: Meetup): boolean { return !!m.id && this.joinedIds().has(m.id); }
 isFull(m: Meetup):   boolean {
   if (!m.maxAttendees) return false;
   return (m.participants ?? []).length >= m.maxAttendees;
 }

 join(m: Meetup): void {
  console.log('[JOIN] meetup object =', m); // ← add this
  console.log('[JOIN] m.id =', m.id, typeof m.id); 
   // Defensive: never fire if id is missing
   if (!m.id) {
     console.error('[MeetupsPage] Cannot join — meetup has no id:', m);
     this.showToast('Cannot join this meetup right now.', 'error');
     return;
   }
   if (this.joiningId() !== null) return;

   this.joiningId.set(m.id);
   this.svc.joinMeetup(m.id).pipe(
     catchError(err => {
       this.showToast(err?.error?.message ?? 'Failed to join. Please try again.', 'error');
       this.joiningId.set(null);
       return of(null);
     }),
     takeUntil(this.destroy$),
   ).subscribe(res => {
     if (!res) return;
     this.joiningId.set(null);
     this.joinedIds.update(s => new Set([...s, m.id]));
     this.meetups.update(list =>
       list.map(item =>
         item.id === m.id
           ? { ...item, participants: [...(item.participants ?? []), { meetupId: m.id, userId: this.auth.getUserProfile()?.id ?? 0 }] }
           : item
       )
     );
     this.showToast(`You joined "${m.title}"! 🎉`, 'success');
   });
 }

 private showToast(msg: string, type: 'success' | 'error') {
   this.toast.set({ msg, type });
   if (this.toastTimer) clearTimeout(this.toastTimer);
   this.toastTimer = setTimeout(() => this.toast.set(null), 3200);
 }
}