// src/app/features/members/memberships-page.ts

import {
 Component, computed, HostListener, inject,
 OnInit, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { toast }                  from 'ngx-sonner';

import { MembershipService }                              from '@core/services/membership.service';
import { AuthService }                                    from '@core/services/auth.service';
import { OrgMembership, MembershipStatus }                from '@core/models/membership.model';

type ActiveTab = 'members' | 'pending' | 'banned';

@Component({
 selector: 'app-memberships-page',
 standalone: true,
 changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [CommonModule, DatePipe],

 styles: [`
   @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
   :host {
     --coral:#FF4433; --coral-dim:rgba(255,68,51,.12);
     --gold:#F0B429;  --gold-dim:rgba(240,180,41,.1);
     --indigo:#a5b4fc;
     --text:#F2EEE6;  --muted:rgba(242,238,230,.4);
     --border:rgba(242,238,230,.07);
     --bg:#060608; --bg2:#0c0c10; --bg3:#111116;
     display:block;
   }
   @keyframes fade-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
   @keyframes shimmer { from{background-position:-800px 0} to{background-position:800px 0} }
   @keyframes spin    { to{transform:rotate(360deg)} }
   @keyframes pulse-ring {
     0%  {box-shadow:0 0 0 0 rgba(240,180,41,.4)}
     70% {box-shadow:0 0 0 7px rgba(240,180,41,0)}
     100%{box-shadow:0 0 0 0 rgba(240,180,41,0)}
   }
   .page-enter{animation:fade-up .4s cubic-bezier(.22,1,.36,1) both}
   .spin{animation:spin .75s linear infinite}
   .skeleton{
     background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.08) 50%,rgba(242,238,230,.04) 75%);
     background-size:1600px 100%;animation:shimmer 1.6s ease-in-out infinite;
     border-radius:20px;border:1px solid var(--border);
   }
   .stat-card{
     position:relative;overflow:hidden;border-radius:20px;
     border:1px solid var(--border);background:var(--bg2);padding:1rem;
     transition:border-color .3s,transform .25s cubic-bezier(.22,1,.36,1);
   }
   .stat-card:hover{transform:translateY(-3px);}
   .stat-card::before{
     content:'';position:absolute;top:0;left:0;right:0;height:1px;
     background:linear-gradient(to right,var(--coral),transparent);
     opacity:0;transition:opacity .3s;
   }
   .stat-card:hover::before{opacity:1;}
   .stat-num{font-family:'Bebas Neue',sans-serif;font-size:2rem;line-height:1;letter-spacing:.04em;color:var(--text);}
   .stat-label{font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-top:.4rem;}
   .stat-icon{position:absolute;right:1.25rem;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;}
   .tab-bar{display:flex;gap:.25rem;border-bottom:1px solid var(--border);}
   .tab-btn{
     display:flex;align-items:center;gap:8px;padding:12px 20px;
     border:none;background:none;cursor:pointer;
     font-family:'DM Mono',monospace;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;
     color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px;
     transition:color .15s,border-color .15s;white-space:nowrap;
   }
   .tab-btn:hover{color:var(--text);}
   .tab-btn.active{color:var(--coral);border-bottom-color:var(--coral);}
   .tab-badge{
     display:inline-flex;align-items:center;justify-content:center;
     min-width:18px;height:18px;padding:0 5px;border-radius:100px;
     font-size:.58rem;font-weight:700;background:var(--coral);color:#fff;line-height:1;
   }
   .tab-badge.dim{background:rgba(242,238,230,.08);color:var(--muted);}
   .search-wrap{position:relative;display:flex;align-items:center;}
   .search-input{
     width:100%;padding:10px 44px 10px 18px;
     background:rgba(242,238,230,.04)!important;border:1px solid var(--border)!important;
     border-radius:100px;outline:none!important;
     font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;color:var(--text)!important;
     transition:border-color .15s,box-shadow .15s;
   }
   .search-input::placeholder{color:rgba(242,238,230,.2)!important;}
   .search-input:focus{border-color:rgba(255,68,51,.4)!important;box-shadow:0 0 0 3px rgba(255,68,51,.08)!important;}
   .member-card{
     position:relative;border-radius:20px;overflow:hidden;
     border:1px solid var(--border);background:var(--bg2);padding:1.25rem;
     transition:border-color .3s,transform .25s cubic-bezier(.22,1,.36,1),box-shadow .3s;
     display:flex;flex-direction:column;gap:1rem;
   }
   .member-card:hover{border-color:rgba(255,68,51,.25);transform:translateY(-3px);box-shadow:0 20px 60px rgba(0,0,0,.5);}
   .member-card::before{
     content:'';position:absolute;inset:0;border-radius:20px;
     background:linear-gradient(160deg,rgba(255,68,51,.03) 0%,transparent 60%);pointer-events:none;
   }
   .mc-glow{position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(to right,var(--coral),transparent);opacity:0;transition:opacity .3s;}
   .member-card:hover .mc-glow{opacity:1;}
   .pending-card{border-color:rgba(240,180,41,.14);}
   .pending-card:hover{border-color:rgba(240,180,41,.35);}
   .avatar{
     width:52px;height:52px;border-radius:16px;flex-shrink:0;overflow:hidden;
     display:flex;align-items:center;justify-content:center;
     font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:.04em;color:#fff;
   }
   .avatar img{width:100%;height:100%;object-fit:cover;}
   .status-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;border:1.5px solid var(--bg2);}
   .status-dot.approved{background:#10b981;}
   .status-dot.pending{background:var(--gold);animation:pulse-ring 2s infinite;}
   .status-dot.banned{background:#f87171;}
   .status-pill{
     display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;
     font-family:'DM Mono',monospace;font-size:.58rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;
   }
   .sp-approved{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);color:#10b981;}
   .sp-pending{background:rgba(240,180,41,.1);border:1px solid rgba(240,180,41,.25);color:var(--gold);}
   .sp-banned{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.2);color:#f87171;}
   .sp-rejected{background:rgba(242,238,230,.05);border:1px solid rgba(242,238,230,.1);color:var(--muted);}
   .action-btn{
     flex:1;display:flex;align-items:center;justify-content:center;gap:5px;
     padding:8px 10px;border-radius:12px;border:none;cursor:pointer;
     font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;font-weight:500;
     transition:all .15s;white-space:nowrap;
   }
   .btn-approve{background:rgba(16,185,129,.08);color:#10b981;border:1px solid rgba(16,185,129,.2);}
   .btn-approve:hover{background:rgba(16,185,129,.18);}
   .btn-reject{background:rgba(242,238,230,.04);color:rgba(242,238,230,.4);border:1px solid rgba(242,238,230,.08);}
   .btn-reject:hover{background:rgba(239,68,68,.1);color:#f87171;border-color:rgba(239,68,68,.2);}
   .btn-ban{background:rgba(240,180,41,.06);color:rgba(240,180,41,.6);border:1px solid rgba(240,180,41,.12);}
   .btn-ban:hover{background:rgba(240,180,41,.14);color:var(--gold);border-color:rgba(240,180,41,.3);}
   .btn-unban{background:rgba(165,180,252,.08);color:var(--indigo);border:1px solid rgba(165,180,252,.18);}
   .btn-unban:hover{background:rgba(165,180,252,.18);}
   .btn-remove{background:rgba(242,238,230,.03);color:rgba(242,238,230,.3);border:1px solid rgba(242,238,230,.06);}
   .btn-remove:hover{background:rgba(239,68,68,.1);color:#f87171;border-color:rgba(239,68,68,.2);}
   .card-busy{
     position:absolute;inset:0;border-radius:20px;z-index:10;
     background:rgba(6,6,8,.65);backdrop-filter:blur(4px);
     display:flex;align-items:center;justify-content:center;
   }
   ::-webkit-scrollbar{width:3px;}
   ::-webkit-scrollbar-track{background:transparent;}
   ::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px;}
 `],

 template: `
<div class="w-full min-h-full" style="background:#060608;color:#F2EEE6;font-family:'Plus Jakarta Sans',sans-serif">

 <!-- HEADER -->
 <div class="relative overflow-hidden border-b" style="border-color:rgba(242,238,230,.06)">
   <div class="absolute inset-0 pointer-events-none overflow-hidden">
     <div class="absolute" style="width:50vw;height:50vw;top:-25%;left:-12%;background:radial-gradient(circle,rgba(99,102,241,.07) 0%,transparent 65%);filter:blur(80px);border-radius:50%"></div>
     <div class="absolute" style="width:35vw;height:35vw;top:5%;right:-6%;background:radial-gradient(circle,rgba(255,68,51,.05) 0%,transparent 65%);filter:blur(80px);border-radius:50%"></div>
   </div>
   <div class="relative z-10 max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10">
     <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
       <div>
         <div class="flex items-center gap-2 mb-4">
           <span style="font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(165,180,252,.75)">
             ◆ Organisation
           </span>
         </div>
         <h1 style="font-family:'Bebas Neue',sans-serif;font-size:clamp(3.5rem,8vw,7rem);line-height:.88;letter-spacing:.03em;color:#F2EEE6;margin:0">
           YOUR<br/>
           <span style="color:transparent;-webkit-text-stroke:2px #a5b4fc">MEMBERS</span>
         </h1>
         <p class="mt-3" style="font-size:.9rem;color:rgba(242,238,230,.42);font-weight:300;max-width:400px;line-height:1.7">
           Manage membership requests, active members, and access control for your organisation.
         </p>
       </div>
       @if (!loading() && allMembers().length > 0) {
         <div style="font-family:'DM Mono',monospace;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(242,238,230,.28)">
           {{ allMembers().length }} total
         </div>
       }
     </div>

     @if (!loading() && allMembers().length > 0) {
       <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
         @for (s of statsCards(); track s.label; let i = $index) {
           <div class="stat-card page-enter" [style.animation-delay]="i * 60 + 'ms'">
             <div class="stat-num">{{ s.value }}</div>
             <div class="stat-label">{{ s.label }}</div>
             <div class="stat-icon" [style.background]="s.bgColor">
               <svg class="w-5 h-5" [style.color]="s.color" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                 <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="s.path"/>
               </svg>
             </div>
           </div>
         }
       </div>
     }
   </div>
 </div>

 <!-- TAB BAR + SEARCH -->
 @if (!loading() && orgId()) {
   <div class="sticky top-0 z-30 border-b" style="background:rgba(6,6,8,.92);backdrop-filter:blur(20px);border-color:rgba(242,238,230,.06)">
     <div class="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
       <div class="flex items-center justify-between gap-4">
         <div class="tab-bar flex-1">
           <button class="tab-btn" [class.active]="activeTab() === 'members'" (click)="setTab('members')">
             Members
             <span class="tab-badge" [class.dim]="approvedCount() === 0">{{ approvedCount() }}</span>
           </button>
           <button class="tab-btn" [class.active]="activeTab() === 'pending'" (click)="setTab('pending')">
             Pending
             @if (pendingCount() > 0) {
               <span class="tab-badge">{{ pendingCount() }}</span>
             } @else {
               <span class="tab-badge dim">0</span>
             }
           </button>
           <button class="tab-btn" [class.active]="activeTab() === 'banned'" (click)="setTab('banned')">
             Banned
             <span class="tab-badge dim">{{ bannedCount() }}</span>
           </button>
         </div>
         <div class="search-wrap w-56 shrink-0 py-2">
           <input class="search-input" type="text" placeholder="Search name or email…"
                  [value]="searchQuery()"
                  (input)="onSearch($event)"/>
           <svg class="absolute right-4 w-3.5 h-3.5 pointer-events-none" style="color:rgba(242,238,230,.22)"
                fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z"/>
           </svg>
         </div>
       </div>
     </div>
   </div>
 }

 <!-- CONTENT -->
 <div class="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-8">

   @if (loading()) {
     <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
       @for (i of [1,2,3,4,5,6,7,8]; track i) {
         <div class="skeleton h-52" [style.animation-delay]="i * 40 + 'ms'"></div>
       }
     </div>

   } @else if (!orgId()) {
     <div class="flex flex-col items-center justify-center py-28 text-center space-y-5">
       <div class="w-20 h-20 rounded-2xl flex items-center justify-center" style="background:rgba(255,68,51,.08);border:1px solid rgba(255,68,51,.2)">
         <svg class="w-9 h-9" style="color:#FF4433" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
         </svg>
       </div>
       <div>
         <p style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:.06em">No Organisation Found</p>
         <p class="mt-1" style="font-size:.85rem;color:rgba(242,238,230,.38)">Log in with an organisation account to manage members.</p>
       </div>
     </div>

   } @else if (allMembers().length === 0) {
     <div class="flex flex-col items-center justify-center py-28 text-center space-y-5">
       <div class="w-24 h-24 rounded-3xl flex items-center justify-center" style="background:rgba(165,180,252,.06);border:1px solid rgba(165,180,252,.15)">
         <svg class="w-10 h-10" style="color:rgba(165,180,252,.4)" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
         </svg>
       </div>
       <div>
         <p style="font-family:'Bebas Neue',sans-serif;font-size:2rem;letter-spacing:.06em">No Members Yet</p>
         <p class="mt-1" style="font-size:.88rem;color:rgba(242,238,230,.38);max-width:320px;margin-inline:auto;line-height:1.7">
           Members will appear here once users join your organisation.
         </p>
       </div>
     </div>

   } @else if (visibleMembers().length === 0) {
     <div class="flex flex-col items-center justify-center py-24 text-center space-y-4">
       <svg class="w-10 h-10" style="color:rgba(242,238,230,.18)" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z"/>
       </svg>
       <div>
         <p style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:.06em">{{ emptyLabel() }}</p>
         @if (searchQuery().trim()) {
           <p class="mt-1" style="font-size:.8rem;color:rgba(242,238,230,.3)">Try a different search term.</p>
         }
       </div>
     </div>

   } @else {
     <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
       @for (m of visibleMembers(); track m.userId; let i = $index) {
         <div class="member-card page-enter"
              [class.pending-card]="m.status === MS.Pending"
              [style.animation-delay]="i * 45 + 'ms'">

           @if (busyId() === m.userId) {
             <div class="card-busy">
               <div class="spin w-6 h-6 rounded-full" style="border:2px solid rgba(255,255,255,.15);border-top-color:#fff"></div>
             </div>
           }

           <!-- Avatar + name -->
           <div class="flex items-start gap-3">
             <div class="avatar" [style]="getAvatarStyle(m)">
               @if (m.user?.logoUrl) {
                 <img [src]="m.user!.logoUrl!" [alt]="displayName(m)" (error)="onAvatarErr($event)"/>
               } @else {
                 {{ initials(m) }}
               }
             </div>
             <div class="flex-1 min-w-0">
               <div class="flex items-center gap-1.5 mb-0.5">
                 <span class="status-dot"
                       [class.approved]="m.status === MS.Approved"
                       [class.pending]="m.status === MS.Pending"
                       [class.banned]="m.status === MS.Banned"></span>
                 <p class="truncate" style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;letter-spacing:.03em;color:#F2EEE6;line-height:1.1">
                   {{ displayName(m) }}
                 </p>
               </div>
               @if (m.user?.email) {
                 <p class="truncate" style="font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.08em;color:rgba(242,238,230,.3)">
                   {{ m.user!.email }}
                 </p>
               }
             </div>
           </div>

           <!-- Info -->
           <div class="space-y-2">
             <div class="flex items-center justify-between gap-2 flex-wrap">
               <span class="status-pill"
                     [class.sp-approved]="m.status === MS.Approved"
                     [class.sp-pending]="m.status === MS.Pending"
                     [class.sp-banned]="m.status === MS.Banned"
                     [class.sp-rejected]="m.status === MS.Rejected">
                 {{ statusLabel(m.status) }}
               </span>
               @if (m.user?.city) {
                 <span style="font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.08em;color:rgba(242,238,230,.28)">
                   {{ m.user!.city }}{{ m.user?.region ? ', ' + m.user!.region : '' }}
                 </span>
               }
             </div>
             @if (m.status === MS.Pending || m.status === MS.Rejected) {
               <p style="font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.08em;color:rgba(242,238,230,.25)">
                 Requested {{ m.requestDate | date:'MMM d, y' }}
               </p>
             } @else if (m.joinDate) {
               <p style="font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.08em;color:rgba(242,238,230,.25)">
                 Joined {{ m.joinDate | date:'MMM d, y' }}
               </p>
             }
           </div>

           <!-- Actions -->
           <div class="flex gap-2 mt-auto">
             @if (m.status === MS.Pending) {
               <button class="action-btn btn-approve" (click)="approveRequest(m)">
                 <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                 </svg>
                 Approve
               </button>
               <button class="action-btn btn-reject" (click)="rejectRequest(m)">
                 <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                 </svg>
                 Reject
               </button>
             }
             @if (m.status === MS.Approved) {
               <button class="action-btn btn-ban" (click)="banMember(m)">
                 <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                 </svg>
                 Ban
               </button>
               <button class="action-btn btn-remove" (click)="removeMember(m)">
                 <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"/>
                 </svg>
                 Remove
               </button>
             }
             @if (m.status === MS.Banned) {
               <button class="action-btn btn-unban" (click)="unbanMember(m)">
                 <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
                 </svg>
                 Unban
               </button>
               <button class="action-btn btn-remove" (click)="removeMember(m)">
                 <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"/>
                 </svg>
                 Remove
               </button>
             }
           </div>

           <div class="mc-glow"></div>
         </div>
       }
     </div>
   }

 </div>
</div>
 `,
})
export class MembershipsPageComponent implements OnInit {
 private membershipService = inject(MembershipService);
 private authService       = inject(AuthService);

 readonly MS = MembershipStatus;

 orgId       = signal<number | null>(null);
 allMembers  = signal<OrgMembership[]>([]);
 loading     = signal(false);
 busyId      = signal<number | null>(null);
 activeTab   = signal<ActiveTab>('members');
 searchQuery = signal('');

 approvedCount = computed(() => this.allMembers().filter(m => m.status === MembershipStatus.Approved).length);
 pendingCount  = computed(() => this.allMembers().filter(m => m.status === MembershipStatus.Pending).length);
 bannedCount   = computed(() => this.allMembers().filter(m => m.status === MembershipStatus.Banned).length);

 statsCards = computed(() => [
   {
     label: 'Total', value: this.allMembers().length,
     color: '#a5b4fc', bgColor: 'rgba(99,102,241,.1)',
     path: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
   },
   {
     label: 'Active', value: this.approvedCount(),
     color: '#10b981', bgColor: 'rgba(16,185,129,.1)',
     path: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
   },
   {
     label: 'Pending', value: this.pendingCount(),
     color: '#F0B429', bgColor: 'rgba(240,180,41,.1)',
     path: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
   },
   {
     label: 'Banned', value: this.bannedCount(),
     color: '#f87171', bgColor: 'rgba(248,113,113,.1)',
     path: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
   },
 ]);

 visibleMembers = computed<OrgMembership[]>(() => {
   const statusMap: Record<ActiveTab, MembershipStatus[]> = {
     members: [MembershipStatus.Approved],
     pending: [MembershipStatus.Pending],
     banned:  [MembershipStatus.Banned],
   };
   const q = this.searchQuery().trim().toLowerCase();
   return this.allMembers()
     .filter(m => statusMap[this.activeTab()].includes(m.status))
     .filter(m => {
       if (!q) return true;
       return this.displayName(m).toLowerCase().includes(q) ||
              (m.user?.email ?? '').toLowerCase().includes(q);
     });
 });

 emptyLabel = computed<string>(() => {
   if (this.searchQuery().trim()) return 'No matches found';
   return { members: 'No Active Members', pending: 'No Pending Requests', banned: 'No Banned Members' }[this.activeTab()];
 });

 ngOnInit() {
   const org = this.authService.getOrganization();
   if (org) { this.orgId.set(org.id); this.loadMembers(org.id); }
 }

 @HostListener('document:click') onDocClick() {}

 private loadMembers(orgId: number) {
   this.loading.set(true);
   this.membershipService.getAllMembers(orgId).subscribe({
     next:  ms => { this.allMembers.set(ms); this.loading.set(false); },
     error: ()  => { toast.error('Failed to load members'); this.loading.set(false); },
   });
 }
setTab(t: ActiveTab) { this.activeTab.set(t); this.searchQuery.set(''); }
onSearch(e: Event)   { this.searchQuery.set((e.target as HTMLInputElement).value); }

 approveRequest(m: OrgMembership) {
   if (this.busyId() !== null) return;
   this.busyId.set(m.userId);
   this.membershipService
     .processRequest({ userId: m.userId, organizationId: this.orgId()!, isApproved: true })
     .subscribe({
       next: () => {
         this.allMembers.update(l => l.map(x => x.userId === m.userId
           ? { ...x, status: MembershipStatus.Approved, joinDate: new Date().toISOString() } : x));
         toast.success(this.displayName(m) + ' approved');
         this.busyId.set(null);
       },
       error: err => { toast.error(err.error?.message || 'Failed to approve'); this.busyId.set(null); },
     });
 }

 rejectRequest(m: OrgMembership) {
   if (this.busyId() !== null) return;
   if (!confirm('Reject ' + this.displayName(m) + "'s request?")) return;
   this.busyId.set(m.userId);
   this.membershipService
     .processRequest({ userId: m.userId, organizationId: this.orgId()!, isApproved: false })
     .subscribe({
       next: () => {
         this.allMembers.update(l => l.map(x => x.userId === m.userId ? { ...x, status: MembershipStatus.Rejected } : x));
         toast.success('Request rejected');
         this.busyId.set(null);
       },
       error: err => { toast.error(err.error?.message || 'Failed to reject'); this.busyId.set(null); },
     });
 }

 banMember(m: OrgMembership) {
   if (this.busyId() !== null) return;
   if (!confirm('Ban ' + this.displayName(m) + '? They will lose access to this organisation.')) return;
   this.busyId.set(m.userId);
   this.membershipService.banUser(this.orgId()!, m.userId).subscribe({
     next: () => {
       this.allMembers.update(l => l.map(x => x.userId === m.userId ? { ...x, status: MembershipStatus.Banned } : x));
       toast.success(this.displayName(m) + ' banned');
       this.busyId.set(null);
     },
     error: err => { toast.error(err.error?.message || 'Failed to ban'); this.busyId.set(null); },
   });
 }

 unbanMember(m: OrgMembership) {
   if (this.busyId() !== null) return;
   this.busyId.set(m.userId);
   this.membershipService.unbanUser(this.orgId()!, m.userId).subscribe({
     next: () => {
       this.allMembers.update(l => l.map(x => x.userId === m.userId ? { ...x, status: MembershipStatus.Approved } : x));
       toast.success(this.displayName(m) + ' unbanned');
       this.busyId.set(null);
     },
     error: err => { toast.error(err.error?.message || 'Failed to unban'); this.busyId.set(null); },
   });
 }

 removeMember(m: OrgMembership) {
   if (this.busyId() !== null) return;
   if (!confirm('Remove ' + this.displayName(m) + ' from your organisation? This cannot be undone.')) return;
   this.busyId.set(m.userId);
   this.membershipService.removeMember(this.orgId()!, m.userId).subscribe({
     next: () => {
       this.allMembers.update(l => l.filter(x => x.userId !== m.userId));
       toast.success(this.displayName(m) + ' removed');
       this.busyId.set(null);
     },
     error: err => { toast.error(err.error?.message || 'Failed to remove'); this.busyId.set(null); },
   });
 }

 displayName(m: OrgMembership): string {
   const u = m.user;
   if (!u) return 'User #' + m.userId;
   const full = [u.firstName, u.lastName].filter(Boolean).join(' ');
   return full || u.email || 'User #' + m.userId;
 }

 initials(m: OrgMembership): string {
   const u = m.user;
   if (!u) return '?';
   const f = u.firstName?.[0] ?? '';
   const l = u.lastName?.[0]  ?? '';
   return (f + l).toUpperCase() || (u.email?.[0]?.toUpperCase() ?? '?');
 }

 statusLabel(s: MembershipStatus): string {
   const map: Record<number, string> = {
     [MembershipStatus.Approved]: 'Active',
     [MembershipStatus.Pending]:  'Pending',
     [MembershipStatus.Banned]:   'Banned',
     [MembershipStatus.Rejected]: 'Rejected',
   };
   return map[s] ?? 'Unknown';
 }

 private readonly _palettes = [
   'linear-gradient(135deg,#FF4433,#ff6b45)',
   'linear-gradient(135deg,#4f46e5,#7c3aed)',
   'linear-gradient(135deg,#0891b2,#0e7490)',
   'linear-gradient(135deg,#059669,#047857)',
   'linear-gradient(135deg,#d97706,#b45309)',
   'linear-gradient(135deg,#db2777,#9d174d)',
 ];

 getAvatarStyle(m: OrgMembership): string {
   return 'background:' + this._palettes[m.userId % this._palettes.length];
 }

 onAvatarErr(e: Event) { (e.target as HTMLImageElement).style.display = 'none'; }
}