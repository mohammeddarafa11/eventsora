
import {
  Component,
  computed,
  HostListener,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { EventService }           from '@core/services/event.service';
import { AuthService }            from '@core/services/auth.service';
import { Event as EventModel }    from '@core/models/event.model';
import { ZardIconComponent }      from '@shared/components/icon/icon.component';
import { type ZardIcon }          from '@shared/components/icon/icons';
import { toast }                  from 'ngx-sonner';

import { CreateEventModalComponent } from '../modals/create-event-modal';
import { EditEventModalComponent }   from '../modals/edit-event-modal';
import { ViewEventModalComponent }   from '../modals/view-event-modal';
import {
  FilterEventsPipe,
  EventFilters,
  DEFAULT_FILTERS,
  EventLocationFilter,
  EventStatusFilter,
  EventVisibilityFilter,
} from '../pipes/filter-events.pipe';

interface Category { id: number; name: string; }

@Component({
  selector: 'app-events-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, ZardIconComponent,
    CreateEventModalComponent, EditEventModalComponent,
    ViewEventModalComponent, FilterEventsPipe,
  ],

  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

    /* ── Tokens ── */
    :host {
      --coral:      #FF4433;
      --coral-dim:  rgba(255,68,51,.12);
      --gold:       #F0B429;
      --gold-dim:   rgba(240,180,41,.1);
      --text:       #F2EEE6;
      --muted:      rgba(242,238,230,.42);
      --border:     rgba(242,238,230,.07);
      --bg:         #060608;
      --bg2:        #0c0c10;
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
    .skeleton-card {
      aspect-ratio: 3/4;
      border-radius: 20px;
      border: 1px solid var(--border);
    }

    /* ── Stat cards ── */
    .stat-card {
      position: relative; overflow: hidden;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: var(--bg2);
      padding: 1rem;
      cursor: default;
      transition: border-color .3s, transform .25s cubic-bezier(.22,1,.36,1);
    }
    .stat-card:hover { transform: translateY(-3px); }
    .stat-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(to right, var(--coral), transparent);
      opacity: 0; transition: opacity .3s;
    }
    .stat-card:hover::before { opacity: 1; }
    .stat-card__num {
      font-family: var(--fd);
      font-size: 2rem; line-height: 1; letter-spacing: .04em;
      color: var(--text);
    }
    .stat-card__label {
      font-family: var(--fm);
      font-size: .6rem; letter-spacing: .18em; text-transform: uppercase;
      color: var(--muted); margin-top: .4rem;
    }
    .stat-card__icon {
      position: absolute; right: 1.25rem; top: 50%; transform: translateY(-50%);
      width: 44px; height: 44px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
    }

    /* ── Hero-style event card ── */
    .event-card {
      position: relative; border-radius: 20px; overflow: hidden;
      border: 1px solid var(--border);
      aspect-ratio: 3/4;
      cursor: pointer;
      transition: border-color .3s, transform .28s cubic-bezier(.22,1,.36,1), box-shadow .3s;
      background: var(--bg2);
    }
    .event-card:hover {
      border-color: rgba(255,68,51,.4);
      transform: translateY(-5px);
      box-shadow: 0 28px 70px rgba(0,0,0,.6), 0 0 0 1px rgba(255,68,51,.08);
    }
    .ec-img {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover;
      transition: transform .7s cubic-bezier(.25,.46,.45,.94);
    }
    .event-card:hover .ec-img { transform: scale(1.07); }
    .ec-fallback {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .ec-fallback-pattern {
      position: absolute; inset: 0;
      opacity: .06;
      background: repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,255,255,.08) 10px,rgba(255,255,255,.08) 20px);
    }
    .ec-overlay {
      position: absolute; inset: 0; padding: .9rem;
      display: flex; flex-direction: column; justify-content: space-between;
      background: linear-gradient(to top,
        rgba(6,6,8,.97) 0%,
        rgba(6,6,8,.38) 44%,
        rgba(6,6,8,.08) 68%,
        transparent 100%);
    }

    /* ── Tags ── */
    .ec-tag {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px; border-radius: 100px;
      font-family: var(--fm); font-size: .58rem; font-weight: 500;
      letter-spacing: .1em; text-transform: uppercase; line-height: 1;
      backdrop-filter: blur(8px);
    }
    .ec-tag .dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: currentColor; animation: pulse-dot 2.2s infinite; flex-shrink: 0;
    }
    .ec-tag--upcoming { background: var(--coral); color: #fff; }
    .ec-tag--past     { background: rgba(12,12,16,.7); color: rgba(242,238,230,.35); border: 1px solid rgba(242,238,230,.08); }
    .ec-tag--online   { background: rgba(240,180,41,.15); border:1px solid rgba(240,180,41,.28); color: var(--gold); }
    .ec-tag--inperson { background: rgba(99,102,241,.15); border:1px solid rgba(99,102,241,.28); color: #a5b4fc; }
    .ec-tag--public   { background: rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.22); color: #10b981; }
    .ec-tag--private  { background: rgba(139,92,246,.12); border:1px solid rgba(139,92,246,.22); color: #a78bfa; }
    .ec-tag--cat      { background: rgba(242,238,230,.06); border:1px solid rgba(242,238,230,.1); color: var(--muted); }

    /* ── Card bottom ── */
    .ec-date {
      font-family: var(--fm); font-size: .6rem; letter-spacing: .15em;
      color: rgba(242,238,230,.38); text-transform: uppercase; margin-bottom: .3rem;
    }
    .ec-title {
      font-family: var(--fd);
      font-size: clamp(1.4rem,3vw,1.85rem);
      line-height: .92; letter-spacing: .02em; color: #fff; margin: 0 0 .65rem;
    }
    .ec-meta {
      display: flex; align-items: center; justify-content: space-between;
      gap: 5px; flex-wrap: wrap;
    }
    .ec-loc {
      display: flex; align-items: center; gap: 4px;
      font-size: .68rem; color: rgba(242,238,230,.38); font-family: var(--fb);
    }
    .ec-cta {
      font-family: var(--fm); font-size: .68rem;
      color: var(--gold);
      padding: 3px 10px;
      background: rgba(240,180,41,.1); border: 1px solid rgba(240,180,41,.2);
      border-radius: 100px; white-space: nowrap;
      transition: background .2s;
    }
    .event-card:hover .ec-cta { background: rgba(240,180,41,.18); }

    /* Glow line on hover */
    .ec-glow {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(to right, var(--coral), transparent);
      opacity: 0; transition: opacity .3s;
    }
    .event-card:hover .ec-glow { opacity: 1; }

    /* ── 3-dot menu ── */
    .dots-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2.5px; width: 26px; height: 26px; border-radius: 50%; cursor: pointer;
      background: rgba(6,6,8,.6); backdrop-filter: blur(8px);
      border: 1px solid rgba(242,238,230,.1);
      transition: background .15s, border-color .15s; flex-shrink: 0;
    }
    .dots-btn:hover { background: var(--coral-dim); border-color: rgba(255,68,51,.3); }
    .dots-btn .d { display:block; width:3px; height:3px; border-radius:99px; background:rgba(242,238,230,.65); }

    .ctx-menu {
      position:absolute; right:0; top:calc(100% + 6px); z-index:60;
      min-width:160px; padding:5px; border-radius:14px;
      background:rgba(12,12,16,.97); backdrop-filter:blur(20px);
      border:1px solid rgba(242,238,230,.1);
      box-shadow:0 20px 60px rgba(0,0,0,.8);
    }
    .ctx-item {
      display:flex; align-items:center; gap:8px; width:100%;
      padding:8px 10px; border-radius:9px; border:none;
      background:transparent; color:rgba(242,238,230,.5);
      font-family:var(--fb); font-size:12.5px; font-weight:500;
      cursor:pointer; text-align:left; transition:background .1s, color .1s;
    }
    .ctx-item:hover { background:rgba(242,238,230,.07); color:rgba(242,238,230,.9); }
    .ctx-item.danger:hover { background:rgba(239,68,68,.1); color:#f87171; }
    .ctx-sep { height:1px; margin:4px 2px; background:rgba(242,238,230,.07); }

    /* ── Filter bar ── */
    .fp-btn {
      display:flex; align-items:center; gap:6px;
      padding:7px 13px; border-radius:100px;
      font-family:var(--fm); font-size:.65rem; letter-spacing:.08em; text-transform:uppercase;
      cursor:pointer; white-space:nowrap; user-select:none;
      transition:all .15s;
      border:1px solid var(--border);
      background:rgba(242,238,230,.03); color:var(--muted);
    }
    .fp-btn:hover { border-color:rgba(242,238,230,.15); color:var(--text); }
    .fp-btn.active {
      border-color:rgba(255,68,51,.4);
      background:var(--coral-dim); color:var(--coral); font-weight:700;
    }
    .fp-btn.open {
      border-color:var(--coral);
      background:var(--coral-dim); color:var(--coral);
      box-shadow:0 0 0 3px rgba(255,68,51,.1);
    }
    .fp-chevron {
      width:11px; height:11px; opacity:.35; flex-shrink:0;
      transition:transform .2s;
    }
    .fp-btn.open .fp-chevron { transform:rotate(180deg); opacity:.7; }

    .fp-dropdown {
      position:absolute; top:calc(100% + 8px); left:0; z-index:100;
      min-width:175px; padding:5px; border-radius:16px;
      background:rgba(12,12,16,.97); backdrop-filter:blur(20px);
      border:1px solid var(--border);
      box-shadow:0 16px 50px rgba(0,0,0,.7);
      animation: fade-up .12s cubic-bezier(.22,1,.36,1) both;
    }
    .fp-option {
      display:flex; align-items:center; gap:8px; width:100%;
      padding:8px 10px; border-radius:10px; border:none;
      background:transparent; color:var(--muted);
      font-family:var(--fb); font-size:12.5px; font-weight:500;
      cursor:pointer; text-align:left; transition:background .1s, color .1s;
    }
    .fp-option:hover { background:rgba(242,238,230,.06); color:var(--text); }
    .fp-option.sel { background:var(--coral-dim); color:var(--coral); font-weight:700; }
    .fp-check { width:12px; height:12px; margin-left:auto; flex-shrink:0; color:var(--coral); }
    .fp-sep { height:1px; margin:4px 2px; background:var(--border); }

    .fp-date-pill {
      position:relative; display:flex; align-items:center; gap:6px;
      padding:7px 13px; border-radius:100px; overflow:hidden;
      border:1px solid var(--border); background:rgba(242,238,230,.03);
      color:var(--muted); font-family:var(--fm); font-size:.65rem; letter-spacing:.08em; text-transform:uppercase;
      cursor:pointer; white-space:nowrap; user-select:none; transition:all .15s;
    }
    .fp-date-pill:hover { border-color:rgba(242,238,230,.15); color:var(--text); }
    .fp-date-pill.active { border-color:rgba(255,68,51,.4); background:var(--coral-dim); color:var(--coral); }
    .fp-date-pill input[type='date'] {
      position:absolute; inset:0; width:100%; height:100%;
      opacity:0; cursor:pointer; border:none; background:none; -webkit-appearance:none;
    }

    .search-wrap {
      position:relative; display:flex; align-items:center;
    }
    .search-input {
      width:100%; padding:10px 44px 10px 18px;
      background:rgba(242,238,230,.04) !important;
      border:1px solid var(--border) !important;
      border-radius:100px; outline:none !important;
      font-family:var(--fb); font-size:13px;
      color:var(--text) !important;
      transition:border-color .15s, box-shadow .15s;
    }
    .search-input::placeholder { color:rgba(242,238,230,.2) !important; }
    .search-input:focus {
      border-color:rgba(255,68,51,.4) !important;
      box-shadow:0 0 0 3px rgba(255,68,51,.08) !important;
    }

    ::-webkit-scrollbar { width:3px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:var(--border); border-radius:99px; }
  `],

  template: `
<div class="w-full min-h-full"
     style="background:#060608;color:#F2EEE6;font-family:'Plus Jakarta Sans',sans-serif">

  <!-- ══════════════════════════════════════════
       EDITORIAL HEADER
  ══════════════════════════════════════════ -->
  <div class="relative overflow-hidden border-b" style="border-color:rgba(242,238,230,.06)">
    <!-- Mesh orbs -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute" style="width:45vw;height:45vw;top:-20%;left:-10%;
           background:radial-gradient(circle,rgba(255,68,51,.07) 0%,transparent 65%);
           filter:blur(80px);border-radius:50%"></div>
      <div class="absolute" style="width:35vw;height:35vw;top:10%;right:-8%;
           background:radial-gradient(circle,rgba(240,180,41,.05) 0%,transparent 65%);
           filter:blur(80px);border-radius:50%"></div>
    </div>

    <div class="relative z-10 max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

        <!-- Left: heading block -->
        <div>
          <div class="flex items-center gap-2 mb-4">
            <span style="font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,68,51,.8)">
              ◆ Event Management
            </span>
          </div>

          <h1 style="font-family:'Bebas Neue',sans-serif;font-size:clamp(3.5rem,8vw,7rem);
                     line-height:.88;letter-spacing:.03em;color:#F2EEE6;margin:0">
            YOUR<br/>
            <span style="color:transparent;-webkit-text-stroke:2px #FF4433">EVENTS</span>
          </h1>

          <p class="mt-3" style="font-size:.9rem;color:rgba(242,238,230,.42);font-weight:300;max-width:400px;line-height:1.7">
            Manage, publish, and track all your organisation's events from one place.
          </p>
        </div>

        <!-- Right: CTA -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          @if (!loading() && events().length > 0) {
            <div class="order-2 sm:order-1 text-center sm:text-left" style="font-family:\'DM Mono\',monospace;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(242,238,230,.28)">
              {{ events().length }} total
            </div>
          }
          <button (click)="openCreateModal()"
                  class="order-1 sm:order-2 w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white
                         transition-all hover:opacity-90 active:scale-[.97]"
                  style="background:linear-gradient(135deg,#FF4433,#ff6b45);
                         box-shadow:0 0 30px rgba(255,68,51,.3)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Create Event
          </button>
        </div>

      </div>

      <!-- ── Stat bar ── -->
      @if (!loading() && events().length > 0) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
          @for (s of statsCards(); track s.label; let i = $index) {
            <div class="stat-card" [style.animation-delay]="i * 60 + 'ms'">
              <div class="stat-card__num">{{ s.value }}</div>
              <div class="stat-card__label">{{ s.label }}</div>
              <div class="stat-card__icon" [style.background]="s.bgColor">
                <svg class="w-5 h-5" [style.color]="s.color"
                     fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="s.path"/>
                </svg>
              </div>
            </div>
          }
        </div>
      }
    </div>
  </div>

  <!-- ══════════════════════════════════════════
       FILTER RAIL
  ══════════════════════════════════════════ -->
  @if (!loading() && events().length > 0) {
    <div class="sticky top-0 z-30 border-b" style="background:rgba(6,6,8,.9);backdrop-filter:blur(20px);border-color:rgba(242,238,230,.06)"
         (click)="$event.stopPropagation()">
      <div class="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-3">

        <div class="flex flex-wrap items-center gap-2 sm:gap-3">

          <!-- Search -->
          <div class="search-wrap w-full md:flex-1 md:min-w-[200px] md:max-w-xs">
            <input class="search-input" type="text"
                   placeholder="Search events…"
                   [value]="filters().search"
                   (input)="setSearch($event)"/>
            <div z-icon zType="search"
                 class="absolute right-4 w-3.5 h-3.5 pointer-events-none"
                 style="color:rgba(242,238,230,.25)"></div>
          </div>

          <!-- From -->
          <div class="fp-date-pill" [class.active]="!!dateFrom()"
               (click)="openNativeDatePicker(fromInput)">
            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span>{{ dateFrom() ? formatDateLabel(dateFrom()!) : 'From' }}</span>
            <input #fromInput type="date" [value]="dateFrom() ?? ''" (change)="onDateFromChange($event)"/>
          </div>

          <!-- Until -->
          <div class="fp-date-pill" [class.active]="!!dateTo()"
               (click)="openNativeDatePicker(toInput)">
            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span>{{ dateTo() ? formatDateLabel(dateTo()!) : 'Until' }}</span>
            <input #toInput type="date" [value]="dateTo() ?? ''" [min]="dateFrom() ?? ''" (change)="onDateToChange($event)"/>
          </div>

          <!-- Status -->
          <div class="relative">
            <button class="fp-btn" [class.active]="filters().status !== 'all'" [class.open]="openFilterId() === 'status'"
                    (click)="toggleFilter('status')">
              {{ statusLabel() }}
              <svg class="fp-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            @if (openFilterId() === 'status') {
              <div class="fp-dropdown">
                @for (opt of statusOptions; track opt.value) {
                  <button class="fp-option" [class.sel]="filters().status === opt.value"
                          (click)="setStatus(opt.value); closeFilter()">
                    {{ opt.label }}
                    @if (filters().status === opt.value) {
                      <svg class="fp-check" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    }
                  </button>
                }
              </div>
            }
          </div>

          <!-- Format -->
          <div class="relative">
            <button class="fp-btn" [class.active]="filters().eventType !== 'all'" [class.open]="openFilterId() === 'type'"
                    (click)="toggleFilter('type')">
              {{ typeLabel() }}
              <svg class="fp-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            @if (openFilterId() === 'type') {
              <div class="fp-dropdown">
                @for (opt of typeOptions; track opt.value) {
                  <button class="fp-option" [class.sel]="filters().eventType === opt.value"
                          (click)="setEventType(opt.value); closeFilter()">
                    {{ opt.label }}
                    @if (filters().eventType === opt.value) {
                      <svg class="fp-check" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    }
                  </button>
                }
              </div>
            }
          </div>

          <!-- Visibility -->
          <div class="relative">
            <button class="fp-btn" [class.active]="filters().visibility !== 'all'" [class.open]="openFilterId() === 'visibility'"
                    (click)="toggleFilter('visibility')">
              {{ visibilityLabel() }}
              <svg class="fp-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            @if (openFilterId() === 'visibility') {
              <div class="fp-dropdown">
                @for (opt of visibilityOptions; track opt.value) {
                  <button class="fp-option" [class.sel]="filters().visibility === opt.value"
                          (click)="setVisibility(opt.value); closeFilter()">
                    {{ opt.label }}
                    @if (filters().visibility === opt.value) {
                      <svg class="fp-check" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    }
                  </button>
                }
              </div>
            }
          </div>

          <!-- Category -->
          @if (availableCategories().length > 0) {
            <div class="relative">
              <button class="fp-btn" [class.active]="filters().categoryId !== null" [class.open]="openFilterId() === 'category'"
                      (click)="toggleFilter('category')">
                {{ categoryLabel() }}
                <svg class="fp-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              @if (openFilterId() === 'category') {
                <div class="fp-dropdown">
                  <button class="fp-option" [class.sel]="filters().categoryId === null"
                          (click)="setCategory(''); closeFilter()">
                    All Categories
                    @if (filters().categoryId === null) {
                      <svg class="fp-check" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    }
                  </button>
                  <div class="fp-sep"></div>
                  @for (cat of availableCategories(); track cat.id) {
                    <button class="fp-option" [class.sel]="filters().categoryId === cat.id"
                            (click)="setCategory(cat.id.toString()); closeFilter()">
                      {{ cat.name }}
                      @if (filters().categoryId === cat.id) {
                        <svg class="fp-check" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          }

          <!-- Clear -->
          @if (hasActiveFilters()) {
            <button (click)="clearFilters()"
                    class="flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all"
                    style="font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;
                           color:rgba(242,238,230,.35);border:1px solid rgba(242,238,230,.08);
                           background:rgba(242,238,230,.03)">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Clear
            </button>
          }

          <!-- Result count -->
          @if (hasActiveFilters()) {
            <span style="font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.1em;
                         text-transform:uppercase;color:rgba(242,238,230,.25);margin-left:auto">
              {{ filteredEvents().length }} / {{ events().length }}
            </span>
          }
        </div>
      </div>
    </div>
  }

  <!-- ══════════════════════════════════════════
       MAIN CONTENT
  ══════════════════════════════════════════ -->
  <div class="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-8">

    <!-- LOADING -->
    @if (loading()) {
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        @for (i of [1,2,3,4,5,6,7,8,9,10]; track i) {
          <div class="skeleton skeleton-card" [style.animation-delay]="i * 50 + 'ms'"></div>
        }
      </div>

    <!-- NO ORG -->
    } @else if (!orgId()) {
      <div class="flex flex-col items-center justify-center py-28 text-center space-y-5">
        <div class="w-20 h-20 rounded-2xl flex items-center justify-center"
             style="background:rgba(255,68,51,.08);border:1px solid rgba(255,68,51,.2)">
          <svg class="w-9 h-9" style="color:#FF4433" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>
        <div>
          <p style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:.06em;color:#F2EEE6">
            No Organisation Found
          </p>
          <p class="mt-1" style="font-size:.85rem;color:rgba(242,238,230,.38)">Please log in with an organisation account to manage events.</p>
        </div>
      </div>

    <!-- EMPTY – no events -->
    } @else if (events().length === 0) {
      <div class="flex flex-col items-center justify-center py-28 text-center space-y-6">
        <div class="relative">
          <div class="w-24 h-24 rounded-3xl flex items-center justify-center"
               style="background:rgba(255,68,51,.06);border:1px solid rgba(255,68,51,.15)">
            <svg class="w-10 h-10" style="color:rgba(255,68,51,.5)" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
            </svg>
          </div>
        </div>
        <div>
          <p style="font-family:'Bebas Neue',sans-serif;font-size:2rem;letter-spacing:.06em;color:#F2EEE6">
            No Events Yet
          </p>
          <p class="mt-1" style="font-size:.88rem;color:rgba(242,238,230,.38);max-width:320px;margin-inline:auto;line-height:1.7">
            Create your first event to start selling tickets and engaging your audience.
          </p>
        </div>
        <button (click)="openCreateModal()"
                class="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white transition-all hover:opacity-90"
                style="background:linear-gradient(135deg,#FF4433,#ff6b45);box-shadow:0 0 30px rgba(255,68,51,.3)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Create First Event
        </button>
      </div>

    <!-- EMPTY – filtered -->
    } @else if (filteredEvents().length === 0) {
      <div class="flex flex-col items-center justify-center py-24 text-center space-y-5">
        <div class="w-18 h-18 rounded-2xl flex items-center justify-center"
             style="background:rgba(242,238,230,.04);border:1px solid rgba(242,238,230,.08)">
          <svg class="w-8 h-8" style="color:rgba(242,238,230,.25)" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z"/>
          </svg>
        </div>
        <div>
          <p style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:.06em;color:#F2EEE6">No Matches</p>
          <p class="mt-1" style="font-size:.82rem;color:rgba(242,238,230,.35)">Try adjusting your filters.</p>
        </div>
        <button (click)="clearFilters()"
                class="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all"
                style="font-family:'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase;
                       color:rgba(242,238,230,.5);border:1px solid rgba(242,238,230,.1);
                       background:rgba(242,238,230,.04)">
          Clear Filters
        </button>
      </div>

    <!-- ── HERO-CARD GRID ── -->
    } @else {
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        @for (event of filteredEvents(); track event.id; let i = $index) {

          <div class="event-card page-enter" [style.animation-delay]="i * 45 + 'ms'"
               (click)="openViewModal(event)">

            <!-- Image -->
            @if (event.event_img_url) {
              <img [src]="event.event_img_url" [alt]="event.title" class="ec-img" (error)="onImgErr($event)"/>
            } @else {
              <div class="ec-fallback" [style]="getGradient(event)">
                <div class="ec-fallback-pattern"></div>
                <svg class="w-10 h-10 relative z-10" style="color:rgba(242,238,230,.12)"
                     fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                </svg>
              </div>
            }

            <!-- Overlay -->
            <div class="ec-overlay">

              <!-- Top: status + format tags + 3-dot -->
              <div class="flex items-start justify-between gap-1.5">
                <div class="flex flex-col gap-1">
                  @if (isUpcoming(event)) {
                    <span class="ec-tag ec-tag--upcoming"><span class="dot"></span>Live</span>
                  } @else {
                    <span class="ec-tag ec-tag--past">Ended</span>
                  }
                  @if (event.event_location_type === 0) {
                    <span class="ec-tag ec-tag--online">Online</span>
                  } @else {
                    <span class="ec-tag ec-tag--inperson">In-Person</span>
                  }
                </div>

                <!-- 3-dot menu -->
                <div class="relative" (click)="$event.stopPropagation()">
                  <button class="dots-btn" (click)="toggleMenu(event.id)">
                    <span class="d"></span><span class="d"></span><span class="d"></span>
                  </button>
                  @if (openMenuId() === event.id) {
                    <div class="ctx-menu">
                      <button class="ctx-item" (click)="openViewModal(event); closeMenu()">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        View Details
                      </button>
                      <button class="ctx-item" (click)="openEditModal(event)">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        Edit Event
                      </button>
                      <div class="ctx-sep"></div>
                      <button class="ctx-item danger" (click)="deleteEvent(event)">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Bottom: visibility + category + date + title + meta -->
              <div>
                <!-- Visibility + category pills -->
                <div class="flex flex-wrap gap-1 mb-2">
                  @if (event.event_type === 0) {
                    <span class="ec-tag ec-tag--public">Public</span>
                  } @else {
                    <span class="ec-tag ec-tag--private">Private</span>
                  }
                  @if (event.category?.name) {
                    <span class="ec-tag ec-tag--cat">{{ event.category?.name }}</span>
                  }
                </div>

                <!-- Date -->
                <p class="ec-date">{{ event.start_time | date:'EEE · MMM d, y' | uppercase }}</p>

                <!-- Title -->
                <h3 class="ec-title">{{ event.title }}</h3>

                <!-- Meta -->
                <div class="ec-meta">
                  <span class="ec-loc">
                    <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0">
                      <path stroke-linecap="round" stroke-linejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    {{ event.event_location_type === 0 ? 'Online' : (event.city || 'TBD') }}
                  </span>
                  <span class="ec-cta">View →</span>
                </div>
              </div>
            </div>

            <div class="ec-glow"></div>
          </div>

        }
      </div>
    }

  </div>
</div>

<!-- ── Modals ── -->
@if (showCreateModal()) {
  <app-create-event-modal (created)="onEventCreated()" (close)="showCreateModal.set(false)"/>
}
@if (showEditModal() && selectedEvent()) {
  <app-edit-event-modal [event]="selectedEvent()!" (updated)="onEventUpdated($event)" (close)="showEditModal.set(false)"/>
}
@if (showViewModal() && selectedEvent()) {
  <app-view-event-modal [event]="selectedEvent()!" (edit)="switchToEdit()" (close)="showViewModal.set(false)"/>
}
  `,
})
export class EventsPageComponent implements OnInit {
  private eventService = inject(EventService);
  private authService  = inject(AuthService);
  private filterPipe   = new FilterEventsPipe();

  // ── State ────────────────────────────────────────────────────────────────
  events          = signal<EventModel[]>([]);
  loading         = signal(false);
  orgId           = signal<number | null>(null);
  filters         = signal<EventFilters>({ ...DEFAULT_FILTERS });
  dateFrom        = signal<string | null>(null);
  dateTo          = signal<string | null>(null);
  showCreateModal = signal(false);
  showEditModal   = signal(false);
  showViewModal   = signal(false);
  selectedEvent   = signal<EventModel | null>(null);
  openMenuId      = signal<number | null>(null);
  openFilterId    = signal<string | null>(null);

  // ── Filter options ───────────────────────────────────────────────────────
  readonly statusOptions: { value: EventStatusFilter; label: string }[] = [
    { value: 'all',      label: 'All Status' },
    { value: 'upcoming', label: 'Upcoming'   },
    { value: 'past',     label: 'Past'       },
  ];
  readonly typeOptions: { value: EventLocationFilter; label: string }[] = [
    { value: 'all',      label: 'All Formats' },
    { value: 'online',   label: 'Online'      },
    { value: 'inperson', label: 'In-Person'   },
  ];
  readonly visibilityOptions: { value: EventVisibilityFilter; label: string }[] = [
    { value: 'all',     label: 'All Events' },
    { value: 'public',  label: 'Public'     },
    { value: 'private', label: 'Private'    },
  ];

  // ── Computed ─────────────────────────────────────────────────────────────
  filteredEvents = computed(() => {
    const f: EventFilters = {
      ...this.filters(),
      dateFrom: this.dateFrom() ? new Date(this.dateFrom()! + 'T00:00:00') : null,
      dateTo:   this.dateTo()   ? new Date(this.dateTo()!   + 'T23:59:59') : null,
    };
    return this.filterPipe.transform(this.events(), f);
  });

  statsCards = computed(() => {
    const now  = new Date();
    const all  = this.events();
    const up   = all.filter(e => new Date(e.start_time) > now).length;
    const pub  = all.filter(e => e.event_type === 0).length;
    const priv = all.filter(e => e.event_type === 1).length;
    return [
      {
        label: 'Total', value: all.length,
        color: '#a5b4fc', bgColor: 'rgba(99,102,241,.1)',
        path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      },
      {
        label: 'Upcoming', value: up,
        color: '#FF4433', bgColor: 'rgba(255,68,51,.1)',
        path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      },
      {
        label: 'Public', value: pub,
        color: '#10b981', bgColor: 'rgba(16,185,129,.1)',
        path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      },
      {
        label: 'Private', value: priv,
        color: '#a78bfa', bgColor: 'rgba(139,92,246,.1)',
        path: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
      },
    ];
  });

  statusLabel     = computed(() => this.statusOptions    .find(o => o.value === this.filters().status)     ?.label ?? 'Status');
  typeLabel       = computed(() => this.typeOptions      .find(o => o.value === this.filters().eventType)  ?.label ?? 'Format');
  visibilityLabel = computed(() => this.visibilityOptions.find(o => o.value === this.filters().visibility) ?.label ?? 'Visibility');
  categoryLabel   = computed(() => {
    const id = this.filters().categoryId;
    return id === null ? 'Category' : (this.availableCategories().find(c => c.id === id)?.name ?? 'Category');
  });
  availableCategories = computed<Category[]>(() => {
    const seen = new Map<number, string>();
    for (const e of this.events()) {
      if (e.categoryId && e.category?.name && !seen.has(e.categoryId))
        seen.set(e.categoryId, e.category.name);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  });
  hasActiveFilters = computed(() => {
    const f = this.filters();
    return f.search.trim() !== '' || f.eventType !== 'all' || f.visibility !== 'all' ||
           f.status !== 'all' || f.categoryId !== null || !!this.dateFrom() || !!this.dateTo();
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit() {
    // FIX #5 & #6: resolve org and load only that org's events
    const org = this.authService.getOrganization();
    if (org) {
      this.orgId.set(org.id);
      this.loadEvents(org.id);
    }
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.openMenuId()   !== null) this.openMenuId.set(null);
    if (this.openFilterId() !== null) this.openFilterId.set(null);
  }

  // ── Filter actions ───────────────────────────────────────────────────────
  toggleFilter(id: string) { this.openFilterId.set(this.openFilterId() === id ? null : id); }
  closeFilter() { this.openFilterId.set(null); }
  closeMenu()   { this.openMenuId.set(null); }

  setSearch(e: Event)                      { this.filters.update(f => ({ ...f, search: (e.target as HTMLInputElement).value })); }
  setEventType(t: EventLocationFilter)     { this.filters.update(f => ({ ...f, eventType: t })); }
  setStatus(s: EventStatusFilter)          { this.filters.update(f => ({ ...f, status: s })); }
  setVisibility(v: EventVisibilityFilter)  { this.filters.update(f => ({ ...f, visibility: v })); }
  setCategory(v: string)                   { this.filters.update(f => ({ ...f, categoryId: v ? Number(v) : null })); }
  onDateFromChange(e: Event)               { this.dateFrom.set((e.target as HTMLInputElement).value || null); }
  onDateToChange(e: Event)                 { this.dateTo.set((e.target as HTMLInputElement).value || null); }
  clearFilters() {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.dateFrom.set(null);
    this.dateTo.set(null);
  }
  formatDateLabel(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  openNativeDatePicker(input: HTMLInputElement | null) {
    if (!input) return;
    const a = input as any;
    typeof a.showPicker === 'function' ? a.showPicker() : (input.focus(), input.click());
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  // FIX #5 & #6: call getEventsByOrganization instead of getAllEvents
  private loadEvents(orgId: number) {
    this.loading.set(true);
    this.eventService.getEventsByOrganization(orgId).subscribe({
      next:  d  => { this.events.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  // ── Modals ───────────────────────────────────────────────────────────────
  openCreateModal()             { this.showCreateModal.set(true); }
  openViewModal(e: EventModel)  { this.openMenuId.set(null); this.selectedEvent.set(e); this.showViewModal.set(true); }
  openEditModal(e: EventModel)  { this.openMenuId.set(null); this.selectedEvent.set(e); this.showViewModal.set(false); this.showEditModal.set(true); }
  switchToEdit()                { this.showViewModal.set(false); this.showEditModal.set(true); }
  onEventCreated()              { this.showCreateModal.set(false); this.loadEvents(this.orgId()!); }
  onEventUpdated(u: EventModel) {
    this.showEditModal.set(false);
    this.events.update(l => l.map(e => e.id === u.id ? u : e));
    this.selectedEvent.set(u);
  }
  deleteEvent(event: EventModel) {
    this.openMenuId.set(null);
    if (!confirm(`Delete "${event.title}"?\n\nThis cannot be undone.`)) return;
    this.eventService.deleteEvent(event.id).subscribe({
      next:  () => { this.events.update(l => l.filter(e => e.id !== event.id)); toast.success('Event deleted'); },
      error: () => toast.error('Failed to delete event'),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  toggleMenu(id: number) { this.openMenuId.set(this.openMenuId() === id ? null : id); }
  isUpcoming(e: EventModel) { return new Date(e.start_time) > new Date(); }
  onImgErr(e: Event)        { (e.target as HTMLImageElement).style.display = 'none'; }
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
}