// src/app/features/events/modals/view-event-modal.ts
import {
  Component, input, output, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Event as EventModel, EventType } from '@core/models/event.model';

@Component({
  selector: 'app-view-event-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe],

  styles: [`
    @keyframes modal-in {
      from { opacity:0; transform:scale(.97) translateY(10px) }
      to   { opacity:1; transform:scale(1)   translateY(0) }
    }
    @keyframes fade-in { from { opacity:0 } to { opacity:1 } }

    .modal-enter { animation: modal-in .28s cubic-bezier(.22,1,.36,1) both }
    .fade-in     { animation: fade-in  .3s ease both }

    /* Thin scrollbar */
    .thin-scroll::-webkit-scrollbar { width: 3px; }
    .thin-scroll::-webkit-scrollbar-track { background: transparent; }
    .thin-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 99px; }

    /* Info tile hover */
    .info-tile { transition: background .15s, border-color .15s; }
    .info-tile:hover { background: rgba(255,255,255,.04) !important; }
  `],

  template: `
<!-- ░░  BACKDROP  ░░ -->
<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
     style="background:rgba(0,0,0,.75);backdrop-filter:blur(18px)"
     (click)="onClose()">

<!-- ░░  MODAL  ░░ -->
<div class="modal-enter relative w-full sm:max-w-[600px] max-h-[96dvh] sm:max-h-[88vh]
            flex flex-col overflow-hidden
            rounded-t-3xl sm:rounded-3xl
            border border-white/[.07]
            shadow-[0_32px_80px_rgba(0,0,0,.7)]"
     style="background:#0f0f11;color:#f4f4f5"
     (click)="$event.stopPropagation()">

  <!-- ── Hero image / gradient ── -->
  <div class="relative shrink-0 h-52 overflow-hidden rounded-t-3xl sm:rounded-t-3xl">
    @if (event().event_img_url) {
      <img [src]="event().event_img_url" [alt]="event().title"
           class="w-full h-full object-cover fade-in"
           (error)="onImgErr($event)"/>
    } @else {
      <!-- Deterministic gradient placeholder -->
      <div class="w-full h-full" [style]="heroGradient()">
        <div class="absolute inset-0"
             style="background:repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,255,255,.03) 10px,rgba(255,255,255,.03) 20px)"></div>
      </div>
    }

    <!-- Dark overlay for text legibility -->
    <div class="absolute inset-0"
         style="background:linear-gradient(to top,rgba(15,15,17,1) 0%,rgba(15,15,17,.5) 40%,transparent 80%)"></div>

    <!-- Badges overlaid on image -->
    <div class="absolute bottom-3.5 left-4 flex items-center gap-2">
      @if (isUpcoming()) {
        <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style="background:rgba(16,185,129,.18);color:#10b981;border:1px solid rgba(16,185,129,.3)">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Upcoming
        </span>
      } @else {
        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold"
              style="background:rgba(113,113,122,.18);color:#71717a;border:1px solid rgba(113,113,122,.25)">
          Ended
        </span>
      }

      @if (event().event_type === EventType.Online) {
        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold"
              style="background:rgba(245,158,11,.14);color:#f59e0b;border:1px solid rgba(245,158,11,.25)">
          💻 Online
        </span>
      } @else {
        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold"
              style="background:rgba(99,102,241,.14);color:#a5b4fc;border:1px solid rgba(99,102,241,.25)">
          📍 In-Person
        </span>
      }
    </div>

    <!-- Close button -->
    <button (click)="onClose()"
            class="absolute top-3.5 right-3.5 w-8 h-8 rounded-xl flex items-center justify-center
                   border border-white/[.1] text-zinc-400 hover:text-white
                   transition-all duration-150 hover:bg-white/[.1]"
            style="background:rgba(0,0,0,.45);backdrop-filter:blur(8px)">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>

  <!-- ── Scrollable body ── -->
  <div class="flex-1 overflow-y-auto thin-scroll">
    <div class="px-6 pt-5 pb-6 space-y-6">

      <!-- Title + org -->
      <div class="space-y-1.5">
        @if (event().category?.name) {
          <span class="text-[11px] font-semibold tracking-[.12em] uppercase text-amber-400/80">
            {{ event().category.name }}
          </span>
        }
        <h2 class="text-2xl font-bold text-white leading-tight tracking-tight">
          {{ event().title }}
        </h2>
        @if (event().organization?.name) {
          <p class="text-[13px] text-zinc-500 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            {{ event().organization.name }}
          </p>
        }
      </div>

      <!-- Description -->
      <p class="text-[14px] text-zinc-400 leading-relaxed">{{ event().description }}</p>

      <!-- Divider -->
      <div class="h-px" style="background:rgba(255,255,255,.06)"></div>

      <!-- Info tiles grid -->
      <div class="grid grid-cols-2 gap-3">

        <!-- Date & Time -->
        <div class="info-tile col-span-2 sm:col-span-1 flex items-start gap-3.5 p-4 rounded-2xl border border-white/[.05]"
             style="background:rgba(255,255,255,.025)">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
               style="background:rgba(245,158,11,.12)">
            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1">Date & Time</p>
            <p class="text-[14px] font-semibold text-white truncate">
              {{ event().start_time | date: 'MMM d, y' }}
            </p>
            <p class="text-[12px] text-zinc-500 mt-0.5">
              {{ event().start_time | date: 'h:mm a' }}
              @if (event().end_time) { &ndash; {{ event().end_time | date: 'h:mm a' }} }
            </p>
          </div>
        </div>

        <!-- Location / Online -->
        <div class="info-tile col-span-2 sm:col-span-1 flex items-start gap-3.5 p-4 rounded-2xl border"
             [style]="event().event_type === EventType.Online
               ? 'background:rgba(245,158,11,.04);border-color:rgba(245,158,11,.15)'
               : 'background:rgba(255,255,255,.025);border-color:rgba(255,255,255,.05)'">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
               [style]="event().event_type === EventType.Online
                 ? 'background:rgba(245,158,11,.12)'
                 : 'background:rgba(99,102,241,.12)'">
            @if (event().event_type === EventType.Online) {
              <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            } @else {
              <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            }
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1">
              {{ event().event_type === EventType.Online ? 'Meeting Link' : 'Location' }}
            </p>
            @if (event().event_type === EventType.Online) {
              @if (event().online_url) {
                <a [href]="event().online_url" target="_blank" rel="noopener noreferrer"
                   class="text-[13px] font-semibold text-amber-400 hover:text-amber-300
                          flex items-center gap-1.5 transition-colors truncate">
                  Join Meeting
                  <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                </a>
              } @else {
                <p class="text-[13px] text-zinc-500">No link provided</p>
              }
            } @else {
              <p class="text-[14px] font-semibold text-white">
                {{ event().city }}@if (event().region) {, {{ event().region }}}
              </p>
              @if (event().name_of_place || event().street) {
                <p class="text-[12px] text-zinc-500 mt-0.5 truncate">
                  {{ event().name_of_place }}@if (event().street) { · {{ event().street }}}
                </p>
              }
            }
          </div>
        </div>

      </div>

    </div>
  </div>

  <!-- ── Footer ── -->
  <div class="shrink-0 px-6 py-4 border-t border-white/[.05] flex items-center justify-between gap-3"
       style="background:rgba(15,15,17,.9);backdrop-filter:blur(8px)">
    <button (click)="onClose()"
            class="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-500
                   hover:text-zinc-300 hover:bg-white/[.05] border border-white/[.05]
                   transition-all duration-150">
      Close
    </button>
    <button (click)="onEdit()"
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold
                   text-zinc-900 hover:opacity-90 active:scale-[.98] transition-all"
            style="background:linear-gradient(135deg,#f59e0b,#f97316)">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
      </svg>
      Edit Event
    </button>
  </div>

</div>
</div>
  `,
})
export class ViewEventModalComponent {
  event = input.required<EventModel>();
  edit  = output<void>();
  close = output<void>();

  readonly EventType = EventType;

  isUpcoming() { return new Date(this.event().start_time) > new Date(); }

  heroGradient(): string {
    const gradients = [
      'background:linear-gradient(135deg,#1a1a2e,#0f0a1e)',
      'background:linear-gradient(135deg,#1a0a00,#2d1500)',
      'background:linear-gradient(135deg,#001a0a,#002d16)',
      'background:linear-gradient(135deg,#0a0014,#1a0028)',
      'background:linear-gradient(135deg,#141400,#2a2400)',
    ];
    return gradients[this.event().id % gradients.length];
  }

  onImgErr(e: Event) { (e.target as HTMLImageElement).style.display = 'none'; }
  onEdit()  { this.edit.emit(); }
  onClose() { this.close.emit(); }
}