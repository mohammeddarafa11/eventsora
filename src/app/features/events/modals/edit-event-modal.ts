// src/app/features/events/modals/edit-event-modal.ts
import {
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { toast } from 'ngx-sonner';

import { EventService } from '@core/services/event.service';
import { CategoryService, Category } from '@core/services/category';
import { AuthService } from '@core/services/auth.service';
import {
  Event as EventModel,
  EventType,
  UpdateEventDto,
} from '@core/models/event.model';

@Component({
  selector: 'app-edit-event-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],

  styles: [
    `
      @keyframes modal-in {
        from {
          opacity: 0;
          transform: scale(0.97) translateY(10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      .modal-enter {
        animation: modal-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      /* Field style — matches create modal */
      .field-line {
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        transition: border-color 0.2s;
      }
      .field-line:focus-within {
        border-color: #f59e0b;
      }

      input,
      textarea,
      select {
        background: transparent !important;
        outline: none !important;
        box-shadow: none !important;
        border: none !important;
        color: #f4f4f5 !important;
        width: 100%;
        padding: 0 !important;
        font-size: 14px !important;
        font-family: inherit;
      }
      input::placeholder,
      textarea::placeholder {
        color: rgba(255, 255, 255, 0.2) !important;
      }
      select option {
        background: #18181b;
      }
      textarea {
        resize: none;
      }
      input[type='datetime-local']::-webkit-calendar-picker-indicator {
        filter: invert(0.4);
        cursor: pointer;
      }

      /* Thin scrollbar */
      .thin-scroll::-webkit-scrollbar {
        width: 3px;
      }
      .thin-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      .thin-scroll::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 99px;
      }

      /* Spin */
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .spin {
        animation: spin 0.8s linear infinite;
      }
    `,
  ],

  template: `
    <!-- ░░  BACKDROP  ░░ -->
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      style="background:rgba(0,0,0,.75);backdrop-filter:blur(18px)"
      (click)="onClose()"
    >
      <!-- ░░  MODAL  ░░ -->
      <div
        class="modal-enter relative w-full sm:max-w-[640px] max-h-[96dvh] sm:max-h-[90vh]
            flex flex-col overflow-hidden
            rounded-t-3xl sm:rounded-3xl
            border border-white/[.07]
            shadow-[0_32px_80px_rgba(0,0,0,.7)]"
        style="background:#0f0f11;color:#f4f4f5"
        (click)="$event.stopPropagation()"
      >
        <!-- ── Header ── -->
        <div
          class="shrink-0 flex items-center justify-between px-6 py-5
              border-b border-white/[.05]"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center"
              style="background:linear-gradient(135deg,#f59e0b,#f97316)"
            >
              <svg
                class="w-4 h-4 text-zinc-900"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-[15px] font-bold text-white leading-tight">
                Edit Event
              </p>
              <p class="text-[12px] text-zinc-500 truncate max-w-[260px]">
                {{ event().title }}
              </p>
            </div>
          </div>

          <button
            (click)="onClose()"
            class="w-8 h-8 rounded-xl flex items-center justify-center
                   bg-white/[.05] hover:bg-white/[.09] text-zinc-400 hover:text-zinc-200
                   transition-all border border-white/[.05]"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- ── Loading state ── -->
        @if (loadingCategories()) {
          <div class="flex-1 flex items-center justify-center py-16">
            <svg
              class="w-8 h-8 text-amber-400 spin"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
        } @else if (eventForm) {
          <form
            [formGroup]="eventForm"
            (ngSubmit)="onSubmit()"
            class="flex flex-col flex-1 min-h-0"
          >
            <!-- ── Scrollable fields ── -->
            <div class="flex-1 overflow-y-auto thin-scroll px-6 py-5 space-y-6">
              <!-- Title -->
              <div class="space-y-1.5">
                <label
                  class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500"
                >
                  Event Title <span class="text-amber-400">*</span>
                </label>
                <div class="field-line pb-2.5">
                  <input
                    type="text"
                    formControlName="title"
                    class="text-[18px] font-bold"
                    style="font-size:18px !important;font-weight:700 !important"
                    placeholder="Event title…"
                  />
                </div>
                @if (f['title'].invalid && f['title'].touched) {
                  <p class="text-[11px] text-red-400">
                    Title is required (min 3 characters)
                  </p>
                }
              </div>

              <!-- Description -->
              <div class="space-y-1.5">
                <label
                  class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500"
                >
                  Description <span class="text-amber-400">*</span>
                </label>
                <div class="field-line pb-2">
                  <textarea
                    formControlName="description"
                    rows="3"
                    placeholder="What will attendees experience?"
                  ></textarea>
                </div>
                @if (f['description'].invalid && f['description'].touched) {
                  <p class="text-[11px] text-red-400">
                    Description is required
                  </p>
                }
              </div>

              <!-- Category + Type -->
              <div class="grid grid-cols-2 gap-5">
                <div class="space-y-1.5">
                  <label
                    class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500"
                  >
                    Category <span class="text-amber-400">*</span>
                  </label>
                  <div class="field-line pb-2">
                    <select formControlName="categoryId">
                      @for (cat of categories(); track cat.id) {
                        <option [value]="cat.id">{{ cat.name }}</option>
                      }
                    </select>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label
                    class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500"
                  >
                    Format
                  </label>
                  <div class="field-line pb-2">
                    <select formControlName="event_type">
                      <option [value]="0">🏛️ In-Person</option>
                      <option [value]="1">💻 Online</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Date & Time -->
              <div class="space-y-3">
                <label
                  class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500"
                >
                  Date & Time <span class="text-amber-400">*</span>
                </label>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <!-- Start -->
                  <div
                    class="flex items-center gap-4 p-4 rounded-2xl border border-white/[.06]"
                    style="background:rgba(255,255,255,.02)"
                  >
                    <div
                      class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style="background:rgba(245,158,11,.12)"
                    >
                      <svg
                        class="w-4 h-4 text-amber-400"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1"
                      >
                        Starts
                      </p>
                      <input
                        type="datetime-local"
                        formControlName="start_time"
                      />
                    </div>
                  </div>
                  <!-- End -->
                  <div
                    class="flex items-center gap-4 p-4 rounded-2xl border border-white/[.06]"
                    style="background:rgba(255,255,255,.02)"
                  >
                    <div
                      class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style="background:rgba(239,68,68,.1)"
                    >
                      <svg
                        class="w-4 h-4 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1"
                      >
                        Ends
                      </p>
                      <input type="datetime-local" formControlName="end_time" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Location -->
              <div class="space-y-3">
                <label
                  class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500"
                >
                  Location
                </label>

                @if (!isOnline()) {
                  <div
                    class="p-4 rounded-2xl border border-white/[.06] space-y-4"
                    style="background:rgba(255,255,255,.02)"
                  >
                    <div class="grid grid-cols-2 gap-x-5 gap-y-4">
                      <div class="space-y-1.5">
                        <p
                          class="text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
                        >
                          City <span class="text-amber-400">*</span>
                        </p>
                        <div class="field-line pb-2">
                          <input
                            type="text"
                            formControlName="city"
                            placeholder="Cairo"
                          />
                        </div>
                      </div>
                      <div class="space-y-1.5">
                        <p
                          class="text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
                        >
                          Region <span class="text-amber-400">*</span>
                        </p>
                        <div class="field-line pb-2">
                          <input
                            type="text"
                            formControlName="region"
                            placeholder="Greater Cairo"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                } @else {
                  <div
                    class="p-4 rounded-2xl border border-amber-400/20 flex items-start gap-4"
                    style="background:rgba(245,158,11,.04)"
                  >
                    <div
                      class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style="background:rgba(245,158,11,.12)"
                    >
                      <svg
                        class="w-4 h-4 text-amber-400"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0 space-y-1.5">
                      <p
                        class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500"
                      >
                        Meeting URL <span class="text-amber-400">*</span>
                      </p>
                      <div class="field-line pb-2">
                        <input
                          type="url"
                          formControlName="online_url"
                          placeholder="https://meet.google.com/…"
                        />
                      </div>
                      @if (f['online_url'].invalid && f['online_url'].touched) {
                        <p class="text-[11px] text-red-400">
                          Valid URL required
                        </p>
                      }
                    </div>
                  </div>
                }
              </div>

              <!-- Cover image -->
              <div class="space-y-1.5">
                <label
                  class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500"
                >
                  Cover Image URL
                </label>
                <div class="field-line pb-2.5 flex items-center gap-2">
                  <svg
                    class="w-4 h-4 text-zinc-600 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <input
                    type="url"
                    formControlName="event_img_url"
                    placeholder="https://your-image.com/cover.jpg"
                  />
                </div>
              </div>
            </div>

            <!-- ── Footer ── -->
            <div
              class="shrink-0 px-6 py-4 border-t border-white/[.05] flex items-center justify-between gap-3"
              style="background:rgba(15,15,17,.9);backdrop-filter:blur(8px)"
            >
              <button
                type="button"
                (click)="onClose()"
                [disabled]="submitting()"
                class="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-500
                       hover:text-zinc-300 hover:bg-white/[.05] border border-white/[.05]
                       transition-all duration-150 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="submitting()"
                class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold
                       text-zinc-900 hover:opacity-90 active:scale-[.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-[0_4px_20px_rgba(245,158,11,.25)]"
                style="background:linear-gradient(135deg,#f59e0b,#f97316)"
              >
                @if (submitting()) {
                  <svg
                    class="w-4 h-4 spin"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Saving…
                } @else {
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M5 13l4 4L19 7"
                    />
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
  event = input.required<EventModel>();
  updated = output<EventModel>();
  close = output<void>();

  private fb = inject(FormBuilder);
  private eventService = inject(EventService);
  private categoryService = inject(CategoryService);
  private authService = inject(AuthService);

  eventForm!: FormGroup;
  categories = signal<Category[]>([]);
  loadingCategories = signal(true);
  submitting = signal(false);
  isOnline = signal(false);

  get f() {
    return this.eventForm.controls;
  }

  ngOnInit() {
    this.initForm();
    this.loadCategories();
  }

  private initForm() {
    const e = this.event();
    this.isOnline.set(e.event_type === EventType.Online);
    this.eventForm = this.fb.group({
      title: [e.title, [Validators.required, Validators.minLength(3)]],
      description: [e.description, Validators.required],
      start_time: [this.toLocal(e.start_time), Validators.required],
      end_time: [this.toLocal(e.end_time), Validators.required],
      event_type: [e.event_type, Validators.required],
      categoryId: [e.categoryId, Validators.required],
      city: [e.city ?? ''],
      region: [e.region ?? ''],
      online_url: [e.online_url ?? ''],
      event_img_url: [e.event_img_url ?? ''],
    });

    this.eventForm.get('event_type')?.valueChanges.subscribe((v) => {
      this.isOnline.set(Number(v) === EventType.Online);
      this.updateValidators();
    });
    this.updateValidators();
  }

  private toLocal(d: string): string {
    const dt = new Date(d);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
  }

  private updateValidators() {
    const c = this.eventForm.get('city')!;
    const r = this.eventForm.get('region')!;
    const u = this.eventForm.get('online_url')!;
    if (this.isOnline()) {
      c.clearValidators();
      r.clearValidators();
      u.setValidators([
        Validators.required,
        Validators.pattern(/^https?:\/\/.+/),
      ]);
    } else {
      c.setValidators(Validators.required);
      r.setValidators(Validators.required);
      u.clearValidators();
    }
    [c, r, u].forEach((ctrl) => ctrl.updateValueAndValidity());
  }

  private loadCategories() {
    this.categoryService.getAllCategories().subscribe({
      next: (d) => {
        this.categories.set(d);
        this.loadingCategories.set(false);
      },
      error: () => {
        toast.error('Failed to load categories');
        this.loadingCategories.set(false);
      },
    });
  }

  onSubmit() {
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      toast.error('Please fill in all required fields');
      return;
    }
    const org = this.authService.getOrganization();
    if (!org) {
      toast.error('Organization not found');
      return;
    }

    this.submitting.set(true);
    const v = this.eventForm.value;
    const newCategoryId = Number(v.categoryId);

    const dto: UpdateEventDto = {
      title: v.title,
      description: v.description,
      event_img_url: v.event_img_url || '',
      start_time: new Date(v.start_time).toISOString(),
      end_time: new Date(v.end_time).toISOString(),
      event_type: Number(v.event_type),
      city: v.city || '',
      region: v.region || '',
      online_url: v.online_url || '',
      categoryId: newCategoryId,
      organizationId: org.id,
    };

    this.eventService.updateEvent(this.event().id, dto).subscribe({
      next: () => {
        toast.success('Event updated!');
        this.submitting.set(false);
        const selectedCat =
          this.categories().find((c) => c.id === newCategoryId) ?? null;
        const merged: EventModel = {
          ...this.event(),
          title: v.title,
          description: v.description,
          event_img_url: v.event_img_url || null,
          start_time: new Date(v.start_time).toISOString(),
          end_time: new Date(v.end_time).toISOString(),
          event_type: Number(v.event_type),
          city: v.city || null,
          region: v.region || null,
          online_url: v.online_url || null,
          categoryId: newCategoryId,
          category: selectedCat,
          organizationId: org.id,
        };
        this.updated.emit(merged);
      },
      error: (err) => {
        this.submitting.set(false);
        toast.error(err?.error?.message || 'Failed to update event');
      },
    });
  }

  onClose() {
    this.close.emit();
  }
}
