// src/app/features/events/modals/edit-event-modal.ts
// Backend enforces:
//   - Online events  → only online_url is editable for location
//   - Offline events → only city, region, name_of_place are editable for location
//   - event_location_type and event_type are immutable — NOT sent in UpdateEventDto

import {
  Component, inject, input, OnInit, output, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { toast } from 'ngx-sonner';

import { EventService }              from '@core/services/event.service';
import { CategoryService, Category } from '@core/services/category';
import { AuthService }               from '@core/services/auth.service';
import { Event as EventModel, EventLocationType, UpdateEventDto } from '@core/models/event.model';

@Component({
  selector: 'app-edit-event-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],

  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
    @keyframes modal-in { from{opacity:0;transform:scale(.97) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes spin { to { transform:rotate(360deg) } }
    .modal-enter { animation: modal-in .3s cubic-bezier(.22,1,.36,1) both }
    .spin { animation: spin .8s linear infinite }
    .field-wrap { border-bottom:1px solid rgba(242,238,230,.08); transition:border-color .2s; }
    .field-wrap:focus-within { border-color:#FF4433; }
    input,textarea,select { background:transparent!important;outline:none!important;box-shadow:none!important;border:none!important;color:#F2EEE6!important;width:100%;padding:0!important;font-size:14px!important;font-family:'Plus Jakarta Sans',sans-serif; }
    input::placeholder,textarea::placeholder { color:rgba(242,238,230,.2)!important; }
    select option { background:#0c0c10;color:#F2EEE6; }
    textarea { resize:none; }
    input[type='datetime-local']::-webkit-calendar-picker-indicator { filter:invert(.35);cursor:pointer; }
    .thin-scroll::-webkit-scrollbar { width:3px; }
    .thin-scroll::-webkit-scrollbar-track { background:transparent; }
    .thin-scroll::-webkit-scrollbar-thumb { background:rgba(242,238,230,.1);border-radius:99px; }
  `],

  template: `
<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
     style="background:rgba(0,0,0,.8);backdrop-filter:blur(20px)" (click)="onClose()">
<div class="modal-enter relative w-full sm:max-w-[660px] max-h-[96dvh] sm:max-h-[90vh]
            flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl
            border border-white/[.06] shadow-[0_40px_100px_rgba(0,0,0,.8)]"
     style="background:#080809;color:#F2EEE6;font-family:'Plus Jakarta Sans',sans-serif"
     (click)="$event.stopPropagation()">

  <!-- Header -->
  <div class="shrink-0 flex items-center justify-between px-6 py-5 border-b" style="border-color:rgba(242,238,230,.06)">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
           style="background:linear-gradient(135deg,#FF4433,#ff6b45)">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
        </svg>
      </div>
      <div>
        <p style="font-family:'Bebas Neue',sans-serif;font-size:1.15rem;letter-spacing:.05em;color:#F2EEE6;line-height:1">EDIT EVENT</p>
        <p class="text-[11px] truncate max-w-[260px]" style="color:rgba(242,238,230,.38);font-family:'DM Mono',monospace;letter-spacing:.06em">{{ event().title }}</p>
      </div>
    </div>
    <button (click)="onClose()" class="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style="background:rgba(242,238,230,.05);border:1px solid rgba(242,238,230,.07);color:rgba(242,238,230,.4)">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>

  @if (loadingCategories()) {
    <div class="flex-1 flex items-center justify-center py-16">
      <div class="spin w-7 h-7 rounded-full" style="border:2px solid rgba(255,68,51,.2);border-top-color:#FF4433"></div>
    </div>
  } @else if (eventForm) {
    <form [formGroup]="eventForm" (ngSubmit)="onSubmit()" class="flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-y-auto thin-scroll px-6 py-6 space-y-7">

        <!-- Title -->
        <div class="space-y-2">
          <label style="font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(242,238,230,.35)">Event Title *</label>
          <div class="field-wrap pb-2">
            <input type="text" formControlName="title" placeholder="Event title…"
                   style="font-family:'Bebas Neue',sans-serif!important;font-size:1.8rem!important;letter-spacing:.04em!important"/>
          </div>
          @if (f['title'].invalid && f['title'].touched) {
            <p class="text-[11px]" style="color:#FF4433">Title required (min 3 chars)</p>
          }
        </div>

        <!-- Description -->
        <div class="space-y-2">
          <label style="font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(242,238,230,.35)">Description *</label>
          <div class="field-wrap pb-2">
            <textarea formControlName="description" rows="3" placeholder="What will attendees experience?"></textarea>
          </div>
          @if (f['description'].invalid && f['description'].touched) {
            <p class="text-[11px]" style="color:#FF4433">Description required</p>
          }
        </div>

        <!-- Category -->
        <div class="space-y-2">
          <label style="font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(242,238,230,.35)">Category *</label>
          <div class="field-wrap pb-2">
            <select formControlName="categoryId">
              @for (cat of categories(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
          </div>
        </div>

        <!-- Date & Time -->
        <div class="space-y-3">
          <label style="font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(242,238,230,.35)">Date & Time *</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex items-center gap-3 p-4 rounded-2xl" style="background:rgba(255,68,51,.06);border:1px solid rgba(255,68,51,.15)">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:rgba(255,68,51,.15)">
                <svg class="w-3.5 h-3.5" style="color:#FF4433" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p style="font-family:'DM Mono',monospace;font-size:.57rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(242,238,230,.3)">Starts</p>
                <input type="datetime-local" formControlName="start_time"/>
              </div>
            </div>
            <div class="flex items-center gap-3 p-4 rounded-2xl" style="background:rgba(242,238,230,.03);border:1px solid rgba(242,238,230,.07)">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:rgba(242,238,230,.07)">
                <svg class="w-3.5 h-3.5" style="color:rgba(242,238,230,.4)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p style="font-family:'DM Mono',monospace;font-size:.57rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(242,238,230,.3)">Ends</p>
                <input type="datetime-local" formControlName="end_time"/>
              </div>
            </div>
          </div>
        </div>

        <!-- Location — read-only type badge + editable fields only -->
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <label style="font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(242,238,230,.35)">Location</label>
            <!-- Read-only format badge -->
            @if (isOnline()) {
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                    style="background:rgba(240,180,41,.12);color:#F0B429;border:1px solid rgba(240,180,41,.25);font-family:'DM Mono',monospace;letter-spacing:.08em">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                ONLINE
              </span>
            } @else {
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                    style="background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);font-family:'DM Mono',monospace;letter-spacing:.08em">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                IN-PERSON
              </span>
            }
          </div>

          @if (!isOnline()) {
            <!-- Offline: city, region, name_of_place only (backend enforced) -->
            <div class="p-4 rounded-2xl space-y-4" style="background:rgba(99,102,241,.04);border:1px solid rgba(99,102,241,.15)">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <p style="font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(242,238,230,.3)">City *</p>
                  <div class="field-wrap pb-1.5"><input type="text" formControlName="city" placeholder="Cairo"/></div>
                  @if (f['city'].invalid && f['city'].touched) { <p class="text-[10px]" style="color:#FF4433">Required</p> }
                </div>
                <div class="space-y-1.5">
                  <p style="font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(242,238,230,.3)">Region *</p>
                  <div class="field-wrap pb-1.5"><input type="text" formControlName="region" placeholder="Greater Cairo"/></div>
                  @if (f['region'].invalid && f['region'].touched) { <p class="text-[10px]" style="color:#FF4433">Required</p> }
                </div>
                <div class="col-span-2 space-y-1.5">
                  <p style="font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(242,238,230,.3)">Venue Name</p>
                  <div class="field-wrap pb-1.5"><input type="text" formControlName="name_of_place" placeholder="Grand Hall"/></div>
                </div>
              </div>
            </div>
          } @else {
            <!-- Online: URL only (backend enforced) -->
            <div class="flex items-start gap-4 p-4 rounded-2xl" style="background:rgba(240,180,41,.04);border:1px solid rgba(240,180,41,.18)">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:rgba(240,180,41,.12)">
                <svg class="w-3.5 h-3.5" style="color:#F0B429" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0 space-y-1.5">
                <p style="font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(242,238,230,.3)">Meeting URL *</p>
                <div class="field-wrap pb-1.5"><input type="url" formControlName="online_url" placeholder="https://meet.google.com/..."/></div>
                @if (f['online_url'].invalid && f['online_url'].touched) {
                  <p class="text-[11px]" style="color:#FF4433">Valid URL required</p>
                }
              </div>
            </div>
          }
        </div>

        <!-- Cover Image -->
        <div class="space-y-2">
          <label style="font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(242,238,230,.35)">Cover Image URL</label>
          <div class="field-wrap pb-2 flex items-center gap-2">
            <svg class="w-4 h-4 shrink-0" style="color:rgba(242,238,230,.25)" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <input type="url" formControlName="event_img_url" placeholder="https://your-image.com/cover.jpg"/>
          </div>
          @if (eventForm.get('event_img_url')?.value) {
            <div class="mt-2 rounded-xl overflow-hidden h-28 border" style="border-color:rgba(242,238,230,.07)">
              <img [src]="eventForm.get('event_img_url')?.value" class="w-full h-full object-cover" alt="">
            </div>
          }
        </div>

      </div>

      <!-- Footer -->
      <div class="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t"
           style="background:#080809;border-color:rgba(242,238,230,.06)">
        <button type="button" (click)="onClose()" [disabled]="submitting()"
                class="px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                style="color:rgba(242,238,230,.4);border:1px solid rgba(242,238,230,.08);background:rgba(242,238,230,.03)">
          Cancel
        </button>
        <button type="submit" [disabled]="submitting()"
                class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white
                       transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style="background:linear-gradient(135deg,#FF4433,#ff6b45);box-shadow:0 0 30px rgba(255,68,51,.3)">
          @if (submitting()) {
            <div class="spin w-4 h-4 rounded-full" style="border:2px solid rgba(255,255,255,.3);border-top-color:#fff"></div>
            Saving...
          } @else {
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            Save Changes
          }
        </button>
      </div>
    </form>
  }
</div>
</div>
  `,
})
export class EditEventModalComponent implements OnInit {
  event   = input.required<EventModel>();
  updated = output<EventModel>();
  close   = output<void>();

  private fb              = inject(FormBuilder);
  private eventService    = inject(EventService);
  private categoryService = inject(CategoryService);
  private authService     = inject(AuthService);

  eventForm!: FormGroup;
  categories        = signal<Category[]>([]);
  loadingCategories = signal(true);
  submitting        = signal(false);

  // Derived once from the event input — never changes during editing
  private _isOnline = signal(false);
  isOnline = this._isOnline.asReadonly();

  get f() { return this.eventForm.controls; }

  ngOnInit() {
    this.initForm();
    this.loadCategories();
  }

  private initForm() {
    const e = this.event();
    const isOnline = (e.event_location_type ?? EventLocationType.Offline) === EventLocationType.Online;
    this._isOnline.set(isOnline);

    this.eventForm = this.fb.group({
      title:         [e.title         ?? '', [Validators.required, Validators.minLength(3)]],
      description:   [e.description   ?? '',  Validators.required],
      start_time:    [this.toLocal(e.start_time), Validators.required],
      end_time:      [this.toLocal(e.end_time),   Validators.required],
      categoryId:    [e.categoryId,               Validators.required],
      event_img_url: [e.event_img_url  ?? ''],
      // Online-only field
      online_url:    [
        e.online_url ?? '',
        isOnline ? [Validators.required, Validators.pattern(/^https?:\/\/.+/)] : [],
      ],
      // Offline-only fields
      city:          [e.city       ?? '', isOnline ? [] : Validators.required],
      region:        [e.region     ?? '', isOnline ? [] : Validators.required],
      name_of_place: [e.nameOfPlace ?? ''],
    });
  }

  private toLocal(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  private loadCategories() {
    this.categoryService.getAllCategories().subscribe({
      next:  cats => { this.categories.set(cats); this.loadingCategories.set(false); },
      error: ()   => { toast.error('Failed to load categories'); this.loadingCategories.set(false); },
    });
  }

  onSubmit() {
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      toast.error('Please fill in all required fields');
      return;
    }
    const org = this.authService.getOrganization();
    if (!org) { toast.error('Organization not found'); return; }

    const v = this.eventForm.getRawValue();
    const startTime = v.start_time ? new Date(v.start_time) : null;
    const endTime   = v.end_time   ? new Date(v.end_time)   : null;
    if (!startTime || !endTime || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      toast.error('Please provide valid start and end dates');
      return;
    }

    this.submitting.set(true);

    // Strictly follow UpdateEventDto — no event_location_type, no event_type.
    // Only send the location fields the backend allows for this event's type.
    const dto: UpdateEventDto = {
      title:         v.title,
      description:   v.description,
      start_time:    startTime.toISOString(),
      end_time:      endTime.toISOString(),
      event_img_url: v.event_img_url || null,
      categoryId:    Number(v.categoryId),
      organizationId: org.id,
      // Online: only url; Offline: only city, region, name_of_place
      online_url:    this.isOnline() ? (v.online_url || null) : null,
      city:          this.isOnline() ? null : (v.city          || null),
      region:        this.isOnline() ? null : (v.region        || null),
      street:        null,  // not exposed in edit form
      name_of_place: this.isOnline() ? null : (v.name_of_place || null),
    };

    this.eventService.updateEvent(this.event().id, dto).subscribe({
      next: () => {
        toast.success('Event updated!');
        this.submitting.set(false);
        const newCatId    = Number(v.categoryId);
        const selectedCat = this.categories().find(c => c.id === newCatId) ?? null;
        const merged: EventModel = {
          ...this.event(),
          title:         v.title,
          description:   v.description,
          start_time:    startTime.toISOString(),
          end_time:      endTime.toISOString(),
          event_img_url: v.event_img_url || null,
          online_url:    this.isOnline() ? (v.online_url || null) : null,
          city:          this.isOnline() ? null : (v.city          || null),
          region:        this.isOnline() ? null : (v.region        || null),
          street:        null,
          nameOfPlace:   this.isOnline() ? null : (v.name_of_place || null),
          categoryId:    newCatId,
          category:      selectedCat,
          organizationId: org.id,
          // event_location_type and event_type are preserved from original event
        };
        this.updated.emit(merged);
      },
      error: err => {
        this.submitting.set(false);
        toast.error(err.error?.message || 'Failed to update event');
      },
    });
  }

  onClose() { this.close.emit(); }
}