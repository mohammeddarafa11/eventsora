// src/app/features/events/modals/view-event-modal.ts
// KEY FIX: EventLocationType.Online = 1 (backend). Template uses enum constants
// so it is automatically correct once event.model.ts is updated.
import {
  Component, input, output, ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { Event as EventModel, EventLocationType, EventType } from "@core/models/event.model";

@Component({
  selector: "app-view-event-modal",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe],
  styles: [`
    @import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap");
    :host {
      --bg:#060608;--bg2:#09090c;--coral:#FF4433;--coral-dim:rgba(255,68,51,.1);
      --coral-brd:rgba(255,68,51,.22);--gold:#F0B429;--gold-dim:rgba(240,180,41,.1);
      --gold-brd:rgba(240,180,41,.22);--text:#F2EEE6;--muted:rgba(242,238,230,.42);
      --border:rgba(242,238,230,.07);--border-hi:rgba(242,238,230,.12);
    }
    @keyframes backdrop-in{from{opacity:0}to{opacity:1}}
    @keyframes modal-in{from{opacity:0;transform:scale(.95) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes fade-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes img-in{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:scale(1)}}
    .backdrop-in{animation:backdrop-in .25s ease both}
    .modal-enter{animation:modal-in .35s cubic-bezier(.22,1,.36,1) both}
    .fade-up{animation:fade-up .4s cubic-bezier(.22,1,.36,1) both}
    .img-in{animation:img-in .55s cubic-bezier(.22,1,.36,1) both}
    .thin-scroll::-webkit-scrollbar{width:3px}
    .thin-scroll::-webkit-scrollbar-track{background:transparent}
    .thin-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:99px}
    .tile{transition:background .18s,border-color .2s,transform .18s}
    .tile:hover{transform:translateY(-1px)!important}
    .close-btn,.edit-btn{transition:all .2s}
    .edit-btn:hover{box-shadow:0 0 44px rgba(255,68,51,.5)!important;transform:translateY(-1px)}
    .join-link{transition:opacity .2s}.join-link:hover{opacity:.75}
  `],
  template: `
<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-in"
     style="background:rgba(0,0,0,.82);backdrop-filter:blur(24px)" (click)="onClose()">
<div class="modal-enter relative w-full sm:max-w-[620px] max-h-[96dvh] sm:max-h-[90vh]
            flex flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px]"
     style="background:var(--bg2);color:var(--text);border:1px solid var(--border-hi);box-shadow:0 48px 120px rgba(0,0,0,.85)"
     (click)="$event.stopPropagation()">

  <div class="relative shrink-0 overflow-hidden rounded-t-[28px]" style="height:240px">
    @if (event().event_img_url) {
      <img [src]="event().event_img_url" [alt]="event().title"
           class="img-in absolute inset-0 w-full h-full object-cover" (error)="onImgErr($event)"/>
    } @else {
      <div class="absolute inset-0" [style]="heroGradient()">
        <div class="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none">
          <span style="font-family:Bebas Neue,sans-serif;font-size:8rem;letter-spacing:.06em;color:transparent;-webkit-text-stroke:1px rgba(242,238,230,.04);white-space:nowrap;padding:0 2rem">
            {{ event().title?.toUpperCase() }}
          </span>
        </div>
      </div>
    }
    <div class="absolute inset-0 pointer-events-none"
         style="background:linear-gradient(to top,var(--bg2) 0%,rgba(9,9,12,.58) 38%,transparent 72%)"></div>
    <div class="absolute bottom-4 left-5 flex items-center gap-2 fade-up" style="animation-delay:.1s">
      @if (isUpcoming()) {
        <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:100px;font-size:.61rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.26)">
          <span style="width:5px;height:5px;border-radius:50%;background:#10b981;box-shadow:0 0 7px #10b981;flex-shrink:0;display:inline-block"></span>Upcoming
        </span>
      } @else {
        <span style="padding:5px 12px;border-radius:100px;font-size:.61rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;background:rgba(113,113,122,.12);color:#71717a;border:1px solid rgba(113,113,122,.2)">Ended</span>
      }
      @if (event().event_location_type === EventLocationType.Online) {
        <span style="padding:5px 12px;border-radius:100px;font-size:.61rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;background:var(--gold-dim);color:var(--gold);border:1px solid var(--gold-brd)">Online</span>
      } @else {
        <span style="padding:5px 12px;border-radius:100px;font-size:.61rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;background:var(--coral-dim);color:var(--coral);border:1px solid var(--coral-brd)">In-Person</span>
      }
    </div>
    <button class="close-btn absolute top-4 right-4 flex items-center justify-center"
            style="width:36px;height:36px;border-radius:10px;background:rgba(6,6,8,.65);backdrop-filter:blur(12px);border:1px solid var(--border-hi);color:var(--muted)"
            (click)="onClose()">
      <svg style="width:15px;height:15px" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>

  <div class="flex-1 overflow-y-auto thin-scroll">
    <div style="padding:1.5rem;display:flex;flex-direction:column;gap:1.35rem">

      <div class="fade-up" style="animation-delay:.05s;display:flex;flex-direction:column;gap:.32rem">
        @if (event().category?.name) {
          <span style="font-size:.63rem;letter-spacing:.16em;text-transform:uppercase;color:var(--coral)">{{ event().category?.name }}</span>
        }
        <h2 style="font-family:Bebas Neue,sans-serif;font-size:clamp(1.9rem,6vw,2.7rem);letter-spacing:.03em;color:var(--text);margin:0;line-height:.96">{{ event().title }}</h2>
        @if (event().organization?.name) {
          <p style="font-size:.76rem;color:var(--muted);display:flex;align-items:center;gap:5px;margin:0">
            <svg style="width:12px;height:12px;flex-shrink:0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            {{ event().organization?.name }}
          </p>
        }
      </div>

      @if (event().description) {
        <p class="fade-up" style="animation-delay:.08s;font-size:.87rem;color:var(--muted);line-height:1.75;margin:0;font-weight:300">{{ event().description }}</p>
      }
      <div style="height:1px;background:var(--border)"></div>

      <div class="fade-up" style="animation-delay:.12s;display:grid;grid-template-columns:1fr 1fr;gap:.7rem">

        <div class="tile" style="grid-column:span 2;display:flex;align-items:flex-start;gap:.82rem;padding:.95rem 1.1rem;border-radius:14px;background:rgba(255,255,255,.022);border:1px solid var(--border)">
          <div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--gold-dim);border:1px solid var(--gold-brd)">
            <svg style="width:15px;height:15px;color:var(--gold)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <div style="min-width:0">
            <p style="font-size:.59rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 4px">Date &amp; Time</p>
            <p style="font-size:.92rem;font-weight:700;color:var(--text);margin:0">{{ event().start_time | date:"EEE, MMM d, y" }}</p>
            <p style="font-size:.75rem;color:var(--muted);margin:2px 0 0">
              {{ event().start_time | date:"h:mm a" }}
              @if (event().end_time) { &nbsp;–&nbsp; {{ event().end_time | date:"h:mm a" }} }
            </p>
          </div>
        </div>

        <div class="tile" style="grid-column:span 2;display:flex;align-items:flex-start;gap:.82rem;padding:.95rem 1.1rem;border-radius:14px"
             [style.background]="event().event_location_type === EventLocationType.Online ? 'rgba(240,180,41,.04)' : 'rgba(255,255,255,.022)'"
             [style.border]="event().event_location_type === EventLocationType.Online ? '1px solid var(--gold-brd)' : '1px solid var(--border)'">
          <div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0"
               [style.background]="event().event_location_type === EventLocationType.Online ? 'var(--gold-dim)' : 'var(--coral-dim)'"
               [style.border]="event().event_location_type === EventLocationType.Online ? '1px solid var(--gold-brd)' : '1px solid var(--coral-brd)'">
            @if (event().event_location_type === EventLocationType.Online) {
              <svg style="width:15px;height:15px;color:var(--gold)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            } @else {
              <svg style="width:15px;height:15px;color:var(--coral)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            }
          </div>
          <div style="min-width:0;flex:1">
            <p style="font-size:.59rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 4px">
              {{ event().event_location_type === EventLocationType.Online ? "Meeting Link" : "Location" }}
            </p>
            @if (event().event_location_type === EventLocationType.Online) {
              @if (event().online_url) {
                <a [href]="event().online_url" target="_blank" rel="noopener noreferrer" class="join-link"
                   style="font-size:.9rem;font-weight:700;color:var(--gold);display:inline-flex;align-items:center;gap:6px;text-decoration:none">
                  Join Meeting
                  <svg style="width:12px;height:12px" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                </a>
              } @else {
                <p style="font-size:.87rem;color:var(--muted);margin:0">No link provided yet</p>
              }
            } @else {
              <p style="font-size:.92rem;font-weight:700;color:var(--text);margin:0">
                {{ event().city }}@if (event().region) {, {{ event().region }}}
              </p>
              @if (event().nameOfPlace || event().street) {
                <p style="font-size:.74rem;color:var(--muted);margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  {{ event().nameOfPlace }}@if (event().street) { &nbsp;·&nbsp; {{ event().street }}}
                </p>
              }
            }
          </div>
        </div>

        @if (event().event_type !== undefined) {
          <div class="tile" style="display:flex;align-items:center;gap:.7rem;padding:.85rem .95rem;border-radius:14px;background:rgba(255,255,255,.022);border:1px solid var(--border)">
            <div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.2)">
              <svg style="width:13px;height:13px;color:#a78bfa" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
              </svg>
            </div>
            <div>
              <p style="font-size:.57rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 3px">Type</p>
              <p style="font-size:.84rem;font-weight:600;color:var(--text);margin:0">{{ event().event_type === EventType.Public ? "Public" : "Private" }}</p>
            </div>
          </div>
        }

        @if (event().category?.name) {
          <div class="tile" style="display:flex;align-items:center;gap:.7rem;padding:.85rem .95rem;border-radius:14px;background:rgba(255,255,255,.022);border:1px solid var(--border)">
            <div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--coral-dim);border:1px solid var(--coral-brd)">
              <svg style="width:13px;height:13px;color:var(--coral)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
              </svg>
            </div>
            <div>
              <p style="font-size:.57rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 3px">Category</p>
              <p style="font-size:.84rem;font-weight:600;color:var(--coral);margin:0">{{ event().category?.name }}</p>
            </div>
          </div>
        }
      </div>
    </div>
  </div>

  <div style="flex-shrink:0;padding:.95rem 1.5rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:.75rem;background:rgba(6,6,8,.9);backdrop-filter:blur(14px)">
    <button (click)="onClose()"
            style="padding:.58rem 1.2rem;border-radius:100px;font-size:.82rem;font-weight:500;color:var(--muted);background:transparent;border:1px solid var(--border);cursor:pointer;transition:all .2s"
            onmouseenter="this.style.color=getComputedStyle(this.closest(\'[style]\') || document.documentElement).getPropertyValue(\'--text\');this.style.background=\'rgba(255,255,255,.04)\'"
            onmouseleave="this.style.color=\'\';this.style.background=\'transparent\'">
      Close
    </button>
    <button class="edit-btn" (click)="onEdit()"
            style="display:inline-flex;align-items:center;gap:8px;padding:.62rem 1.4rem;border-radius:100px;font-weight:700;font-size:.85rem;color:#fff;background:var(--coral);border:none;cursor:pointer;box-shadow:0 0 26px rgba(255,68,51,.3);position:relative;overflow:hidden">
      <span style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.14) 0%,transparent 55%);pointer-events:none"></span>
      <svg style="width:13px;height:13px;position:relative;z-index:1" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
      </svg>
      <span style="position:relative;z-index:1">Edit Event</span>
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

  readonly EventLocationType = EventLocationType;
  readonly EventType         = EventType;

  isUpcoming(): boolean { return new Date(this.event().start_time) > new Date(); }

  heroGradient(): string {
    const g = [
      "background:linear-gradient(135deg,#1a0808,#2d0f0f)",
      "background:linear-gradient(135deg,#0d0a00,#211800)",
      "background:linear-gradient(135deg,#00080a,#001218)",
      "background:linear-gradient(135deg,#080010,#100020)",
      "background:linear-gradient(135deg,#0a0005,#180010)",
    ];
    return g[this.event().id % g.length];
  }

  onImgErr(e: Event): void { (e.target as HTMLImageElement).style.display = "none"; }
  onEdit():           void { this.edit.emit();  }
  onClose():          void { this.close.emit(); }
}