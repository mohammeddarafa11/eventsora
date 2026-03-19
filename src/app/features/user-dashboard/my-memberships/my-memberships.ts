// src/app/features/user-dashboard/my-memberships/my-memberships.ts

import {
  Component, computed, inject, OnInit,
  signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe }    from '@angular/common';
import { toast }                     from 'ngx-sonner';

import { UserMembershipService }     from '@core/services/user-membership.service';
import {
  UserOrgMembership,
  OrgSummary,
  MembershipStatus,
}                                    from '@core/models/user-membership.model';

type ActiveTab = 'joined' | 'pending' | 'browse';

@Component({
  selector: 'app-my-memberships',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe],

  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

    @keyframes fade-up {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes shimmer {
      from { background-position: -800px 0; }
      to   { background-position:  800px 0; }
    }
    @keyframes spin-anim { to { transform: rotate(360deg); } }

    .font-bebas   { font-family: 'Bebas Neue', sans-serif; }
    .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-mono-dm { font-family: 'DM Mono', monospace; }

    .page-enter { animation: fade-up .38s cubic-bezier(.22,1,.36,1) both; }
    .spin       { animation: spin-anim .75s linear infinite; }

    .skeleton {
      background: linear-gradient(
        90deg,
        rgba(242,238,230,.04) 25%,
        rgba(242,238,230,.09) 50%,
        rgba(242,238,230,.04) 75%
      );
      background-size: 1600px 100%;
      animation: shimmer 1.6s ease-in-out infinite;
    }

    .cover-fade {
      background: linear-gradient(to top, #0c0c10 0%, transparent 100%);
    }

    .stat-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(to right, #a5b4fc, transparent);
      opacity: 0; transition: opacity .3s;
    }
    .stat-card:hover::before { opacity: 1; }

    .org-glow {
      position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(to right, #a5b4fc, transparent);
      opacity: 0; transition: opacity .3s;
    }
    .org-card:hover .org-glow { opacity: 1; }

    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .text-stroke-indigo {
      color: transparent;
      -webkit-text-stroke: 2px #a5b4fc;
    }

    ::-webkit-scrollbar       { width: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(242,238,230,.07); border-radius: 99px; }
  `],

  template: `
<div class="w-full min-h-full font-jakarta" style="background:#060608; color:#F2EEE6;">

  <!-- ══════════════  HEADER  ══════════════ -->
  <header class="relative overflow-hidden border-b border-white/[0.06]">
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute rounded-full"
           style="width:70vw;height:70vw;top:-30%;left:-15%;
                  background:radial-gradient(circle,rgba(165,180,252,.08) 0%,transparent 65%);
                  filter:blur(80px)"></div>
      <div class="absolute rounded-full"
           style="width:50vw;height:50vw;top:0;right:-10%;
                  background:radial-gradient(circle,rgba(99,102,241,.05) 0%,transparent 65%);
                  filter:blur(80px)"></div>
    </div>

    <div class="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-10">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span class="font-mono-dm text-[0.56rem] tracking-[.22em] uppercase text-indigo-300/75 mb-3 block">
            ◆ Your Account
          </span>
          <h1 class="font-bebas leading-[.88] tracking-wider m-0"
              style="font-size:clamp(2.8rem,11vw,7rem)">
            MY<br/>
            <span class="text-stroke-indigo">ORGS</span>
          </h1>
          <p class="mt-2 text-sm text-white/40 font-light max-w-sm leading-relaxed">
            Browse and join organisations, track your membership status, and manage your connections.
          </p>
        </div>
        @if (!loading() && !browseLoading()) {
          <span class="font-mono-dm text-[0.58rem] tracking-widest uppercase text-white/25">
            {{ allOrgs().length }} organisations available
          </span>
        }
      </div>

      <!-- Stat cards -->
      @if (!loading() && myMemberships().length > 0) {
        <div class="grid grid-cols-3 gap-3 mt-6">
          @for (s of statsCards(); track s.label; let i = $index) {
            <div class="stat-card relative overflow-hidden rounded-2xl border border-white/[0.07]
                        bg-[#0c0c10] p-3.5 cursor-default page-enter
                        transition-all duration-300 hover:-translate-y-1"
                 [style.animation-delay]="i * 60 + 'ms'">
              <div class="font-bebas text-3xl leading-none tracking-wider" [style.color]="s.color">
                {{ s.value }}
              </div>
              <div class="font-mono-dm text-[0.56rem] tracking-[.18em] uppercase text-white/40 mt-1">
                {{ s.label }}
              </div>
              <div class="absolute right-3.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl
                          flex items-center justify-center" [style.background]="s.bgColor">
                <svg class="w-4 h-4" [style.color]="s.color"
                     fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="s.path"/>
                </svg>
              </div>
            </div>
          }
        </div>
      }
    </div>
  </header>

  <!-- ══════════════  STICKY TAB BAR  ══════════════ -->
  <div class="sticky top-0 z-30 border-b border-white/[0.06]"
       style="background:rgba(6,6,8,.94);backdrop-filter:blur(20px)">
    <div class="max-w-screen-xl mx-auto px-4 sm:px-8 lg:px-12">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4">

        <!-- Tabs -->
        <div class="flex overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none]
                    [&::-webkit-scrollbar]:hidden border-b sm:border-b-0 border-white/[0.06] -mb-px">

          <!-- Joined -->
          <button (click)="setTab('joined')"
                  class="font-mono-dm text-[0.6rem] tracking-[.12em] uppercase flex items-center
                         gap-1.5 px-3.5 py-2.5 border-b-2 shrink-0 bg-transparent cursor-pointer
                         hover:text-white/80 transition-colors duration-150 whitespace-nowrap"
                  [class.text-indigo-300]="activeTab()==='joined'"
                  [class.border-indigo-300]="activeTab()==='joined'"
                  [class.text-white/40]="activeTab()!=='joined'"
                  [class.border-transparent]="activeTab()!=='joined'">
            Joined
            <span class="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1
                         rounded-full text-[0.54rem] font-bold leading-none"
                  [class.bg-indigo-400]="joinedCount()>0" [class.text-indigo-950]="joinedCount()>0"
                  [class.bg-white/10]="joinedCount()===0" [class.text-white/40]="joinedCount()===0">
              {{ joinedCount() }}
            </span>
          </button>

          <!-- Pending -->
          <button (click)="setTab('pending')"
                  class="font-mono-dm text-[0.6rem] tracking-[.12em] uppercase flex items-center
                         gap-1.5 px-3.5 py-2.5 border-b-2 shrink-0 bg-transparent cursor-pointer
                         hover:text-white/80 transition-colors duration-150 whitespace-nowrap"
                  [class.text-indigo-300]="activeTab()==='pending'"
                  [class.border-indigo-300]="activeTab()==='pending'"
                  [class.text-white/40]="activeTab()!=='pending'"
                  [class.border-transparent]="activeTab()!=='pending'">
            Pending
            <span class="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1
                         rounded-full text-[0.54rem] font-bold leading-none"
                  [class.bg-red-500]="pendingCount()>0" [class.text-white]="pendingCount()>0"
                  [class.bg-white/10]="pendingCount()===0" [class.text-white/40]="pendingCount()===0">
              {{ pendingCount() }}
            </span>
          </button>

          <!-- Browse -->
          <button (click)="setTab('browse')"
                  class="font-mono-dm text-[0.6rem] tracking-[.12em] uppercase flex items-center
                         gap-1.5 px-3.5 py-2.5 border-b-2 shrink-0 bg-transparent cursor-pointer
                         hover:text-white/80 transition-colors duration-150 whitespace-nowrap"
                  [class.text-indigo-300]="activeTab()==='browse'"
                  [class.border-indigo-300]="activeTab()==='browse'"
                  [class.text-white/40]="activeTab()!=='browse'"
                  [class.border-transparent]="activeTab()!=='browse'">
            Browse All
            <span class="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1
                         rounded-full text-[0.54rem] font-bold leading-none bg-indigo-400 text-indigo-950">
              {{ allOrgs().length }}
            </span>
          </button>
        </div>

        <!-- Search -->
        <div class="relative flex items-center py-2 sm:w-52 sm:shrink-0">
          <input type="text"
                 [placeholder]="activeTab()==='browse' ? 'Search organisations…' : 'Search my orgs…'"
                 [value]="searchQuery()"
                 (input)="onSearch($event)"
                 class="w-full py-2 pl-4 pr-10 rounded-full text-[13px] text-white/90 outline-none
                        bg-white/[0.04] border border-white/[0.07] placeholder:text-white/20
                        focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-400/10
                        transition-all duration-150"/>
          <svg class="absolute right-3.5 w-3.5 h-3.5 text-white/20 pointer-events-none"
               fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z"/>
          </svg>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════  MAIN CONTENT  ══════════════ -->
  <main class="max-w-screen-xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-8">

    <!-- Loading -->
    @if (loading() || (activeTab()==='browse' && browseLoading())) {
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        @for (i of [1,2,3,4,5,6,7,8]; track i) {
          <div class="skeleton rounded-2xl border border-white/[0.07] h-52"
               [style.animation-delay]="i*40+'ms'"></div>
        }
      </div>

    <!-- ── BROWSE TAB ── -->
    } @else if (activeTab()==='browse') {
      @if (filteredBrowseOrgs().length === 0) {
        <div class="flex flex-col items-center justify-center py-20 text-center gap-4">
          <svg class="w-9 h-9 text-white/[0.18]" fill="none" stroke="currentColor"
               stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z"/>
          </svg>
          <div>
            <p class="font-bebas text-xl tracking-wider">No organisations found</p>
            @if (searchQuery().trim()) {
              <p class="mt-1 text-xs text-white/30">Try a different search term.</p>
            }
          </div>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          @for (org of filteredBrowseOrgs(); track org.id; let i = $index) {
            <div class="org-card relative rounded-2xl overflow-hidden border border-white/[0.07]
                        bg-[#0c0c10] flex flex-col page-enter
                        transition-all duration-300 hover:-translate-y-1
                        hover:border-indigo-400/25 hover:shadow-[0_20px_60px_rgba(0,0,0,.5)]"
                 [style.animation-delay]="i*40+'ms'">

              @if (busyId()===org.id) {
                <div class="absolute inset-0 z-10 rounded-2xl flex items-center justify-center"
                     style="background:rgba(6,6,8,.7);backdrop-filter:blur(4px)">
                  <div class="spin w-6 h-6 rounded-full border-2 border-white/15 border-t-white"></div>
                </div>
              }

              <!-- Cover -->
              <div class="relative h-[72px] shrink-0 overflow-hidden"
                   style="background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(165,180,252,.05))">
                @if (org.coverUrl) {
                  <img [src]="org.coverUrl" [alt]="org.name??''"
                       class="w-full h-full object-cover opacity-70" (error)="onImgErr($event)"/>
                }
                <div class="cover-fade absolute inset-0"></div>
              </div>

              <!-- Body -->
              <div class="px-4 pb-4 flex flex-col gap-3 flex-1">
                <!-- Logo + name -->
                <div class="flex items-end gap-3">
                  <div class="w-11 h-11 rounded-xl shrink-0 overflow-hidden border-2 border-[#0c0c10]
                              -mt-[22px] relative z-[1] flex items-center justify-center"
                       [style]="getLogoStyle(org)">
                    @if (org.logoUrl) {
                      <img [src]="org.logoUrl" [alt]="org.name??''"
                           class="w-full h-full object-cover" (error)="onImgErr($event)"/>
                    } @else {
                      <span class="font-bebas text-base text-white">{{ orgInitials(org) }}</span>
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-bebas text-base tracking-wide leading-tight truncate">
                      {{ org.name ?? 'Unnamed Org' }}
                    </p>
                    @if (org.city) {
                      <p class="font-mono-dm text-[0.54rem] tracking-wider text-white/30">
                        {{ org.city }}{{ org.region ? ', '+org.region : '' }}
                      </p>
                    }
                  </div>
                </div>

                @if (org.bio) {
                  <p class="text-[0.78rem] text-white/38 leading-relaxed line-clamp-2">{{ org.bio }}</p>
                }

                <!-- Status badge -->
                <div class="mt-auto">
                  @if (getMembershipStatus(org.id)===MS.Approved) {
                    <span class="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full border
                                 font-mono-dm text-[0.54rem] tracking-widest uppercase font-medium
                                 bg-emerald-500/10 border-emerald-500/20 text-emerald-400">● Member</span>
                  } @else if (getMembershipStatus(org.id)===MS.Pending) {
                    <span class="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full border
                                 font-mono-dm text-[0.54rem] tracking-widest uppercase font-medium
                                 bg-amber-400/10 border-amber-400/25 text-amber-400">◎ Requested</span>
                  } @else if (getMembershipStatus(org.id)===MS.Banned) {
                    <span class="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full border
                                 font-mono-dm text-[0.54rem] tracking-widest uppercase font-medium
                                 bg-red-400/10 border-red-400/20 text-red-400">✕ Banned</span>
                  }
                </div>

                <!-- CTA -->
                <div class="flex gap-2">
                  @if (getMembershipStatus(org.id)===null) {
                    <button (click)="join(org)" [disabled]="busyId()!==null"
                            class="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3
                                   rounded-xl font-mono-dm text-[0.6rem] tracking-wider uppercase font-medium
                                   bg-indigo-400/10 text-indigo-300 border border-indigo-400/20
                                   hover:bg-indigo-400/20 disabled:opacity-35 disabled:cursor-not-allowed
                                   transition-all duration-150 cursor-pointer">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
                      </svg>
                      Join
                    </button>

                  } @else if (getMembershipStatus(org.id)===MS.Pending) {
                    <button disabled
                            class="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3
                                   rounded-xl font-mono-dm text-[0.6rem] tracking-wider uppercase font-medium
                                   bg-amber-400/[0.06] text-amber-400/50 border border-amber-400/12 cursor-default">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      Pending…
                    </button>

                  } @else if (getMembershipStatus(org.id)===MS.Approved) {
                    <button (click)="leave(org.id, org.name??'this org')" [disabled]="busyId()!==null"
                            class="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3
                                   rounded-xl font-mono-dm text-[0.6rem] tracking-wider uppercase font-medium
                                   bg-white/[0.04] text-white/40 border border-white/[0.08]
                                   hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20
                                   disabled:opacity-35 disabled:cursor-not-allowed
                                   transition-all duration-150 cursor-pointer">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
                      </svg>
                      Leave
                    </button>
                  }
                </div>
              </div>
              <div class="org-glow"></div>
            </div>
          }
        </div>
      }

    <!-- ── JOINED / PENDING TABS ── -->
    } @else {
      @if (filteredMyOrgs().length === 0) {
        <div class="flex flex-col items-center justify-center py-24 text-center gap-5">
          <div class="w-20 h-20 rounded-3xl flex items-center justify-center
                      bg-indigo-400/[0.06] border border-indigo-400/15">
            <svg class="w-10 h-10 text-indigo-400/35" fill="none" stroke="currentColor"
                 stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/>
            </svg>
          </div>
          <div>
            <p class="font-bebas text-2xl tracking-widest">{{ emptyLabel() }}</p>
            <p class="mt-1 text-[0.84rem] text-white/38 max-w-xs mx-auto leading-relaxed">
              {{ emptySubLabel() }}
            </p>
          </div>
          @if (activeTab()==='joined') {
            <button (click)="setTab('browse')"
                    class="flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer
                           font-mono-dm text-[0.6rem] tracking-wider uppercase font-medium
                           bg-indigo-400/10 text-indigo-300 border border-indigo-400/20
                           hover:bg-indigo-400/20 transition-all duration-150">
              Browse Organisations
            </button>
          }
        </div>

      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          @for (m of filteredMyOrgs(); track m.organizationId; let i = $index) {
            <div class="org-card relative rounded-2xl overflow-hidden flex flex-col page-enter
                        border bg-[#0c0c10]
                        transition-all duration-300 hover:-translate-y-1
                        hover:shadow-[0_20px_60px_rgba(0,0,0,.5)]"
                 [class.border-amber-400/20]="m.status===MS.Pending"
                 [class.hover:border-amber-400/35]="m.status===MS.Pending"
                 [class.border-white/[0.07]]="m.status!==MS.Pending"
                 [class.hover:border-indigo-400/25]="m.status!==MS.Pending"
                 [style.animation-delay]="i*45+'ms'">

              @if (busyId()===m.organizationId) {
                <div class="absolute inset-0 z-10 rounded-2xl flex items-center justify-center"
                     style="background:rgba(6,6,8,.7);backdrop-filter:blur(4px)">
                  <div class="spin w-6 h-6 rounded-full border-2 border-white/15 border-t-white"></div>
                </div>
              }

              <!-- Cover -->
              <div class="relative h-[72px] shrink-0 overflow-hidden"
                   style="background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(165,180,252,.05))">
                @if (m.organization?.coverUrl) {
                  <img [src]="m.organization!.coverUrl!" [alt]="m.organization?.name??''"
                       class="w-full h-full object-cover opacity-70" (error)="onImgErr($event)"/>
                }
                <div class="cover-fade absolute inset-0"></div>
              </div>

              <!-- Body -->
              <div class="px-4 pb-4 flex flex-col gap-3 flex-1">
                <!-- Logo + name -->
                <div class="flex items-end gap-3">
                  <div class="w-11 h-11 rounded-xl shrink-0 overflow-hidden border-2 border-[#0c0c10]
                              -mt-[22px] relative z-[1] flex items-center justify-center"
                       [style]="getLogoStyleFromMembership(m)">
                    @if (m.organization?.logoUrl) {
                      <img [src]="m.organization!.logoUrl!" [alt]="m.organization?.name??''"
                           class="w-full h-full object-cover" (error)="onImgErr($event)"/>
                    } @else {
                      <span class="font-bebas text-base text-white">{{ membershipInitials(m) }}</span>
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-bebas text-base tracking-wide leading-tight truncate">
                      {{ m.organization?.name ?? 'Org #'+m.organizationId }}
                    </p>
                    @if (m.organization?.city) {
                      <p class="font-mono-dm text-[0.54rem] tracking-wider text-white/30">
                        {{ m.organization!.city }}{{ m.organization?.region ? ', '+m.organization!.region : '' }}
                      </p>
                    }
                  </div>
                </div>

                @if (m.organization?.bio) {
                  <p class="text-[0.78rem] text-white/38 leading-relaxed line-clamp-2">
                    {{ m.organization!.bio }}
                  </p>
                }

                <!-- Status + date -->
                <div>
                  <span class="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full border
                               font-mono-dm text-[0.54rem] tracking-widest uppercase font-medium"
                        [class.bg-emerald-500/10]="m.status===MS.Approved"
                        [class.border-emerald-500/20]="m.status===MS.Approved"
                        [class.text-emerald-400]="m.status===MS.Approved"
                        [class.bg-amber-400/10]="m.status===MS.Pending"
                        [class.border-amber-400/25]="m.status===MS.Pending"
                        [class.text-amber-400]="m.status===MS.Pending"
                        [class.bg-red-400/10]="m.status===MS.Banned"
                        [class.border-red-400/20]="m.status===MS.Banned"
                        [class.text-red-400]="m.status===MS.Banned">
                    {{ statusLabel(m.status) }}
                  </span>
                  <p class="mt-1.5 font-mono-dm text-[0.54rem] tracking-wider text-white/25">
                    @if (m.status===MS.Pending) {
                      Requested {{ m.requestDate | date:'MMM d, y' }}
                    } @else if (m.joinDate) {
                      Joined {{ m.joinDate | date:'MMM d, y' }}
                    }
                  </p>
                </div>

                <!-- Actions -->
                @if (m.status===MS.Approved) {
                  <button (click)="leave(m.organizationId, m.organization?.name??'this org')"
                          [disabled]="busyId()!==null"
                          class="w-full flex items-center justify-center gap-2 py-2.5 px-3
                                 rounded-xl font-mono-dm text-[0.6rem] tracking-wider uppercase font-medium
                                 bg-white/[0.04] text-white/40 border border-white/[0.08]
                                 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20
                                 disabled:opacity-35 disabled:cursor-not-allowed
                                 transition-all duration-150 cursor-pointer">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
                    </svg>
                    Leave Organisation
                  </button>
                }
                @if (m.status===MS.Pending) {
                  <button disabled
                          class="w-full flex items-center justify-center gap-2 py-2.5 px-3
                                 rounded-xl font-mono-dm text-[0.6rem] tracking-wider uppercase font-medium
                                 bg-amber-400/[0.06] text-amber-400/50 border border-amber-400/12 cursor-default">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Awaiting approval…
                  </button>
                }
              </div>
              <div class="org-glow"></div>
            </div>
          }
        </div>
      }
    }

  </main>
</div>
  `,
})
export class MyMembershipsPage implements OnInit {
  private svc = inject(UserMembershipService);

  readonly MS = MembershipStatus;

  myMemberships = signal<UserOrgMembership[]>([]);
  allOrgs       = signal<OrgSummary[]>([]);
  loading       = signal(false);
  browseLoading = signal(false);
  busyId        = signal<number | null>(null);
  activeTab     = signal<ActiveTab>('joined');
  searchQuery   = signal('');

  joinedCount  = computed(() => this.myMemberships().filter(m => m.status === MembershipStatus.Approved).length);
  pendingCount = computed(() => this.myMemberships().filter(m => m.status === MembershipStatus.Pending).length);

  private membershipMap = computed<Map<number, MembershipStatus>>(() => {
    const map = new Map<number, MembershipStatus>();
    this.myMemberships().forEach(m => map.set(m.organizationId, m.status));
    return map;
  });

  statsCards = computed(() => [
    {
      label: 'Joined',    value: this.joinedCount(),
      color: '#10b981',   bgColor: 'rgba(16,185,129,.1)',
      path: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      label: 'Pending',   value: this.pendingCount(),
      color: '#F0B429',   bgColor: 'rgba(240,180,41,.1)',
      path: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      label: 'Available', value: this.allOrgs().length,
      color: '#a5b4fc',   bgColor: 'rgba(99,102,241,.1)',
      path: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
    },
  ]);

  filteredMyOrgs = computed<UserOrgMembership[]>(() => {
    const statusMap: Record<'joined'|'pending', MembershipStatus[]> = {
      joined:  [MembershipStatus.Approved],
      pending: [MembershipStatus.Pending],
    };
    const tab = this.activeTab();
    if (tab === 'browse') return [];
    const q = this.searchQuery().toLowerCase().trim();
    return this.myMemberships()
      .filter(m => statusMap[tab].includes(m.status))
      .filter(m => !q ||
        m.organization?.name?.toLowerCase().includes(q) ||
        m.organization?.city?.toLowerCase().includes(q));
  });

  filteredBrowseOrgs = computed<OrgSummary[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return this.allOrgs().filter(o =>
      !q || o.name?.toLowerCase().includes(q) ||
            o.city?.toLowerCase().includes(q) ||
            o.bio?.toLowerCase().includes(q));
  });

  emptyLabel    = computed(() =>
    this.searchQuery().trim() ? 'No matches found' :
    this.activeTab() === 'joined' ? 'No Active Memberships' : 'No Pending Requests');

  emptySubLabel = computed(() =>
    this.activeTab() === 'joined'
      ? 'Browse organisations and request to join one.'
      : 'Your join requests will appear here once submitted.');

  ngOnInit() {
    this.loadMyMemberships();
    this.loadAllOrgs();
  }

  private loadMyMemberships() {
    this.loading.set(true);
    this.svc.getMyMemberships().subscribe({
      next:  ms => { this.myMemberships.set(ms); this.loading.set(false); },
      error: ()  => { toast.error('Failed to load your memberships'); this.loading.set(false); },
    });
  }

  private loadAllOrgs() {
    this.browseLoading.set(true);
    this.svc.getAllOrganizations().subscribe({
      next:  orgs => { this.allOrgs.set(orgs); this.browseLoading.set(false); },
      error: ()    => { toast.error('Failed to load organisations'); this.browseLoading.set(false); },
    });
  }

  setTab(t: ActiveTab) { this.activeTab.set(t); this.searchQuery.set(''); }
  onSearch(e: Event)   { this.searchQuery.set((e.target as HTMLInputElement).value); }

  join(org: OrgSummary) {
    if (this.busyId() !== null) return;
    this.busyId.set(org.id);
    this.svc.joinOrganization(org.id).subscribe({
      next: () => {
        const newMembership: UserOrgMembership = {
          userId: 0, organizationId: org.id,
          status: MembershipStatus.Pending,
          requestDate: new Date().toISOString(),
          joinDate: null, organization: org,
        };
        this.myMemberships.update(l => [...l, newMembership]);
        toast.success('Request sent to ' + (org.name ?? 'organisation'));
        this.busyId.set(null);
      },
      error: err => { toast.error(err.error?.message || 'Failed to send request'); this.busyId.set(null); },
    });
  }

  leave(orgId: number, orgName: string) {
    if (this.busyId() !== null) return;
    if (!confirm('Leave ' + orgName + '? You can re-apply later.')) return;
    this.busyId.set(orgId);
    this.svc.leaveOrganization(orgId).subscribe({
      next: () => {
        this.myMemberships.update(l => l.filter(m => m.organizationId !== orgId));
        toast.success('You left ' + orgName);
        this.busyId.set(null);
      },
      error: err => { toast.error(err.error?.message || 'Failed to leave'); this.busyId.set(null); },
    });
  }

  getMembershipStatus(orgId: number): MembershipStatus | null {
    return this.membershipMap().get(orgId) ?? null;
  }

  statusLabel(s: MembershipStatus): string {
    const map: Record<number, string> = {
      [MembershipStatus.Approved]: 'Member',
      [MembershipStatus.Pending]:  'Pending',
      [MembershipStatus.Banned]:   'Banned',
      [MembershipStatus.Rejected]: 'Rejected',
    };
    return map[s] ?? 'Unknown';
  }

  orgInitials(org: OrgSummary): string {
    return (org.name ?? '?').slice(0, 2).toUpperCase();
  }

  membershipInitials(m: UserOrgMembership): string {
    return (m.organization?.name ?? '?').slice(0, 2).toUpperCase();
  }

  private readonly _palettes = [
    'linear-gradient(135deg,#4f46e5,#7c3aed)',
    'linear-gradient(135deg,#FF4433,#ff6b45)',
    'linear-gradient(135deg,#0891b2,#0e7490)',
    'linear-gradient(135deg,#059669,#047857)',
    'linear-gradient(135deg,#d97706,#b45309)',
    'linear-gradient(135deg,#db2777,#9d174d)',
  ];

  getLogoStyle(org: OrgSummary): string {
    return 'background:' + this._palettes[org.id % this._palettes.length];
  }

  getLogoStyleFromMembership(m: UserOrgMembership): string {
    return 'background:' + this._palettes[m.organizationId % this._palettes.length];
  }

  onImgErr(e: Event) { (e.target as HTMLImageElement).style.display = 'none'; }
}