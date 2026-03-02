// src/app/features/dashboard/dashboard-page/dashboard-page.ts
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { RouterModule }       from '@angular/router';
import { EventService }       from '@core/services/event.service';
import { AuthService }        from '@core/services/auth.service';
import { Event as EventModel, EventLocationType, EventType } from '@core/models/event.model';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, CurrencyPipe, RouterModule],

  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

    /* ── Tokens (identical to events-page) ── */
    :host {
      --coral:      #FF4433;
      --coral-dim:  rgba(255,68,51,.12);
      --coral-brd:  rgba(255,68,51,.28);
      --gold:       #F0B429;
      --gold-dim:   rgba(240,180,41,.10);
      --gold-brd:   rgba(240,180,41,.22);
      --violet:     #a78bfa;
      --violet-dim: rgba(167,139,250,.10);
      --violet-brd: rgba(167,139,250,.22);
      --green:      #10b981;
      --green-dim:  rgba(16,185,129,.10);
      --green-brd:  rgba(16,185,129,.22);
      --text:       #F2EEE6;
      --muted:      rgba(242,238,230,.42);
      --border:     rgba(242,238,230,.07);
      --border-hi:  rgba(242,238,230,.12);
      --bg:         #060608;
      --bg2:        #09090c;
      --bg3:        #111116;
      --fd: 'Bebas Neue', sans-serif;
      --fb: 'Plus Jakarta Sans', sans-serif;
      --fm: 'DM Mono', monospace;
      display: block;
    }

    /* ── Keyframes ── */
    @keyframes fade-up {
      from { opacity:0; transform:translateY(18px) }
      to   { opacity:1; transform:translateY(0) }
    }
    @keyframes shimmer {
      from { background-position:-800px 0 }
      to   { background-position: 800px 0 }
    }
    @keyframes pulse-dot {
      0%,100% { box-shadow:0 0 6px currentColor; transform:scale(.9) }
      50%     { box-shadow:0 0 14px currentColor; transform:scale(1.1) }
    }
    @keyframes spin { to { transform:rotate(360deg) } }
    @keyframes bar-grow {
      from { width:0 }
    }
    @keyframes line-draw {
      from { stroke-dashoffset:1200 }
      to   { stroke-dashoffset:0 }
    }
    @keyframes counter-up {
      from { opacity:0; transform:translateY(6px) }
      to   { opacity:1; transform:translateY(0) }
    }

    .page-enter { animation: fade-up .45s cubic-bezier(.22,1,.36,1) both }

    /* ── Skeleton ── */
    .skeleton {
      background: linear-gradient(90deg,
        rgba(242,238,230,.04) 25%,
        rgba(242,238,230,.08) 50%,
        rgba(242,238,230,.04) 75%);
      background-size: 1600px 100%;
      animation: shimmer 1.6s ease-in-out infinite;
    }
    .skeleton-rect { border-radius:20px; border:1px solid var(--border); }

    /* ── Thin scrollbar ── */
    ::-webkit-scrollbar       { width:3px }
    ::-webkit-scrollbar-track { background:transparent }
    ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.07);border-radius:99px }

    /* ── Stat card (same as events) ── */
    .stat-card {
      position:relative; overflow:hidden;
      border-radius:20px;
      border:1px solid var(--border);
      background:var(--bg2);
      padding:1.5rem;
      cursor:default;
      transition:border-color .3s, transform .25s cubic-bezier(.22,1,.36,1);
    }
    .stat-card:hover { transform:translateY(-3px); }
    .stat-card::before {
      content:''; position:absolute; top:0; left:0; right:0; height:1px;
      opacity:0; transition:opacity .3s;
    }
    .stat-card:hover::before { opacity:1; }
    .stat-card--coral::before  { background:linear-gradient(to right,var(--coral),transparent); }
    .stat-card--gold::before   { background:linear-gradient(to right,var(--gold),transparent); }
    .stat-card--violet::before { background:linear-gradient(to right,var(--violet),transparent); }
    .stat-card--green::before  { background:linear-gradient(to right,var(--green),transparent); }

    .stat-num {
      font-family:var(--fd);
      font-size:clamp(2.4rem,3.5vw,3.2rem);
      line-height:1; letter-spacing:.04em;
      color:var(--text);
      animation:counter-up .55s cubic-bezier(.22,1,.36,1) both;
    }
    .stat-label {
      font-family:var(--fm);
      font-size:.6rem; letter-spacing:.18em; text-transform:uppercase;
      color:var(--muted); margin-top:.4rem;
    }
    .stat-icon {
      position:absolute; right:1.25rem; top:50%; transform:translateY(-50%);
      width:44px; height:44px; border-radius:12px;
      display:flex; align-items:center; justify-content:center;
    }
    .stat-badge {
      display:inline-flex; align-items:center; gap:4px;
      margin-top:.5rem;
      font-family:var(--fm); font-size:.57rem; letter-spacing:.1em;
      padding:3px 9px; border-radius:100px;
    }
    .stat-badge .dot {
      width:5px; height:5px; border-radius:50%;
      background:currentColor; animation:pulse-dot 2.2s infinite; flex-shrink:0;
    }

    /* ── Panel ── */
    .panel {
      background:var(--bg2);
      border:1px solid var(--border);
      border-radius:20px;
      overflow:hidden;
      transition:border-color .25s;
    }
    .panel:hover { border-color:var(--border-hi); }
    .panel-head {
      padding:1.1rem 1.4rem;
      border-bottom:1px solid var(--border);
      display:flex; align-items:center; justify-content:space-between; gap:.75rem;
    }
    .panel-body { padding:1.25rem 1.4rem; }

    /* ── Section label / title ── */
    .section-label {
      font-family:var(--fm); font-size:.59rem; letter-spacing:.22em;
      text-transform:uppercase; color:rgba(255,68,51,.8);
      display:flex; align-items:center; gap:6px;
    }
    .section-title {
      font-family:var(--fd);
      font-size:clamp(1.4rem,2.5vw,2rem);
      letter-spacing:.04em; color:var(--text); line-height:.92;
      margin-top:.22rem;
    }

    /* ── Event row ── */
    .ev-row {
      display:flex; align-items:center; gap:.9rem;
      padding:.85rem 1.4rem;
      border-bottom:1px solid var(--border);
      transition:background .15s; cursor:pointer;
    }
    .ev-row:last-child { border-bottom:none; }
    .ev-row:hover { background:rgba(242,238,230,.025); }

    .ev-thumb {
      width:44px; height:44px; border-radius:10px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center; overflow:hidden;
    }
    .ev-title {
      font-weight:600; font-size:.88rem; color:var(--text);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .ev-sub {
      font-family:var(--fm); font-size:.57rem; letter-spacing:.08em;
      color:var(--muted); margin-top:2px; text-transform:uppercase;
    }

    /* ── Capacity bar ── */
    .cap-track {
      height:4px; border-radius:99px;
      background:rgba(242,238,230,.06); overflow:hidden; margin-top:6px;
    }
    .cap-fill {
      height:100%; border-radius:99px;
      animation:bar-grow .8s cubic-bezier(.22,1,.36,1) both;
    }

    /* ── Tags / pills ── */
    .tag {
      display:inline-flex; align-items:center; gap:4px;
      padding:3px 9px; border-radius:100px;
      font-family:var(--fm); font-size:.57rem;
      font-weight:500; letter-spacing:.1em; text-transform:uppercase; line-height:1;
    }
    .tag--upcoming { background:var(--coral-dim); color:var(--coral); border:1px solid var(--coral-brd); }
    .tag--past     { background:rgba(113,113,122,.1); color:#71717a; border:1px solid rgba(113,113,122,.2); }
    .tag--online   { background:var(--gold-dim); color:var(--gold); border:1px solid var(--gold-brd); }
    .tag--inperson { background:rgba(99,102,241,.12); color:#a5b4fc; border:1px solid rgba(99,102,241,.22); }
    .tag--public   { background:var(--green-dim); color:var(--green); border:1px solid var(--green-brd); }
    .tag--private  { background:var(--violet-dim); color:var(--violet); border:1px solid var(--violet-brd); }
    .tag--live {
      background:var(--green-dim); color:var(--green); border:1px solid var(--green-brd);
      font-family:var(--fm); font-size:.57rem; letter-spacing:.1em;
      padding:3px 9px; border-radius:100px;
      display:inline-flex; align-items:center; gap:5px;
    }

    /* ── Activity feed ── */
    .act-item {
      display:flex; align-items:flex-start; gap:.85rem;
      padding:.8rem 1.4rem;
      border-bottom:1px solid var(--border);
      transition:background .15s;
    }
    .act-item:last-child { border-bottom:none; }
    .act-item:hover { background:rgba(242,238,230,.025); }
    .act-icon {
      width:32px; height:32px; border-radius:9px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      font-size:.85rem; border:1px solid var(--border); background:rgba(242,238,230,.04);
    }
    .act-text { font-size:.82rem; color:var(--muted); line-height:1.55; }
    .act-time {
      font-family:var(--fm); font-size:.56rem; letter-spacing:.1em;
      color:rgba(242,238,230,.22); margin-top:2px; text-transform:uppercase;
    }

    /* ── Quick-action button ── */
    .qa-btn {
      display:flex; align-items:center; gap:.75rem;
      padding:.9rem 1.1rem; border-radius:14px;
      border:1px solid var(--border); background:rgba(242,238,230,.025);
      cursor:pointer; transition:all .18s; text-align:left; width:100%;
    }
    .qa-btn:hover { border-color:var(--coral-brd); background:var(--coral-dim); }
    .qa-btn:hover .qa-label { color:var(--coral); }
    .qa-icon {
      width:36px; height:36px; border-radius:10px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
    }
    .qa-label { font-weight:600; font-size:.84rem; color:var(--text); transition:color .18s; }
    .qa-sub   { font-family:var(--fm); font-size:.57rem; letter-spacing:.08em; color:var(--muted); margin-top:1px; }

    /* ── Bar chart category ── */
    .cat-bar-track {
      height:5px; border-radius:99px; overflow:hidden;
      background:rgba(242,238,230,.05); margin-top:6px;
    }
    .cat-bar-fill {
      height:100%; border-radius:99px;
      animation:bar-grow .8s cubic-bezier(.22,1,.36,1) both;
    }

    /* ── SVG Revenue sparkline ── */
    .sparkline-path {
      stroke-dasharray:1200;
      animation:line-draw 1.4s cubic-bezier(.22,1,.36,1) .3s both;
    }

    /* ── Tab nav ── */
    .tab-btn {
      padding:.5rem 1.1rem; background:transparent; border:none; border-bottom:2px solid transparent;
      font-family:var(--fm); font-size:.63rem; letter-spacing:.12em;
      text-transform:uppercase; cursor:pointer; transition:all .15s;
      color:var(--muted); margin-bottom:-1px;
    }
    .tab-btn.active { border-bottom-color:var(--coral); color:var(--coral); font-weight:700; }
    .tab-btn:not(.active):hover { color:var(--text); border-bottom-color:var(--border-hi); }

    /* ── Pill CTA ── */
    .cta-link {
      font-family:var(--fm); font-size:.6rem; letter-spacing:.1em;
      text-transform:uppercase; color:var(--coral); cursor:pointer;
      padding:.38rem .9rem; border-radius:100px;
      background:var(--coral-dim); border:1px solid var(--coral-brd);
      transition:all .18s; white-space:nowrap;
    }
    .cta-link:hover { background:rgba(255,68,51,.2); }

    /* ── Close / ghost button ── */
    .ghost-btn {
      padding:.52rem 1.1rem; border-radius:100px;
      font-family:var(--fb); font-size:.82rem; font-weight:500;
      color:var(--muted); background:transparent; border:1px solid var(--border);
      cursor:pointer; transition:all .2s;
    }
    .ghost-btn:hover { color:var(--text); border-color:var(--border-hi); background:rgba(255,255,255,.04); }

    /* ── Primary button ── */
    .primary-btn {
      display:inline-flex; align-items:center; gap:7px;
      padding:.62rem 1.35rem; border-radius:100px;
      font-family:var(--fb); font-weight:700; font-size:.85rem;
      color:#fff; background:var(--coral); border:none; cursor:pointer;
      box-shadow:0 0 26px rgba(255,68,51,.3); position:relative; overflow:hidden;
      transition:box-shadow .25s, transform .2s;
    }
    .primary-btn::before {
      content:''; position:absolute; inset:0;
      background:linear-gradient(135deg,rgba(255,255,255,.14) 0%,transparent 55%);
      pointer-events:none;
    }
    .primary-btn:hover { box-shadow:0 0 44px rgba(255,68,51,.5); transform:translateY(-1px); }

    /* ── Mesh orb ── */
    .orb {
      position:absolute; border-radius:50%;
      pointer-events:none; filter:blur(80px);
    }
  `],

  template: `
<div class="w-full min-h-full" style="background:var(--bg);color:var(--text);font-family:var(--fb)">

  <!-- ══════════════════════════════════════════
       EDITORIAL HEADER
  ══════════════════════════════════════════ -->
  <div class="relative overflow-hidden border-b" style="border-color:rgba(242,238,230,.06)">
    <!-- Mesh orbs -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="orb" style="width:45vw;height:45vw;top:-22%;left:-10%;
           background:radial-gradient(circle,rgba(255,68,51,.07) 0%,transparent 65%)"></div>
      <div class="orb" style="width:32vw;height:32vw;top:5%;right:-6%;
           background:radial-gradient(circle,rgba(240,180,41,.05) 0%,transparent 65%)"></div>
    </div>

    <div class="relative z-10 max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

        <!-- Left -->
        <div>
          <div class="flex items-center gap-2 mb-4">
            <span style="font-family:var(--fm);font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,68,51,.8)">
              ◆ Overview
            </span>
          </div>
          <h1 style="font-family:var(--fd);font-size:clamp(3.2rem,8vw,6.8rem);line-height:.88;letter-spacing:.03em;color:var(--text);margin:0">
            YOUR<br/>
            <span style="color:transparent;-webkit-text-stroke:2px #FF4433">DASHBOARD</span>
          </h1>
          <p class="mt-3" style="font-size:.9rem;color:var(--muted);font-weight:300;max-width:400px;line-height:1.7">
            @if (orgName()) {
              {{ orgName() }} &nbsp;·&nbsp;
            }
            Everything happening across your events, at a glance.
          </p>
        </div>

        <!-- Right: greeting + CTA -->
        <div class="flex items-center gap-3 flex-wrap">
          @if (!loading()) {
            <div style="font-family:var(--fm);font-size:.63rem;letter-spacing:.1em;text-transform:uppercase;
                        color:rgba(242,238,230,.28);padding:.48rem .9rem;border-radius:100px;
                        border:1px solid var(--border);background:rgba(242,238,230,.02)">
              {{ today | date:'EEE, MMM d' }}
            </div>
          }
          <button class="primary-btn" routerLink="/events">
            <svg style="width:14px;height:14px;position:relative;z-index:1" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            <span style="position:relative;z-index:1">Create Event</span>
          </button>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="flex items-center gap-0 mt-8 border-b" style="border-color:rgba(242,238,230,.07)">
        @for (t of tabs; track t.id) {
          <button class="tab-btn" [class.active]="activeTab() === t.id"
                  (click)="activeTab.set(t.id)">
            {{ t.label }}
          </button>
        }
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════
       MAIN CONTENT
  ══════════════════════════════════════════ -->
  <div class="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-8">

    <!-- LOADING SKELETONS -->
    @if (loading()) {
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          @for (i of [0,1,2,3]; track i) {
            <div class="skeleton skeleton-rect" [style.height.px]="130" [style.animation-delay]="i * 70 + 'ms'"></div>
          }
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2 skeleton skeleton-rect" style="height:340px"></div>
          <div class="skeleton skeleton-rect" style="height:340px"></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="skeleton skeleton-rect" style="height:280px"></div>
          <div class="skeleton skeleton-rect" style="height:280px"></div>
          <div class="skeleton skeleton-rect" style="height:280px"></div>
        </div>
      </div>

    <!-- NO ORG -->
    } @else if (!orgId()) {
      <div class="flex flex-col items-center justify-center py-28 text-center gap-5">
        <div class="w-20 h-20 rounded-2xl flex items-center justify-center"
             style="background:rgba(255,68,51,.08);border:1px solid rgba(255,68,51,.2)">
          <svg class="w-9 h-9" style="color:#FF4433" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>
        <div>
          <p style="font-family:var(--fd);font-size:1.6rem;letter-spacing:.06em;color:var(--text)">
            No Organisation Found
          </p>
          <p class="mt-1" style="font-size:.85rem;color:var(--muted)">
            Please log in with an organisation account.
          </p>
        </div>
      </div>

    <!-- DASHBOARD CONTENT -->
    } @else {

      <div class="flex flex-col gap-5">

        <!-- ── STAT CARDS ── -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">

          <div class="stat-card stat-card--violet page-enter" style="animation-delay:0ms">
            <div class="stat-num">{{ stats().total }}</div>
            <div class="stat-label">Total Events</div>
            <div class="stat-icon" style="background:rgba(167,139,250,.1)">
              <svg class="w-5 h-5" style="color:var(--violet)" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
          </div>

          <div class="stat-card stat-card--coral page-enter" style="animation-delay:70ms">
            <div class="stat-num">{{ stats().upcoming }}</div>
            <div class="stat-label">Upcoming</div>
            <div class="stat-badge" style="background:rgba(255,68,51,.1);color:var(--coral);border:1px solid var(--coral-brd)">
              <span class="dot"></span> Active
            </div>
            <div class="stat-icon" style="background:rgba(255,68,51,.1)">
              <svg class="w-5 h-5" style="color:var(--coral)" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>

          <div class="stat-card stat-card--green page-enter" style="animation-delay:140ms">
            <div class="stat-num">{{ stats().public }}</div>
            <div class="stat-label">Public Events</div>
            <div class="stat-icon" style="background:rgba(16,185,129,.1)">
              <svg class="w-5 h-5" style="color:var(--green)" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
          </div>

          <div class="stat-card stat-card--gold page-enter" style="animation-delay:210ms">
            <div class="stat-num">{{ stats().private }}</div>
            <div class="stat-label">Private Events</div>
            <div class="stat-icon" style="background:rgba(240,180,41,.1)">
              <svg class="w-5 h-5" style="color:var(--gold)" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
              </svg>
            </div>
          </div>

        </div>

        <!-- ── ROW 2: Sparkline + Upcoming summary ── -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <!-- Monthly breakdown sparkline (2/3 wide) -->
          <div class="panel page-enter lg:col-span-2" style="animation-delay:260ms">
            <div class="panel-head">
              <div>
                <div class="section-label">◆ Activity</div>
                <div class="section-title">Events Over Time</div>
              </div>
              <div class="flex items-center gap-2">
                <span class="tag--live">
                  <span style="width:5px;height:5px;border-radius:50%;background:currentColor;animation:pulse-dot 2s infinite;flex-shrink:0;display:inline-block"></span>
                  Live Data
                </span>
              </div>
            </div>
            <div class="panel-body">
              <!-- SVG Sparkline built from real monthly counts -->
              @if (monthlyChartPoints().length > 1) {
                <div style="position:relative">
                  <svg [attr.viewBox]="'0 0 ' + chartW + ' ' + chartH"
                       style="width:100%;height:auto;overflow:visible">
                    <defs>
                      <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stop-color="#FF4433" stop-opacity=".18"/>
                        <stop offset="100%" stop-color="#FF4433" stop-opacity="0"/>
                      </linearGradient>
                    </defs>
                    <!-- Horizontal grid lines -->
                    @for (g of chartGridY(); track $index) {
                      <line [attr.x1]="chartPad" [attr.x2]="chartW - chartPad"
                            [attr.y1]="g" [attr.y2]="g"
                            stroke="rgba(242,238,230,.04)" stroke-width="1"/>
                    }
                    <!-- Fill area -->
                    <path [attr.d]="chartFillPath()" fill="url(#dashGrad)"/>
                    <!-- Line -->
                    <path [attr.d]="chartLinePath()" fill="none" stroke="#FF4433"
                          stroke-width="2" class="sparkline-path"/>
                    <!-- Dots -->
                    @for (pt of monthlyChartPoints(); track $index; let last = $last) {
                      <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3"
                              fill="var(--bg)" stroke="#FF4433" stroke-width="2"/>
                      @if (last) {
                        <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="5.5"
                                fill="none" stroke="rgba(255,68,51,.3)" stroke-width="1.5"/>
                      }
                    }
                  </svg>
                  <!-- Month labels -->
                  <div class="flex justify-between mt-2 px-3">
                    @for (m of monthLabels(); track $index; let last = $last) {
                      <span style="font-family:var(--fm);font-size:.52rem;letter-spacing:.08em;text-transform:uppercase;"
                            [style.color]="last ? 'var(--coral)' : 'rgba(242,238,230,.22)'"
                            [style.font-weight]="last ? '700' : '400'">
                        {{ m }}
                      </span>
                    }
                  </div>
                </div>
              } @else {
                <!-- Empty chart placeholder -->
                <div class="flex items-center justify-center py-10"
                     style="border:1px dashed var(--border);border-radius:14px">
                  <p style="font-family:var(--fm);font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)">
                    Not enough data yet
                  </p>
                </div>
              }

              <!-- Summary row below chart -->
              <div class="grid grid-cols-3 gap-3 mt-5">
                @for (s of chartSummary(); track s.label) {
                  <div style="padding:.75rem 1rem;border-radius:14px;background:rgba(255,255,255,.022);border:1px solid var(--border)">
                    <div style="font-family:var(--fd);font-size:1.6rem;letter-spacing:.04em;color:var(--text)">
                      {{ s.value }}
                    </div>
                    <div style="font-family:var(--fm);font-size:.57rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:2px">
                      {{ s.label }}
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Next upcoming event highlight (1/3 wide) -->
          <div class="page-enter" style="animation-delay:310ms">
            @if (nextUpcoming()) {
              <div class="panel h-full flex flex-col">
                <div class="panel-head">
                  <div>
                    <div class="section-label">◆ Next Up</div>
                    <div class="section-title" style="font-size:1.3rem">Upcoming</div>
                  </div>
                  <span class="tag tag--upcoming">
                    <span style="width:5px;height:5px;border-radius:50%;background:currentColor;animation:pulse-dot 2.2s infinite;display:inline-block"></span>
                    Soon
                  </span>
                </div>
                <!-- Hero thumb -->
                <div class="relative shrink-0 overflow-hidden" style="height:160px">
                  @if (nextUpcoming()!.event_img_url) {
                    <img [src]="nextUpcoming()!.event_img_url" [alt]="nextUpcoming()!.title"
                         class="absolute inset-0 w-full h-full object-cover"
                         (error)="onImgErr($event)"/>
                  } @else {
                    <div class="absolute inset-0" [style]="getGradient(nextUpcoming()!)">
                      <div class="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none">
                        <span style="font-family:var(--fd);font-size:5rem;letter-spacing:.06em;color:transparent;
                                     -webkit-text-stroke:1px rgba(242,238,230,.05);white-space:nowrap;padding:0 1rem">
                          {{ nextUpcoming()!.title?.toUpperCase() }}
                        </span>
                      </div>
                    </div>
                  }
                  <div class="absolute inset-0 pointer-events-none"
                       style="background:linear-gradient(to top,var(--bg2) 0%,transparent 60%)"></div>
                </div>
                <!-- Info -->
                <div class="flex-1 flex flex-col gap-3 p-5">
                  @if (nextUpcoming()!.category?.name) {
                    <span style="font-family:var(--fm);font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:var(--coral)">
                      {{ nextUpcoming()!.category?.name }}
                    </span>
                  }
                  <h3 style="font-family:var(--fd);font-size:1.6rem;letter-spacing:.03em;color:var(--text);line-height:.94;margin:0">
                    {{ nextUpcoming()!.title }}
                  </h3>
                  <!-- Date & location tiles -->
                  <div class="flex flex-col gap-2 mt-auto">
                    <div class="flex items-center gap-2"
                         style="padding:.6rem .85rem;border-radius:12px;background:rgba(255,255,255,.025);border:1px solid var(--border)">
                      <svg class="w-3.5 h-3.5 shrink-0" style="color:var(--gold)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      <span style="font-size:.78rem;font-weight:600;color:var(--text)">
                        {{ nextUpcoming()!.start_time | date:'EEE, MMM d, y' }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2"
                         style="padding:.6rem .85rem;border-radius:12px;background:rgba(255,255,255,.025);border:1px solid var(--border)">
                      <svg class="w-3.5 h-3.5 shrink-0" style="color:var(--coral)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                      <span style="font-size:.78rem;font-weight:600;color:var(--text)">
                        @if (nextUpcoming()!.event_location_type === EventLocationType.Online) {
                          Online Event
                        } @else {
                          {{ nextUpcoming()!.city }}@if (nextUpcoming()!.region) {, {{ nextUpcoming()!.region }}}
                        }
                      </span>
                    </div>
                  </div>
                  <button class="primary-btn w-full justify-center mt-1"
                          style="font-size:.82rem" routerLink="/events">
                    <span style="position:relative;z-index:1">Manage Event</span>
                    <svg style="width:12px;height:12px;position:relative;z-index:1" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              </div>
            } @else {
              <!-- No upcoming -->
              <div class="panel h-full flex flex-col items-center justify-center text-center gap-4 p-8">
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center"
                     style="background:rgba(255,68,51,.06);border:1px solid rgba(255,68,51,.15)">
                  <svg class="w-7 h-7" style="color:rgba(255,68,51,.45)" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                  </svg>
                </div>
                <div>
                  <p style="font-family:var(--fd);font-size:1.3rem;letter-spacing:.06em;color:var(--text)">
                    No Upcoming Events
                  </p>
                  <p class="mt-1" style="font-size:.8rem;color:var(--muted)">Create one to get started.</p>
                </div>
                <button class="primary-btn" routerLink="/events">
                  <svg style="width:13px;height:13px;position:relative;z-index:1" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  <span style="position:relative;z-index:1">Create Event</span>
                </button>
              </div>
            }
          </div>
        </div>

        <!-- ── ROW 3: Recent Events list + Category breakdown + Quick Actions ── -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <!-- Recent events list (2/3) -->
          <div class="panel page-enter lg:col-span-2" style="animation-delay:360ms">
            <div class="panel-head">
              <div>
                <div class="section-label">◆ Events</div>
                <div class="section-title">Recent Events</div>
              </div>
              <button class="cta-link" routerLink="/events">View All →</button>
            </div>

            @if (recentEvents().length === 0) {
              <div class="flex flex-col items-center justify-center py-14 text-center gap-3">
                <svg class="w-8 h-8" style="color:rgba(242,238,230,.18)" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                </svg>
                <p style="font-family:var(--fd);font-size:1.2rem;letter-spacing:.06em;color:var(--text)">No Events Yet</p>
                <p style="font-size:.8rem;color:var(--muted)">Your events will appear here once created.</p>
              </div>
            } @else {
              @for (event of recentEvents(); track event.id; let i = $index) {
                <div class="ev-row page-enter" [style.animation-delay]="(400 + i * 55) + 'ms'"
                     routerLink="/events">
                  <!-- Thumb -->
                  <div class="ev-thumb" [style]="event.event_img_url ? '' : getGradient(event)">
                    @if (event.event_img_url) {
                      <img [src]="event.event_img_url" [alt]="event.title"
                           class="w-full h-full object-cover" (error)="onImgErr($event)"/>
                    } @else {
                      <svg class="w-4 h-4" style="color:rgba(242,238,230,.18)" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                      </svg>
                    }
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <div class="ev-title">{{ event.title }}</div>
                    <div class="ev-sub">
                      {{ event.start_time | date:'MMM d, y' }}
                      @if (event.event_location_type !== EventLocationType.Online && event.city) {
                        &nbsp;·&nbsp;{{ event.city }}
                      }
                      @if (event.category?.name) {
                        &nbsp;·&nbsp;{{ event.category?.name }}
                      }
                    </div>
                  </div>

                  <!-- Status pills -->
                  <div class="flex flex-col gap-1 items-end shrink-0">
                    @if (isUpcoming(event)) {
                      <span class="tag tag--upcoming">
                        <span style="width:5px;height:5px;border-radius:50%;background:currentColor;animation:pulse-dot 2.2s infinite;display:inline-block"></span>
                        Upcoming
                      </span>
                    } @else {
                      <span class="tag tag--past">Ended</span>
                    }
                    @if (event.event_location_type === EventLocationType.Online) {
                      <span class="tag tag--online">Online</span>
                    } @else {
                      <span class="tag tag--inperson">In-Person</span>
                    }
                  </div>
                </div>
              }
            }
          </div>

          <!-- Right column: categories + quick actions -->
          <div class="flex flex-col gap-4">

            <!-- Category breakdown -->
            @if (topCategories().length > 0) {
              <div class="panel page-enter" style="animation-delay:410ms">
                <div class="panel-head">
                  <div>
                    <div class="section-label">◆ Breakdown</div>
                    <div class="section-title" style="font-size:1.3rem">Categories</div>
                  </div>
                </div>
                <div class="panel-body flex flex-col gap-4">
                  @for (cat of topCategories(); track cat.name; let i = $index) {
                    <div class="page-enter" [style.animation-delay]="(460 + i * 55) + 'ms'">
                      <div class="flex items-center justify-between mb-1.5">
                        <span style="font-weight:500;font-size:.83rem;color:var(--text)">{{ cat.name }}</span>
                        <span style="font-family:var(--fm);font-size:.58rem;letter-spacing:.1em;color:var(--muted)">
                          {{ cat.count }} event{{ cat.count !== 1 ? 's' : '' }}
                        </span>
                      </div>
                      <div class="cat-bar-track">
                        <div class="cat-bar-fill"
                             [style.width]="cat.pct + '%'"
                             [style.background]="catBarColor(i)"
                             [style.animation-delay]="(480 + i * 55) + 'ms'"
                             [style.box-shadow]="'0 0 8px ' + catBarColor(i) + '55'">
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Quick Actions -->
            <div class="panel page-enter" style="animation-delay:460ms">
              <div class="panel-head">
                <div class="section-label">◆ Quick Actions</div>
              </div>
              <div style="padding:.7rem .9rem;display:flex;flex-direction:column;gap:.45rem">
                @for (qa of quickActions; track qa.label) {
                  <button class="qa-btn" [routerLink]="qa.route">
                    <div class="qa-icon" [style.background]="qa.bg">
                      <svg class="w-4 h-4" [style.color]="qa.color"
                           fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="qa.icon"/>
                      </svg>
                    </div>
                    <div>
                      <div class="qa-label">{{ qa.label }}</div>
                      <div class="qa-sub">{{ qa.sub }}</div>
                    </div>
                    <svg class="w-3 h-3 ml-auto shrink-0" style="color:var(--muted)"
                         fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                }
              </div>
            </div>

          </div>
        </div>

        <!-- ── FOOTER STRIP ── -->
        <div class="page-enter flex items-center justify-between flex-wrap gap-4"
             style="animation-delay:520ms;padding:1.1rem 1.4rem;border-radius:20px;
                    background:var(--bg2);border:1px solid var(--border)">
          <div class="flex items-center gap-3">
            <span style="font-family:var(--fd);font-size:1.25rem;letter-spacing:.06em;color:var(--text)">
              {{ orgName()?.toUpperCase() }}
            </span>
            <span style="font-family:var(--fm);font-size:.55rem;letter-spacing:.14em;text-transform:uppercase;
                         color:var(--muted);padding:2px 8px;border-radius:100px;border:1px solid var(--border)">
              Dashboard
            </span>
          </div>
          <div class="flex items-center gap-5 flex-wrap">
            @for (s of footerStats(); track s.label) {
              <div class="text-center">
                <div style="font-family:var(--fd);font-size:1.2rem;letter-spacing:.04em;color:var(--text)">
                  {{ s.value }}
                </div>
                <div style="font-family:var(--fm);font-size:.52rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">
                  {{ s.label }}
                </div>
              </div>
            }
          </div>
        </div>

      </div>
    }
  </div>
</div>
  `,
})
export class DashboardHomeComponent implements OnInit {
  private eventService = inject(EventService);
  private authService  = inject(AuthService);

  readonly EventLocationType = EventLocationType;
  readonly EventType         = EventType;

  // ── State ────────────────────────────────────────────────────────────────
  events  = signal<EventModel[]>([]);
  loading = signal(true);
  orgId   = signal<number | null>(null);
  orgName = signal<string | null>(null);
  activeTab = signal<string>('overview');

  readonly today = new Date();

  // ── Config ───────────────────────────────────────────────────────────────
  readonly tabs = [
    { id: 'overview',   label: 'Overview'   },
    { id: 'events',     label: 'Events'     },
    { id: 'analytics',  label: 'Analytics'  },
  ];

  readonly quickActions = [
    {
      label: 'Create New Event', sub: 'Set up in minutes',
      route: '/events',
      icon:  'M12 4v16m8-8H4',
      color: '#FF4433', bg: 'rgba(255,68,51,.1)',
    },
    {
      label: 'Manage Events', sub: 'Edit or delete events',
      route: '/events',
      icon:  'M4 6h16M4 10h16M4 14h16M4 18h16',
      color: '#a78bfa', bg: 'rgba(167,139,250,.1)',
    },
    // {
    //   label: 'View Attendees', sub: 'See registrations',
    //   route: '/attendees',
    //   icon:  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    //   color: '#10b981', bg: 'rgba(16,185,129,.1)',
    // },
    // {
    //   label: 'Organisation Settings', sub: 'Update profile & billing',
    //   route: '/settings',
    //   icon:  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    //   color: '#F0B429', bg: 'rgba(240,180,41,.1)',
    // },
  ];

  // ── Chart config ─────────────────────────────────────────────────────────
  readonly chartW   = 500;
  readonly chartH   = 130;
  readonly chartPad = 16;

  // ── Computed stats ───────────────────────────────────────────────────────
  stats = computed(() => {
    const now  = new Date();
    const all  = this.events();
    return {
      total:    all.length,
      upcoming: all.filter(e => new Date(e.start_time) > now).length,
      past:     all.filter(e => new Date(e.start_time) <= now).length,
      public:   all.filter(e => e.event_type === EventType.Public).length,
      private:  all.filter(e => e.event_type === EventType.Private).length,
      online:   all.filter(e => e.event_location_type === EventLocationType.Online).length,
      inperson: all.filter(e => e.event_location_type !== EventLocationType.Online).length,
    };
  });

  recentEvents = computed<EventModel[]>(() =>
    [...this.events()]
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      .slice(0, 6)
  );

  nextUpcoming = computed<EventModel | null>(() => {
    const now = new Date();
    return [...this.events()]
      .filter(e => new Date(e.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0] ?? null;
  });

  topCategories = computed<{ name: string; count: number; pct: number }[]>(() => {
    const map = new Map<string, number>();
    for (const e of this.events()) {
      if (e.category?.name) map.set(e.category.name, (map.get(e.category.name) ?? 0) + 1);
    }
    const entries = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const max = entries[0]?.[1] ?? 1;
    return entries.map(([name, count]) => ({
      name, count, pct: Math.round((count / max) * 100),
    }));
  });

  // ── Chart computed ───────────────────────────────────────────────────────
  /** Last 8 months, counting events per month */
  monthlyChartData = computed<{ label: string; count: number }[]>(() => {
    const result: { label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const count = this.events().filter(e => {
        const ed = new Date(e.start_time);
        return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
      }).length;
      result.push({ label, count });
    }
    return result;
  });

  monthLabels = computed(() => this.monthlyChartData().map(m => m.label));

  monthlyChartPoints = computed<{ x: number; y: number }[]>(() => {
    const data = this.monthlyChartData();
    if (data.length < 2) return [];
    const counts = data.map(d => d.count);
    const max    = Math.max(...counts, 1);
    const W = this.chartW, H = this.chartH, P = this.chartPad;
    return data.map((d, i) => ({
      x: P + (i / (data.length - 1)) * (W - P * 2),
      y: P + (1 - d.count / max) * (H - P * 2),
    }));
  });

  chartLinePath = computed(() => {
    const pts = this.monthlyChartPoints();
    if (!pts.length) return '';
    return 'M ' + pts.map(p => `${p.x},${p.y}`).join(' L ');
  });

  chartFillPath = computed(() => {
    const pts = this.monthlyChartPoints();
    if (!pts.length) return '';
    const W = this.chartW, H = this.chartH, P = this.chartPad;
    return `M ${pts[0].x},${pts[0].y} L ${pts.map(p => `${p.x},${p.y}`).join(' L ')} L ${W - P},${H} L ${P},${H} Z`;
  });

  chartGridY = computed(() => {
    const H = this.chartH, P = this.chartPad;
    return [0, 0.25, 0.5, 0.75, 1].map(t => P + t * (H - P * 2));
  });

  chartSummary = computed(() => {
    const s = this.stats();
    return [
      { label: 'Total Events', value: s.total    },
      { label: 'Upcoming',     value: s.upcoming  },
      { label: 'Past',         value: s.past      },
    ];
  });

  footerStats = computed(() => {
    const s = this.stats();
    return [
      { label: 'Total',     value: s.total    },
      { label: 'Upcoming',  value: s.upcoming },
      { label: 'Public',    value: s.public   },
      { label: 'Private',   value: s.private  },
      { label: 'Online',    value: s.online   },
    ];
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const org = this.authService.getOrganization();
    if (org) {
      this.orgId.set(org.id);
      this.orgName.set(org.name ?? null);
      this.loadEvents(org.id);
    } else {
      this.loading.set(false);
    }
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  private loadEvents(orgId: number): void {
    this.loading.set(true);
    this.eventService.getEventsByOrganization(orgId).subscribe({
      next:  events => { this.events.set(events); this.loading.set(false); },
      error: ()     => this.loading.set(false),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  isUpcoming(e: EventModel): boolean { return new Date(e.start_time) > new Date(); }

  onImgErr(e: Event): void { (e.target as HTMLImageElement).style.display = 'none'; }

  getGradient(e: EventModel): string {
    const g = [
      'background:linear-gradient(160deg,#1a0800 0%,#2d1200 100%)',
      'background:linear-gradient(160deg,#060616 0%,#18082e 100%)',
      'background:linear-gradient(160deg,#001508 0%,#002814 100%)',
      'background:linear-gradient(160deg,#100012 0%,#200028 100%)',
      'background:linear-gradient(160deg,#141200 0%,#282200 100%)',
    ];
    return g[e.id % g.length];
  }

  catBarColor(index: number): string {
    return ['#FF4433', '#F0B429', '#a78bfa', '#10b981', '#60a5fa'][index % 5];
  }
}