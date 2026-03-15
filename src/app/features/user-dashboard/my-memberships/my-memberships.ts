// src/app/features/user-dashboard/my-memberships/my-memberships.ts
//
// Two sections:
//   A) MY MEMBERSHIPS  — fetched from GET /api/User (memberships[])
//                        org details hydrated via GET /api/Organization/{id}
//   B) DISCOVER ORGS   — orgs derived from user's favourite categories
//                        GET /api/User/favorites → categories
//                        GET /api/Event/Category?categoryId={id} → events → orgIds
//                        GET /api/Organization/{id} → org details
//                        POST /api/OrganizationMemberShip/{OrgId}/join
//
import {
 Component, inject, signal, computed, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { RouterModule }  from '@angular/router';
import { HttpClient }    from '@angular/common/http';
import { Subject, of, forkJoin } from 'rxjs';
import { catchError, map, takeUntil } from 'rxjs/operators';
import { AuthService }   from '@core/services/auth.service';
import { MembershipStatus } from '@core/models/membership.model';

interface OrgInfo {
 id: number; name: string | null;
 bio?: string | null; city?: string | null; region?: string | null;
 logoUrl?: string | null; coverUrl?: string | null;
}
interface Membership {
 organizationId: number;
 organization:   OrgInfo | null;
 status:         MembershipStatus;
 requestDate:    string;
 joinDate?:      string | null;
}
interface DiscoverOrg extends OrgInfo {
 catId?: number; catName?: string; eventCount: number;
}

const BASE = 'https://eventora.runasp.net/api';

@Component({
 selector:   'app-my-memberships',
 standalone: true,
 imports:    [CommonModule, FormsModule, RouterModule],
 template: `
   <link rel="preconnect" href="https://fonts.googleapis.com"/>
   <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

   <div class="mm-root">

     <!-- ── HERO ── -->
     <header class="mm-hero">
       <div class="mm-orb-a"></div><div class="mm-orb-b"></div>
       <div class="mm-hero__body">
         <div class="mm-eyebrow">
           <span class="mm-tag">My Network</span>
           @if (memberships().length > 0) {
             <span class="mm-tag mm-tag--dim">{{ memberships().length }} joined</span>
           }
         </div>
         <h1 class="mm-title">My <em class="mm-accent">Memberships</em></h1>
         <p class="mm-sub">Organisations you've joined — and ones you might like.</p>
       </div>
     </header>

     <!-- ════ A: MY MEMBERSHIPS ════ -->
     <div class="mm-section-hd">
       <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
       </svg>
       My Memberships
     </div>

     @if (loadingMembers()) {
       <div class="mm-grid">
         @for (n of [0,1,2]; track n) { <div class="mm-skel" style="height:120px"></div> }
       </div>
     } @else if (memberships().length === 0) {
       <div class="mm-hint">
         <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
         </svg>
         You haven't joined any organisations yet. Discover some below.
       </div>
     } @else {
       <div class="mm-grid">
         @for (m of memberships(); track m.organizationId) {
           <article class="mm-card mm-card--member">
             @if (m.organization?.coverUrl) {
               <div class="mm-card__cover">
                 <img [src]="m.organization!.coverUrl!" alt="" class="mm-card__cover-img" (error)="onCoverErr($event)"/>
                 <div class="mm-card__cover-scrim"></div>
               </div>
             } @else { <div class="mm-card__cover mm-card__cover--blank"></div> }

             <div class="mm-card__logo-wrap">
               @if (m.organization?.logoUrl) {
                 <img [src]="m.organization!.logoUrl!" class="mm-card__logo"
                      [alt]="m.organization?.name ?? ''" (error)="onImgErr($event)"/>
               } @else {
                 <div class="mm-card__logo mm-card__logo--fb" [style]="grad(m.organizationId)">
                   {{ (m.organization?.name ?? '#')[0].toUpperCase() }}
                 </div>
               }
             </div>

             <div class="mm-card__body">
               <span class="mm-pill" [ngClass]="pillCls(m.status)">
                 <span class="mm-pill__dot" [ngClass]="dotCls(m.status)"></span>
                 {{ statusLbl(m.status) }}
               </span>
               <h3 class="mm-card__name">{{ m.organization?.name ?? 'Organisation #' + m.organizationId }}</h3>
               @if (m.organization?.bio)  { <p class="mm-card__bio">{{ m.organization!.bio }}</p> }
               @if (m.organization?.city) {
                 <div class="mm-card__loc">
                   <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                     <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                   </svg>
                   {{ m.organization!.city }}
                 </div>
               }
               <div class="mm-card__date">
                 @if (m.status === MS.Pending)  { Requested {{ fmt(m.requestDate) }} }
                 @else if (m.joinDate)           { Joined {{ fmt(m.joinDate) }} }
               </div>
             </div>

             <div class="mm-card__foot">
               @if (m.status === MS.Approved)  { <span class="mm-foot-note mm-foot-note--green"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Active Member</span> }
               @if (m.status === MS.Pending)   { <span class="mm-foot-note">Awaiting approval.</span> }
               @if (m.status === MS.Banned)    { <span class="mm-foot-note mm-foot-note--warn">You have been banned.</span> }
               @if (m.status === MS.Rejected)  {
                 <button class="mm-rejoin-btn" [disabled]="joiningId() === m.organizationId"
                         (click)="join(m.organizationId)">
                   @if (joiningId() === m.organizationId) { <span class="mm-spin"></span> } @else { Request again }
                 </button>
               }
             </div>
           </article>
         }
       </div>
     }

     <!-- ════ B: DISCOVER ════ -->
     <div class="mm-section-hd mm-section-hd--discover">
       <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z"/>
       </svg>
       Discover Organisations
       <span class="mm-section-hd__sub">Based on your favourite genres</span>
     </div>

     @if (loadingDiscover()) {
       <div class="mm-grid">
         @for (n of [0,1,2,3,4,5]; track n) {
           <div class="mm-skel" style="height:200px" [style.animation-delay]="n*60+'ms'"></div>
         }
       </div>
     } @else if (discoverOrgs().length === 0) {
       <div class="mm-hint">
         <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
         </svg>
         No organisations found for your categories.
         <a class="mm-hint__link" routerLink="/user-dashboard/edit-interests">Update interests</a>
       </div>
     } @else {
       <!-- category filter tabs -->
       @if (catTabs().length > 1) {
         <div class="mm-cat-tabs">
           <button class="mm-cat-tab" [class.mm-cat-tab--on]="activeCat() === null"
                   (click)="activeCat.set(null)">All</button>
           @for (c of catTabs(); track c.id) {
             <button class="mm-cat-tab" [class.mm-cat-tab--on]="activeCat() === c.id"
                     (click)="activeCat.set(c.id)">{{ c.name }}</button>
           }
         </div>
       }

       <div class="mm-grid">
         @for (org of visibleOrgs(); track org.id; let i = $index) {
           <article class="mm-card mm-card--discover" [style.animation-delay]="i*45+'ms'">
             @if (org.coverUrl) {
               <div class="mm-card__cover">
                 <img [src]="org.coverUrl" alt="" class="mm-card__cover-img" (error)="onCoverErr($event)"/>
                 <div class="mm-card__cover-scrim"></div>
               </div>
             } @else { <div class="mm-card__cover mm-card__cover--blank"></div> }

             <div class="mm-card__logo-wrap">
               @if (org.logoUrl) {
                 <img [src]="org.logoUrl" [alt]="org.name ?? ''" class="mm-card__logo" (error)="onImgErr($event)"/>
               } @else {
                 <div class="mm-card__logo mm-card__logo--fb" [style]="grad(org.id)">
                   {{ (org.name ?? '#')[0].toUpperCase() }}
                 </div>
               }
             </div>

             <div class="mm-card__body">
               @if (org.catName) { <span class="mm-cat-badge">{{ org.catName }}</span> }
               <h3 class="mm-card__name">{{ org.name ?? 'Organisation #' + org.id }}</h3>
               @if (org.bio)  { <p class="mm-card__bio">{{ org.bio }}</p> }
               @if (org.city) {
                 <div class="mm-card__loc">
                   <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                     <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                   </svg>
                   {{ org.city }}
                 </div>
               }
               <p class="mm-card__events">{{ org.eventCount }} event{{ org.eventCount !== 1 ? 's' : '' }}</p>
             </div>

             <div class="mm-card__foot">
               @if (membershipOf(org.id) === MS.Approved) {
                 <span class="mm-foot-note mm-foot-note--green">
                   <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                   </svg>
                   Member
                 </span>
               } @else if (membershipOf(org.id) === MS.Pending) {
                 <span class="mm-foot-note">Request pending</span>
               } @else if (membershipOf(org.id) === MS.Banned) {
                 <span class="mm-foot-note mm-foot-note--warn">Banned</span>
               } @else {
                 <button class="mm-join-btn" [disabled]="joiningId() === org.id"
                         (click)="join(org.id)">
                   @if (joiningId() === org.id) {
                     <span class="mm-spin"></span> Sending…
                   } @else {
                     <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                     </svg>
                     Request to Join
                   }
                 </button>
               }
             </div>
           </article>
         }
       </div>
     }

     @if (toast()) {
       <div class="mm-toast" [class.mm-toast--err]="toast()!.type === 'error'" role="status" aria-live="polite">
         {{ toast()!.msg }}
       </div>
     }

     <div style="height:4rem"></div>
   </div>
 `,
 styles: [`
   :host {
     --indigo:#a5b4fc; --green:#22c55e; --gold:#F0B429; --coral:#FF4433;
     --bg:#060608; --bg2:#09090c; --bg3:#111116; --bg4:#16161c;
     --text:#F2EEE6; --muted:rgba(242,238,230,.42);
     --bdr:rgba(242,238,230,.07); --bdrhi:rgba(242,238,230,.12);
     font-family:'Plus Jakarta Sans',sans-serif;
     display:block; background:var(--bg); color:var(--text); min-height:100%;
   }

   /* Hero */
   .mm-hero { position:relative; overflow:hidden; padding:2.5rem 1.75rem 1.75rem; }
   .mm-orb-a,.mm-orb-b { position:absolute; border-radius:50%; pointer-events:none; z-index:0; }
   .mm-orb-a { width:420px;height:420px;top:-160px;right:-80px;background:radial-gradient(circle,rgba(165,180,252,.07) 0%,transparent 65%); }
   .mm-orb-b { width:260px;height:260px;bottom:-80px;left:-60px;background:radial-gradient(circle,rgba(240,180,41,.05) 0%,transparent 65%); }
   .mm-hero__body { position:relative; z-index:1; }
   .mm-eyebrow { display:flex; gap:.5rem; margin-bottom:.9rem; }
   .mm-tag {
     display:inline-flex; align-items:center; padding:3px 10px; border-radius:100px;
     font-family:'DM Mono',monospace; font-size:.59rem; letter-spacing:.12em; text-transform:uppercase;
     background:rgba(165,180,252,.1); border:1px solid rgba(165,180,252,.22); color:var(--indigo);
   }
   .mm-tag--dim { background:rgba(242,238,230,.05); border-color:var(--bdr); color:var(--muted); }
   .mm-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(2.6rem,7vw,4.5rem); letter-spacing:.03em; line-height:.9; color:var(--text); margin:0 0 .6rem; }
   .mm-accent { color:var(--indigo); font-style:normal; }
   .mm-sub { font-size:.84rem; color:var(--muted); margin:0; font-weight:300; line-height:1.6; }

   /* Section headers */
   .mm-section-hd {
     display:flex; align-items:center; gap:.55rem; padding:1.5rem 1.75rem .7rem;
     font-family:'DM Mono',monospace; font-size:.64rem; letter-spacing:.14em; text-transform:uppercase;
     color:var(--indigo);
   }
   .mm-section-hd--discover { color:var(--gold); border-top:1px solid var(--bdr); margin-top:2rem; }
   .mm-section-hd__sub { font-size:.55rem; color:var(--muted); text-transform:none; letter-spacing:.06em; margin-left:.25rem; }

   /* Category tabs */
   .mm-cat-tabs { display:flex; gap:.4rem; flex-wrap:wrap; padding:0 1.75rem .9rem; overflow-x:auto; scrollbar-width:none; }
   .mm-cat-tabs::-webkit-scrollbar { display:none; }
   .mm-cat-tab {
     padding:.32rem .85rem; border-radius:100px; flex-shrink:0;
     background:var(--bg3); border:1px solid var(--bdr); color:var(--muted);
     font-size:.78rem; font-weight:500; cursor:pointer; transition:all .18s;
   }
   .mm-cat-tab:hover { border-color:var(--bdrhi); color:var(--text); }
   .mm-cat-tab--on { background:rgba(240,180,41,.1); border-color:rgba(240,180,41,.35)!important; color:var(--gold)!important; font-weight:700; }

   /* Grid */
   .mm-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:1rem; padding:0 1.75rem; }

   /* Cards */
   .mm-card {
     background:var(--bg2); border:1px solid var(--bdr); border-radius:18px;
     overflow:hidden; display:flex; flex-direction:column;
     transition:border-color .2s,box-shadow .22s,transform .22s cubic-bezier(.22,1,.36,1);
     animation:cardIn .42s cubic-bezier(.22,1,.36,1) both;
   }
   @keyframes cardIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
   .mm-card--member:hover  { border-color:rgba(165,180,252,.25); box-shadow:0 14px 40px rgba(0,0,0,.4); transform:translateY(-3px); }
   .mm-card--discover:hover{ border-color:rgba(240,180,41,.25);  box-shadow:0 14px 40px rgba(0,0,0,.4); transform:translateY(-3px); }

   .mm-card__cover {
     position:relative; height:72px; min-height:72px; max-height:72px;
     overflow:hidden; background:var(--bg3); flex-shrink:0;
   }
   .mm-card__cover--blank {
     position:relative; height:72px; min-height:72px; max-height:72px;
     overflow:hidden; flex-shrink:0;
     background: linear-gradient(135deg,#0d0d14 0%,#111118 50%,#0a0a10 100%);
   }
   .mm-card__cover--blank::before {
     content:''; position:absolute; inset:0;
     background-image: repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0px,rgba(255,255,255,.025) 1px,transparent 1px,transparent 20px),
                       repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0px,rgba(255,255,255,.025) 1px,transparent 1px,transparent 20px);
   }
   .mm-card__cover--blank::after {
     content:''; position:absolute;
     width:120px; height:120px; border-radius:50%;
     top:-40px; right:20px;
     background: radial-gradient(circle, rgba(165,180,252,.12) 0%, transparent 70%);
   }
   .mm-card__cover-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
   .mm-card__cover-scrim { position:absolute; inset:0; background:linear-gradient(to top,rgba(9,9,12,.75) 0%,transparent 60%); }

   .mm-card__logo-wrap { margin:-20px 0 0 1rem; position:relative; z-index:2; flex-shrink:0; }
   .mm-card__logo { width:44px; height:44px; border-radius:12px; border:2px solid var(--bg2); object-fit:cover; }
   .mm-card__logo--fb {
     width:44px; height:44px; border-radius:12px; border:2px solid var(--bg2);
     display:flex; align-items:center; justify-content:center;
     font-family:'Bebas Neue',sans-serif; font-size:1.1rem; color:#fff;
   }

   .mm-card__body { padding: 2rem; display:flex; flex-direction:column; gap:.38rem; flex:1; }
   .mm-card__name { font-family:'Bebas Neue',sans-serif; font-size:1.05rem; letter-spacing:.04em; color:var(--text); margin:0; line-height:1.1; }
   .mm-card__bio { font-size:.73rem; color:var(--muted); line-height:1.5; margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
   .mm-card__loc { display:flex; align-items:center; gap:.3rem; font-size:.68rem; color:var(--muted); }
   .mm-card__loc svg { flex-shrink:0; opacity:.5; }
   .mm-card__date { font-family:'DM Mono',monospace; font-size:.56rem; letter-spacing:.07em; color:var(--muted); }
   .mm-card__events { font-family:'DM Mono',monospace; font-size:.57rem; letter-spacing:.08em; color:rgba(240,180,41,.6); margin:0; }

   .mm-cat-badge {
     display:inline-flex; align-items:center; padding:2px 8px; border-radius:6px; width:fit-content;
     font-family:'DM Mono',monospace; font-size:.56rem; letter-spacing:.09em; text-transform:uppercase;
     background:rgba(240,180,41,.08); border:1px solid rgba(240,180,41,.2); color:var(--gold);
   }

   /* Status pill */
   .mm-pill { display:inline-flex; align-items:center; gap:5px; padding:2px 9px; border-radius:100px; width:fit-content; font-family:'DM Mono',monospace; font-size:.55rem; letter-spacing:.1em; text-transform:uppercase; }
   .mm-pill--active   { background:rgba(34,197,94,.1);   border:1px solid rgba(34,197,94,.25);  color:var(--green); }
   .mm-pill--pending  { background:rgba(240,180,41,.1);  border:1px solid rgba(240,180,41,.3);  color:var(--gold); }
   .mm-pill--banned   { background:rgba(255,68,51,.1);   border:1px solid rgba(255,68,51,.25);  color:var(--coral); }
   .mm-pill--rejected { background:rgba(242,238,230,.05);border:1px solid var(--bdr);            color:var(--muted); }
   .mm-pill__dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
   .mm-dot--active  { background:var(--green); animation:dotPulse 1.6s ease-in-out infinite; }
   .mm-dot--pending { background:var(--gold);  animation:dotPulse 1.6s ease-in-out infinite; }
   .mm-dot--banned  { background:var(--coral); }
   .mm-dot--muted   { background:var(--muted); }
   @keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:.3} }

   /* Footer */
   .mm-card__foot { padding:.6rem 1rem .85rem; border-top:1px solid var(--bdr); margin-top:auto; }
   .mm-foot-note { font-size:.72rem; color:var(--muted); }
   .mm-foot-note--warn  { color:var(--coral); }
   .mm-foot-note--green { display:inline-flex; align-items:center; gap:.3rem; color:var(--green); font-size:.72rem; font-weight:600; }

   .mm-join-btn {
     display:inline-flex; align-items:center; gap:.35rem;
     padding:.42rem 1rem; border-radius:10px;
     background:rgba(240,180,41,.1); border:1px solid rgba(240,180,41,.35);
     color:var(--gold); font-family:'Plus Jakarta Sans',sans-serif;
     font-size:.78rem; font-weight:700; cursor:pointer; transition:all .18s;
   }
   .mm-join-btn:hover:not(:disabled) { background:rgba(240,180,41,.2); }
   .mm-join-btn:disabled { opacity:.5; cursor:not-allowed; }

   .mm-rejoin-btn {
     display:inline-flex; align-items:center; gap:.3rem;
     padding:.35rem .9rem; border-radius:100px;
     border:1px solid rgba(165,180,252,.3); background:rgba(165,180,252,.06);
     color:var(--indigo); font-size:.74rem; font-weight:600; cursor:pointer; transition:all .18s;
   }
   .mm-rejoin-btn:hover:not(:disabled) { background:rgba(165,180,252,.14); }
   .mm-rejoin-btn:disabled { opacity:.45; cursor:not-allowed; }

   /* Hint */
   .mm-hint { display:flex; align-items:center; gap:.5rem; padding:1rem 1.75rem; font-size:.8rem; color:var(--muted); }
   .mm-hint__link { color:var(--gold); margin-left:.25rem; text-decoration:none; font-weight:600; }
   .mm-hint__link:hover { text-decoration:underline; }

   /* Skeleton */
   .mm-skel {
     border-radius:18px;
     background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);
     background-size:600px 100%; animation:shimmer 1.5s ease-in-out infinite;
   }
   @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }

   /* Spinner */
   .mm-spin { width:11px; height:11px; border:2px solid rgba(255,255,255,.2); border-top-color:currentColor; border-radius:50%; animation:spin .65s linear infinite; display:inline-block; }
   @keyframes spin { to{transform:rotate(360deg)} }

   /* Toast */
   .mm-toast {
     position:fixed; bottom:2rem; left:50%; transform:translateX(-50%);
     padding:.65rem 1.4rem; border-radius:12px;
     background:rgba(165,180,252,.12); border:1px solid rgba(165,180,252,.3);
     color:var(--indigo); font-size:.82rem; font-weight:600; white-space:nowrap; z-index:300;
     animation:toastIn .3s cubic-bezier(.22,1,.36,1);
   }
   .mm-toast--err { background:rgba(255,68,51,.12); border-color:rgba(255,68,51,.3); color:var(--coral); }
   @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

   @media (max-width:640px) {
     .mm-hero { padding:1.75rem 1.1rem 1.5rem; }
     .mm-section-hd,.mm-grid,.mm-cat-tabs,.mm-hint { padding-inline:1.1rem; }
     .mm-grid { grid-template-columns:1fr; }
   }
 `],
})
export class MyMembershipsPage implements OnInit, OnDestroy {
 private readonly http = inject(HttpClient);
 private readonly auth = inject(AuthService);
 private readonly d$   = new Subject<void>();

 readonly MS = MembershipStatus;

 memberships     = signal<Membership[]>([]);
 loadingMembers  = signal(true);
 discoverOrgs    = signal<DiscoverOrg[]>([]);
 loadingDiscover = signal(true);
 activeCat       = signal<number | null>(null);
 catTabs         = signal<{ id: number; name: string }[]>([]);
 joiningId       = signal<number | null>(null);
 toast           = signal<{ msg: string; type: 'success' | 'error' } | null>(null);
 private toastTimer: ReturnType<typeof setTimeout> | null = null;

 visibleOrgs = computed(() => {
   const cat = this.activeCat();
   return cat === null ? this.discoverOrgs() : this.discoverOrgs().filter(o => o.catId === cat);
 });

 ngOnInit()    { this.loadMemberships(); this.loadDiscover(); }
 ngOnDestroy() {
   this.d$.next(); this.d$.complete();
   if (this.toastTimer) clearTimeout(this.toastTimer);
 }

 // ── A: My memberships — GET /api/User → hydrate missing org details ────────
 private loadMemberships() {
   this.loadingMembers.set(true);
   this.http.get<{ data: any; success: boolean }>(`${BASE}/User`).pipe(
     map(r => r.data),
     catchError(() => of(null)),
     takeUntil(this.d$),
   ).subscribe(user => {
     if (!user) { this.loadingMembers.set(false); return; }
     const raw: any[] = user.memberships ?? [];
     if (raw.length === 0) { this.loadingMembers.set(false); return; }

     const needHydration  = raw.filter(m => !m.organization && m.organizationId);
     const alreadyHydrated = raw.filter(m =>  m.organization || !m.organizationId);

     if (needHydration.length === 0) {
       this.memberships.set(raw.map(m => this.mapM(m)));
       this.loadingMembers.set(false);
       return;
     }

     forkJoin(
       needHydration.map(m =>
         this.http.get<{ data: any }>(`${BASE}/Organization/${m.organizationId}`)
           .pipe(catchError(() => of({ data: null })))
       )
     ).pipe(takeUntil(this.d$)).subscribe(results => {
       const hydrated = needHydration.map((m, i) => ({ ...m, organization: results[i]?.data ?? null }));
       this.memberships.set([...alreadyHydrated, ...hydrated].map(m => this.mapM(m)));
       this.loadingMembers.set(false);
     });
   });
 }

 private mapM(m: any): Membership {
   return {
     organizationId: m.organizationId,
     organization:   m.organization ?? null,
     status:         m.status ?? MembershipStatus.Pending,
     requestDate:    m.requestDate ?? new Date().toISOString(),
     joinDate:       m.joinDate ?? null,
   };
 }

 // ── B: Discover orgs from user's favourite categories ─────────────────────
 private loadDiscover() {
   this.loadingDiscover.set(true);

   this.http.get<{ data: any[]; success: boolean }>(`${BASE}/User/favorites`).pipe(
     map(r => r.data ?? []),
     catchError(() => of([] as any[])),
     takeUntil(this.d$),
   ).subscribe(cats => {
     if (cats.length === 0) { this.loadingDiscover.set(false); return; }

     this.catTabs.set(cats.map((c: any) => ({ id: c.id, name: c.name })));

     forkJoin(
       cats.map((cat: any) =>
         this.http.get<{ data: any[] }>(`${BASE}/Event/Category?categoryId=${cat.id}`).pipe(
           map(r => ({ catId: cat.id, catName: cat.name, events: r.data ?? [] })),
           catchError(() => of({ catId: cat.id, catName: cat.name, events: [] as any[] }))
         )
       )
     ).pipe(takeUntil(this.d$)).subscribe((catResults: any[]) => {
       // Collect unique orgIds
       const orgMap = new Map<number, { catId: number; catName: string }>();
       catResults.forEach(({ catId, catName, events }) => {
         events.forEach((ev: any) => {
           if (ev.organizationId && !orgMap.has(ev.organizationId)) {
             orgMap.set(ev.organizationId, { catId, catName });
           }
         });
       });

       if (orgMap.size === 0) { this.loadingDiscover.set(false); return; }

       const entries = Array.from(orgMap.entries()).slice(0, 20);

       forkJoin(
         entries.map(([orgId]) =>
           forkJoin({
             profile: this.http.get<{ data: any }>(`${BASE}/Organization/${orgId}`)
               .pipe(catchError(() => of({ data: null }))),
             orgEvs: this.http.get<{ data: any[] }>(`${BASE}/Event/organization?organizationId=${orgId}`)
               .pipe(catchError(() => of({ data: [] as any[] }))),
           })
         )
       ).pipe(takeUntil(this.d$)).subscribe(results => {
         const orgs: DiscoverOrg[] = [];
         results.forEach((res, i) => {
           const d = res.profile?.data;
           if (!d) return;
           const [, meta] = entries[i];
           orgs.push({
             id: d.id, name: d.name ?? null, bio: d.bio ?? null,
             city: d.city ?? null, region: d.region ?? null,
             logoUrl: d.logoUrl ?? null, coverUrl: d.coverUrl ?? null,
             catId: meta.catId, catName: meta.catName,
             eventCount: (res.orgEvs?.data ?? []).length,
           });
         });

         // Non-members first, then by event count
         orgs.sort((a, b) => {
           const am = this.membershipOf(a.id) === MembershipStatus.Approved ? 1 : 0;
           const bm = this.membershipOf(b.id) === MembershipStatus.Approved ? 1 : 0;
           return am - bm || b.eventCount - a.eventCount;
         });

         this.discoverOrgs.set(orgs);
         this.loadingDiscover.set(false);
       });
     });
   });
 }

 // ── Join ───────────────────────────────────────────────────────────────────
 join(orgId: number) {
   if (this.joiningId() !== null) return;
   this.joiningId.set(orgId);

   this.http.post<{ success: boolean; message: string | null }>(
     `${BASE}/OrganizationMemberShip/${orgId}/join`, {}
   ).pipe(
     catchError(err => {
       this.showToast(err?.error?.message ?? 'Failed to send request.', 'error');
       this.joiningId.set(null);
       return of(null);
     }),
     takeUntil(this.d$),
   ).subscribe(res => {
     this.joiningId.set(null);
     if (!res) return;
     this.showToast('Join request sent!', 'success');

     if (!this.memberships().some(m => m.organizationId === orgId)) {
       const org = this.discoverOrgs().find(o => o.id === orgId) ?? null;
       this.memberships.update(list => [...list, {
         organizationId: orgId, organization: org,
         status: MembershipStatus.Pending, requestDate: new Date().toISOString(), joinDate: null,
       }]);
     }
   });
 }

 // ── Helpers ────────────────────────────────────────────────────────────────
 membershipOf(orgId: number): MembershipStatus | null {
   return this.memberships().find(m => m.organizationId === orgId)?.status ?? null;
 }
 fmt(iso?: string | null): string {
   if (!iso) return '';
   return new Date(iso).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' });
 }
 statusLbl(s: MembershipStatus): string {
   return ({[MembershipStatus.Approved]:'Active',[MembershipStatus.Pending]:'Pending',
            [MembershipStatus.Banned]:'Banned',[MembershipStatus.Rejected]:'Rejected'} as any)[s] ?? 'Unknown';
 }
 pillCls(s: MembershipStatus): string {
   return ({[MembershipStatus.Approved]:'mm-pill--active',[MembershipStatus.Pending]:'mm-pill--pending',
            [MembershipStatus.Banned]:'mm-pill--banned',[MembershipStatus.Rejected]:'mm-pill--rejected'} as any)[s] ?? '';
 }
 dotCls(s: MembershipStatus): string {
   return ({[MembershipStatus.Approved]:'mm-dot--active',[MembershipStatus.Pending]:'mm-dot--pending',
            [MembershipStatus.Banned]:'mm-dot--banned',[MembershipStatus.Rejected]:'mm-dot--muted'} as any)[s] ?? '';
 }
 private readonly _grads = [
   'linear-gradient(135deg,#6366f1,#8b5cf6)',
   'linear-gradient(135deg,#0891b2,#0e7490)',
   'linear-gradient(135deg,#059669,#047857)',
   'linear-gradient(135deg,#d97706,#b45309)',
   'linear-gradient(135deg,#db2777,#9d174d)',
   'linear-gradient(135deg,#FF4433,#ff6b45)',
 ];
 grad(id: number): string { return 'background:' + this._grads[id % this._grads.length]; }
 onImgErr(e: Event) { (e.target as HTMLImageElement).style.display = 'none'; }

 onCoverErr(e: Event) {
   const img  = e.target as HTMLImageElement;
   const wrap = img.closest('.mm-card__cover') as HTMLElement | null;
   if (!wrap) return;
   img.remove();
   wrap.style.cssText = 'position:relative;height:72px;min-height:72px;max-height:72px;overflow:hidden;flex-shrink:0;background:#0d0d14';
   wrap.innerHTML = `
     <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0px,rgba(255,255,255,.025) 1px,transparent 1px,transparent 20px),repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0px,rgba(255,255,255,.025) 1px,transparent 1px,transparent 20px)"></div>
     <div style="position:absolute;width:120px;height:120px;border-radius:50%;top:-40px;right:20px;background:radial-gradient(circle,rgba(165,180,252,.12) 0%,transparent 70%)"></div>
     <div style="position:absolute;width:80px;height:80px;border-radius:50%;bottom:-30px;left:10px;background:radial-gradient(circle,rgba(240,180,41,.08) 0%,transparent 70%)"></div>`;
 }
 private showToast(msg: string, type: 'success' | 'error') {
   this.toast.set({ msg, type });
   if (this.toastTimer) clearTimeout(this.toastTimer);
   this.toastTimer = setTimeout(() => this.toast.set(null), 3200);
 }
}