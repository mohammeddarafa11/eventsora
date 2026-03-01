// src/app/features/events/events-page/events-page.ts
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
import { EventService } from '@core/services/event.service';
import { Event as EventModel, EventType } from '@core/models/event.model';
import { ZardIconComponent } from '@shared/components/icon/icon.component';
import { toast } from 'ngx-sonner';

import { CreateEventModalComponent } from '../modals/create-event-modal';
import { EditEventModalComponent } from '../modals/edit-event-modal';
import { ViewEventModalComponent } from '../modals/view-event-modal';
import {
  FilterEventsPipe,
  EventFilters,
  DEFAULT_FILTERS,
  EventTypeFilter,
  EventStatusFilter,
} from '../pipes/filter-events.pipe';

interface Category {
  id: number;
  name: string;
}

@Component({
  selector: 'app-events-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    ZardIconComponent,
    CreateEventModalComponent,
    EditEventModalComponent,
    ViewEventModalComponent,
    FilterEventsPipe,
  ],

  styles: [
    `
      @keyframes fade-up {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes shimmer {
        from {
          background-position: -600px 0;
        }
        to {
          background-position: 600px 0;
        }
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .page-enter {
        animation: fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .card-enter {
        animation: fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .dropdown-in {
        animation: fade-up 0.15s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .spin {
        animation: spin 0.8s linear infinite;
      }

      /* ── Skeleton ── */
      .skeleton-light {
        background: linear-gradient(
          90deg,
          #f1f5f9 25%,
          #e2e8f0 50%,
          #f1f5f9 75%
        );
        background-size: 1200px 100%;
        animation: shimmer 1.5s ease-in-out infinite;
      }
      .skeleton-dark {
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.04) 25%,
          rgba(255, 255, 255, 0.08) 50%,
          rgba(255, 255, 255, 0.04) 75%
        );
        background-size: 1200px 100%;
        animation: shimmer 1.5s ease-in-out infinite;
      }

      /* ── Event card ── */
      .event-card {
        transition:
          transform 0.2s ease,
          border-color 0.2s,
          box-shadow 0.2s;
        cursor: pointer;
      }
      .event-card:hover {
        transform: translateY(-2px);
      }

      :host-context(.dark) .event-card:hover {
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      }
      :host-context(:not(.dark)) .event-card:hover {
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.1);
      }

      /* ── Stat card ── */
      .stat-card {
        transition:
          transform 0.2s ease,
          box-shadow 0.2s;
      }
      .stat-card:hover {
        transform: translateY(-2px);
      }

      /* ── Filter pill ── */
      .fp-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
        transition: all 0.15s ease;
        border: 1px solid var(--border);
        background: var(--muted);
        color: var(--muted-foreground);
      }
      .fp-btn:hover {
        opacity: 0.8;
      }
      .fp-btn.is-active {
        border-color: rgba(245, 158, 11, 0.4);
        background: rgba(245, 158, 11, 0.08);
        color: #f59e0b;
        font-weight: 600;
      }
      .fp-btn.is-open {
        border-color: #f59e0b;
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12);
      }
      .fp-chevron {
        width: 13px;
        height: 13px;
        opacity: 0.4;
        flex-shrink: 0;
        transition:
          transform 0.2s,
          opacity 0.15s;
      }
      .fp-btn.is-open .fp-chevron {
        transform: rotate(180deg);
        opacity: 0.8;
      }

      /* ── Dropdown ── */
      .fp-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        z-index: 100;
        min-width: 180px;
        padding: 5px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--popover);
        color: var(--popover-foreground);
        box-shadow:
          0 12px 40px rgba(0, 0, 0, 0.2),
          0 1px 4px rgba(0, 0, 0, 0.1);
      }
      :host-context(.dark) .fp-dropdown {
        box-shadow:
          0 12px 40px rgba(0, 0, 0, 0.6),
          0 1px 4px rgba(0, 0, 0, 0.3);
      }
      .fp-option {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        border-radius: 10px;
        border: none;
        background: transparent;
        color: var(--muted-foreground);
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition:
          background 0.1s,
          color 0.1s;
      }
      .fp-option:hover {
        background: var(--accent);
        color: var(--accent-foreground);
      }
      .fp-option.selected {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
        font-weight: 600;
      }
      .fp-check {
        width: 13px;
        height: 13px;
        margin-left: auto;
        flex-shrink: 0;
        color: #f59e0b;
      }
      .fp-sep {
        height: 1px;
        margin: 4px 2px;
        background: var(--border);
      }

      /* ── Date pill ── */
      .fp-date-pill {
        position: relative;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 999px;
        overflow: hidden;
        border: 1px solid var(--border);
        background: var(--muted);
        color: var(--muted-foreground);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
        transition: all 0.15s ease;
      }
      .fp-date-pill:hover {
        opacity: 0.8;
      }
      .fp-date-pill.is-active {
        border-color: rgba(245, 158, 11, 0.4);
        background: rgba(245, 158, 11, 0.08);
        color: #f59e0b;
        font-weight: 600;
      }
      .fp-date-pill input[type='date'] {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        border: none;
        background: none;
        -webkit-appearance: none;
      }

      /* ── Search ── */
      .search-input {
        width: 100%;
        background: var(--muted) !important;
        border: 1px solid var(--border) !important;
        border-radius: 999px;
        padding: 10px 44px 10px 18px;
        color: var(--foreground) !important;
        font-size: 13.5px;
        outline: none !important;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .search-input::placeholder {
        color: var(--muted-foreground) !important;
        opacity: 0.6;
      }
      .search-input:focus {
        border-color: rgba(245, 158, 11, 0.5) !important;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1) !important;
      }

      /* ── 3-dot menu ── */
      .dots-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        width: 28px;
        height: 28px;
        border-radius: 9px;
        border: none;
        background: transparent;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.15s;
      }
      .dots-btn:hover {
        background: var(--accent);
      }
      .dots-btn .d {
        display: block;
        width: 3.5px;
        height: 3.5px;
        border-radius: 999px;
        background: var(--muted-foreground);
      }
      .dots-btn:hover .d {
        background: var(--foreground);
      }

      .ctx-menu {
        position: absolute;
        right: 0;
        top: calc(100% + 6px);
        z-index: 50;
        min-width: 168px;
        padding: 5px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: var(--popover);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
      }
      :host-context(.dark) .ctx-menu {
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
      }
      .ctx-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        border-radius: 9px;
        border: none;
        background: transparent;
        color: var(--muted-foreground);
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition:
          background 0.1s,
          color 0.1s;
      }
      .ctx-item:hover {
        background: var(--accent);
        color: var(--accent-foreground);
      }
      .ctx-item.danger:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #f87171;
      }
      .ctx-sep {
        height: 1px;
        margin: 4px 2px;
        background: var(--border);
      }

      ::-webkit-scrollbar {
        width: 3px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 99px;
      }
    `,
  ],

  template: `
    <div class="w-full min-h-full bg-background text-foreground">
      <div class="w-full px-4 sm:px-6 lg:px-8 py-8 page-enter space-y-8">
        <!-- ════════ HEADER ════════ -->
        <div
          class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <div
                class="w-6 h-6 rounded-md flex items-center justify-center bg-primary shrink-0"
              >
                <div
                  z-icon
                  zType="calendar"
                  class="w-3.5 h-3.5 text-primary-foreground"
                ></div>
              </div>
              <span
                class="text-xs font-semibold tracking-widest uppercase text-muted-foreground"
              >
                Event Management
              </span>
            </div>
            <h1 class="text-3xl font-bold tracking-tight text-foreground">
              Events
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed max-w-sm">
              Manage all your organization's events — publish, edit, and track
              performance.
            </p>
          </div>
          <button
            (click)="openCreateModal()"
            z-button
            zType="default"
            class="flex items-center gap-2 shrink-0"
          >
            <div z-icon zType="plus" class="w-4 h-4"></div>
            Create Event
          </button>
        </div>

        <!-- ════════ STAT CARDS ════════ -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          @for (stat of statsCards(); track stat.label; let i = $index) {
            <div
              class="stat-card card-enter rounded-2xl border border-border bg-card p-5
                 flex items-center justify-between"
              [style]="'animation-delay:' + i * 60 + 'ms'"
            >
              <div class="space-y-1">
                <p
                  class="text-xs font-semibold tracking-widest uppercase text-muted-foreground"
                >
                  {{ stat.label }}
                </p>
                <p class="text-4xl font-bold tracking-tight text-foreground">
                  {{ stat.value }}
                </p>
              </div>
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                [style]="'background:' + stat.bgColor"
              >
                <svg
                  class="w-5 h-5"
                  [style.color]="stat.color"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    [attr.d]="stat.path"
                  />
                </svg>
              </div>
            </div>
          }
        </div>

        <!-- ════════ FILTER BAR ════════ -->
        @if (!loading() && events().length > 0) {
          <div
            class="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5 space-y-4"
            (click)="$event.stopPropagation()"
          >
            <!-- Search -->
            <div class="relative flex items-center">
              <input
                class="search-input"
                type="text"
                placeholder="Search events by title or description…"
                [value]="filters().search"
                (input)="setSearch($event)"
              />
              <div
                z-icon
                zType="search"
                class="absolute right-4 w-4 h-4 pointer-events-none text-muted-foreground"
              ></div>
            </div>

            <!-- Pills row -->
            <div class="flex flex-wrap items-center gap-2">
              <!-- From date -->
              <div
                class="fp-date-pill"
                [class.is-active]="!!dateFrom()"
                (click)="openNativeDatePicker(fromInput)"
              >
                <div z-icon zType="calendar" class="w-3.5 h-3.5 shrink-0"></div>
                <span>{{
                  dateFrom() ? formatDateLabel(dateFrom()!) : 'From'
                }}</span>
                <input
                  #fromInput
                  type="date"
                  [value]="dateFrom() ?? ''"
                  (change)="onDateFromChange($event)"
                />
              </div>

              <!-- To date -->
              <div
                class="fp-date-pill"
                [class.is-active]="!!dateTo()"
                (click)="openNativeDatePicker(toInput)"
              >
                <div z-icon zType="calendar" class="w-3.5 h-3.5 shrink-0"></div>
                <span>{{
                  dateTo() ? formatDateLabel(dateTo()!) : 'Until'
                }}</span>
                <input
                  #toInput
                  type="date"
                  [value]="dateTo() ?? ''"
                  [min]="dateFrom() ?? ''"
                  (change)="onDateToChange($event)"
                />
              </div>

              <!-- Status -->
              <div class="relative">
                <button
                  class="fp-btn"
                  [class.is-active]="filters().status !== 'all'"
                  [class.is-open]="openFilterId() === 'status'"
                  (click)="toggleFilter('status')"
                >
                  <div z-icon zType="clock" class="w-3.5 h-3.5 shrink-0"></div>
                  {{ statusLabel() }}
                  <svg
                    class="fp-chevron"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                @if (openFilterId() === 'status') {
                  <div class="fp-dropdown dropdown-in">
                    @for (opt of statusOptions; track opt.value) {
                      <button
                        class="fp-option"
                        [class.selected]="filters().status === opt.value"
                        (click)="setStatus(opt.value); closeFilter()"
                      >
                        {{ opt.label }}
                        @if (filters().status === opt.value) {
                          <svg
                            class="fp-check"
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
                        }
                      </button>
                    }
                  </div>
                }
              </div>

              <!-- Type -->
              <div class="relative">
                <button
                  class="fp-btn"
                  [class.is-active]="filters().eventType !== 'all'"
                  [class.is-open]="openFilterId() === 'type'"
                  (click)="toggleFilter('type')"
                >
                  <div z-icon zType="layers" class="w-3.5 h-3.5 shrink-0"></div>
                  {{ typeLabel() }}
                  <svg
                    class="fp-chevron"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                @if (openFilterId() === 'type') {
                  <div class="fp-dropdown dropdown-in">
                    @for (opt of typeOptions; track opt.value) {
                      <button
                        class="fp-option"
                        [class.selected]="filters().eventType === opt.value"
                        (click)="setEventType(opt.value); closeFilter()"
                      >
                        {{ opt.label }}
                        @if (filters().eventType === opt.value) {
                          <svg
                            class="fp-check"
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
                        }
                      </button>
                    }
                  </div>
                }
              </div>

              <!-- Category -->
              @if (availableCategories().length > 0) {
                <div class="relative">
                  <button
                    class="fp-btn"
                    [class.is-active]="filters().categoryId !== null"
                    [class.is-open]="openFilterId() === 'category'"
                    (click)="toggleFilter('category')"
                  >
                    <div z-icon zType="tag" class="w-3.5 h-3.5 shrink-0"></div>
                    {{ categoryLabel() }}
                    <svg
                      class="fp-chevron"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  @if (openFilterId() === 'category') {
                    <div class="fp-dropdown dropdown-in">
                      <button
                        class="fp-option"
                        [class.selected]="filters().categoryId === null"
                        (click)="setCategory(''); closeFilter()"
                      >
                        All Categories
                        @if (filters().categoryId === null) {
                          <svg
                            class="fp-check"
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
                        }
                      </button>
                      <div class="fp-sep"></div>
                      @for (cat of availableCategories(); track cat.id) {
                        <button
                          class="fp-option"
                          [class.selected]="filters().categoryId === cat.id"
                          (click)="
                            setCategory(cat.id.toString()); closeFilter()
                          "
                        >
                          {{ cat.name }}
                          @if (filters().categoryId === cat.id) {
                            <svg
                              class="fp-check"
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
                          }
                        </button>
                      }
                    </div>
                  }
                </div>
              }

              <!-- Clear all -->
              @if (hasActiveFilters()) {
                <button
                  (click)="clearFilters()"
                  class="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium
                     text-muted-foreground border border-border
                     hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5
                     transition-all"
                >
                  <div z-icon zType="x" class="w-3.5 h-3.5"></div>
                  Clear all
                </button>
              }
            </div>

            <!-- Results summary -->
            @if (hasActiveFilters()) {
              <p
                class="text-xs text-muted-foreground pt-3 border-t border-border"
              >
                Showing
                <span class="text-foreground font-semibold">{{
                  filteredEvents().length
                }}</span>
                of
                <span class="text-foreground font-semibold">{{
                  events().length
                }}</span>
                events
              </p>
            }
          </div>
        }

        <!-- ════════ LOADING ════════ -->
        @if (loading()) {
          <div class="space-y-3">
            @for (i of [1, 2, 3, 4]; track i) {
              <div
                class="rounded-2xl h-32 border border-border"
                [class]="isDark ? 'skeleton-dark' : 'skeleton-light'"
                [style]="'animation-delay:' + i * 80 + 'ms'"
              ></div>
            }
          </div>

          <!-- ════════ EMPTY — NO EVENTS ════════ -->
        } @else if (events().length === 0) {
          <div
            class="flex flex-col items-center justify-center py-24 text-center space-y-5
                  rounded-2xl border border-dashed border-border bg-muted/30"
          >
            <div
              class="w-20 h-20 rounded-2xl flex items-center justify-center
                    border border-border bg-background shadow-sm"
            >
              <div
                z-icon
                zType="calendar"
                class="w-9 h-9 text-muted-foreground"
              ></div>
            </div>
            <div class="space-y-1.5">
              <h3 class="text-lg font-bold text-foreground">No events yet</h3>
              <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Create your first event to start selling tickets and engaging
                your audience.
              </p>
            </div>
            <button
              z-button
              zType="default"
              (click)="openCreateModal()"
              class="flex items-center gap-2"
            >
              <div z-icon zType="plus" class="w-4 h-4"></div>
              Create First Event
            </button>
          </div>

          <!-- ════════ EMPTY — FILTERED ════════ -->
        } @else if (filteredEvents().length === 0) {
          <div
            class="flex flex-col items-center justify-center py-20 text-center space-y-4
                  rounded-2xl border border-dashed border-border bg-muted/30"
          >
            <div
              class="w-16 h-16 rounded-2xl flex items-center justify-center
                    border border-border bg-background shadow-sm"
            >
              <div
                z-icon
                zType="search"
                class="w-8 h-8 text-muted-foreground"
              ></div>
            </div>
            <div class="space-y-1">
              <h3 class="text-base font-bold text-foreground">
                No events match
              </h3>
              <p class="text-sm text-muted-foreground">
                Try adjusting or clearing your filters.
              </p>
            </div>
            <button
              (click)="clearFilters()"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                 text-foreground border border-border hover:bg-muted transition-all"
            >
              <div z-icon zType="x" class="w-3.5 h-3.5"></div>
              Clear Filters
            </button>
          </div>

          <!-- ════════ EVENT LIST ════════ -->
        } @else {
          <div class="space-y-3">
            @for (event of filteredEvents(); track event.id; let i = $index) {
              <div
                class="event-card card-enter rounded-2xl border border-border bg-card"
                [style.animation-delay]="i * 40 + 'ms'"
                (click)="openViewModal(event)"
              >
                <div class="flex flex-col sm:flex-row">
                  <!-- Thumbnail -->
                  <div
                    class="sm:w-40 sm:shrink-0 sm:m-3 rounded-xl overflow-hidden"
                  >
                    @if (event.event_img_url) {
                      <img
                        [src]="event.event_img_url"
                        [alt]="event.title"
                        class="w-full h-40 sm:h-full object-cover"
                        (error)="onImageError($event)"
                      />
                    } @else {
                      <div
                        class="w-full h-40 sm:h-full flex items-center justify-center relative overflow-hidden"
                        [style]="'background:' + getEventGradient(event)"
                      >
                        <div
                          class="absolute inset-0 opacity-10"
                          style="background:repeating-linear-gradient(45deg,transparent,transparent 6px,rgba(255,255,255,.06) 6px,rgba(255,255,255,.06) 12px)"
                        ></div>
                        <div
                          z-icon
                          zType="calendar"
                          class="w-10 h-10 relative z-10 opacity-30 text-white"
                        ></div>
                      </div>
                    }
                  </div>

                  <!-- Content -->
                  <div
                    class="flex-1 p-4 sm:py-4 sm:pr-4 sm:pl-1 min-w-0 flex flex-col justify-between gap-3"
                  >
                    <!-- Top: badges + menu -->
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <!-- Status badge -->
                        @if (isUpcoming(event)) {
                          <span
                            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style="background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.2)"
                          >
                            <span
                              class="w-1 h-1 rounded-full bg-emerald-400"
                            ></span>
                            Upcoming
                          </span>
                        } @else {
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-bold
                                   bg-muted text-muted-foreground border border-border"
                          >
                            Ended
                          </span>
                        }

                        <!-- Type badge -->
                        @if (event.event_type === EventType.Online) {
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style="background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.2)"
                          >
                            Online
                          </span>
                        } @else {
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style="background:rgba(99,102,241,.1);color:#a5b4fc;border:1px solid rgba(99,102,241,.2)"
                          >
                            In-Person
                          </span>
                        }

                        <!-- Category -->
                        @if (event.category?.name) {
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-medium
                                   bg-muted text-muted-foreground border border-border"
                          >
                            {{ event.category.name }}
                          </span>
                        }
                      </div>

                      <!-- 3-dot menu -->
                      <div
                        class="relative self-start shrink-0"
                        (click)="$event.stopPropagation()"
                      >
                        <button class="dots-btn" (click)="toggleMenu(event.id)">
                          <span class="d"></span><span class="d"></span
                          ><span class="d"></span>
                        </button>
                        @if (openMenuId() === event.id) {
                          <div class="ctx-menu dropdown-in">
                            <button
                              class="ctx-item"
                              (click)="openViewModal(event); closeMenu()"
                            >
                              <div
                                z-icon
                                zType="eye"
                                class="w-4 h-4 shrink-0"
                              ></div>
                              View Details
                            </button>
                            <button
                              class="ctx-item"
                              (click)="openEditModal(event)"
                            >
                              <div
                                z-icon
                                zType="pencil"
                                class="w-4 h-4 shrink-0"
                              ></div>
                              Edit Event
                            </button>
                            <div class="ctx-sep"></div>
                            <button
                              class="ctx-item danger"
                              (click)="deleteEvent(event)"
                            >
                              <div
                                z-icon
                                zType="trash"
                                class="w-4 h-4 shrink-0"
                              ></div>
                              Delete Event
                            </button>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Title + Description -->
                    <div>
                      <h3
                        class="font-bold text-foreground text-[15px] leading-snug line-clamp-1 mb-1"
                      >
                        {{ event.title }}
                      </h3>
                      <p
                        class="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed"
                      >
                        {{ event.description }}
                      </p>
                    </div>

                    <!-- Meta row -->
                    <div
                      class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground"
                    >
                      <span class="flex items-center gap-1.5">
                        <div
                          z-icon
                          zType="calendar"
                          class="w-3.5 h-3.5 shrink-0"
                        ></div>
                        {{ event.start_time | date: 'MMM d, y · h:mm a' }}
                      </span>
                      <span class="flex items-center gap-1.5">
                        <div
                          z-icon
                          zType="map-pin"
                          class="w-3.5 h-3.5 shrink-0"
                        ></div>
                        @if (event.event_type === EventType.Online) {
                          Online
                        } @else {
                          {{ event.city }}
                          @if (event.region) {
                            , {{ event.region }}
                          }
                        }
                      </span>
                      @if (event.organization?.name) {
                        <span class="flex items-center gap-1.5">
                          <div
                            z-icon
                            zType="briefcase"
                            class="w-3.5 h-3.5 shrink-0"
                          ></div>
                          {{ event.organization.name }}
                        </span>
                      }
                    </div>
                  </div>
                </div>

                <!-- Upcoming accent bar -->
                @if (isUpcoming(event)) {
                  <div
                    class="h-px mx-4"
                    style="background:linear-gradient(to right,rgba(16,185,129,.4),transparent)"
                  ></div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- ════════ MODALS ════════ -->
    @if (showCreateModal()) {
      <app-create-event-modal
        (created)="onEventCreated()"
        (close)="showCreateModal.set(false)"
      />
    }
    @if (showEditModal() && selectedEvent()) {
      <app-edit-event-modal
        [event]="selectedEvent()!"
        (updated)="onEventUpdated($event)"
        (close)="showEditModal.set(false)"
      />
    }
    @if (showViewModal() && selectedEvent()) {
      <app-view-event-modal
        [event]="selectedEvent()!"
        (edit)="switchToEdit()"
        (close)="showViewModal.set(false)"
      />
    }
  `,
})
export class EventsPageComponent implements OnInit {
  private eventService = inject(EventService);
  private filterPipe = new FilterEventsPipe();

  // ─── State ────────────────────────────────────────────────────────────────
  events = signal<EventModel[]>([]);
  loading = signal(false);
  filters = signal<EventFilters>({ ...DEFAULT_FILTERS });
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);
  showCreateModal = signal(false);
  showEditModal = signal(false);
  showViewModal = signal(false);
  selectedEvent = signal<EventModel | null>(null);
  openMenuId = signal<number | null>(null);
  openFilterId = signal<string | null>(null);

  readonly EventType = EventType;

  get isDark(): boolean {
    return document.documentElement.classList.contains('dark');
  }

  // ─── Filter options ───────────────────────────────────────────────────────
  readonly statusOptions: { value: EventStatusFilter; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past', label: 'Past' },
  ];
  readonly typeOptions: { value: EventTypeFilter; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'online', label: 'Online' },
    { value: 'inperson', label: 'In-Person' },
  ];

  // ─── Computed ─────────────────────────────────────────────────────────────
  filteredEvents = computed(() => {
    const f: EventFilters = {
      ...this.filters(),
      dateFrom: this.dateFrom()
        ? new Date(this.dateFrom()! + 'T00:00:00')
        : null,
      dateTo: this.dateTo() ? new Date(this.dateTo()! + 'T23:59:59') : null,
    };
    return this.filterPipe.transform(this.events(), f);
  });

  statsCards = computed(() => {
    const now = new Date();
    const all = this.events();
    const up = all.filter((e) => new Date(e.start_time) > now).length;
    const past = all.filter((e) => new Date(e.start_time) <= now).length;
    return [
      {
        label: 'Total Events',
        value: all.length,
        color: '#a5b4fc',
        bgColor: 'rgba(99,102,241,.12)',
        path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      },
      {
        label: 'Upcoming',
        value: up,
        color: '#10b981',
        bgColor: 'rgba(16,185,129,.12)',
        path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      },
      {
        label: 'Past Events',
        value: past,
        color: '#f59e0b',
        bgColor: 'rgba(245,158,11,.12)',
        path: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
      },
    ];
  });

  statusLabel = computed(
    () =>
      this.statusOptions.find((o) => o.value === this.filters().status)
        ?.label ?? 'All Status',
  );
  typeLabel = computed(
    () =>
      this.typeOptions.find((o) => o.value === this.filters().eventType)
        ?.label ?? 'All Types',
  );
  categoryLabel = computed(() => {
    const id = this.filters().categoryId;
    return id === null
      ? 'Category'
      : (this.availableCategories().find((c) => c.id === id)?.name ??
          'Category');
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
    return (
      f.search.trim() !== '' ||
      f.eventType !== 'all' ||
      f.status !== 'all' ||
      f.categoryId !== null ||
      !!this.dateFrom() ||
      !!this.dateTo()
    );
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadEvents();
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.openMenuId() !== null) this.openMenuId.set(null);
    if (this.openFilterId() !== null) this.openFilterId.set(null);
  }

  // ─── Filters ──────────────────────────────────────────────────────────────
  toggleFilter(id: string) {
    this.openFilterId.set(this.openFilterId() === id ? null : id);
  }
  closeFilter() {
    this.openFilterId.set(null);
  }
  closeMenu() {
    this.openMenuId.set(null);
  }

  setSearch(e: Event) {
    this.filters.update((f) => ({
      ...f,
      search: (e.target as HTMLInputElement).value,
    }));
  }
  setEventType(t: EventTypeFilter) {
    this.filters.update((f) => ({ ...f, eventType: t }));
  }
  setStatus(s: EventStatusFilter) {
    this.filters.update((f) => ({ ...f, status: s }));
  }
  setCategory(v: string) {
    this.filters.update((f) => ({ ...f, categoryId: v ? Number(v) : null }));
  }
  onDateFromChange(e: Event) {
    this.dateFrom.set((e.target as HTMLInputElement).value || null);
  }
  onDateToChange(e: Event) {
    this.dateTo.set((e.target as HTMLInputElement).value || null);
  }
  clearFilters() {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.dateFrom.set(null);
    this.dateTo.set(null);
  }

  formatDateLabel(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
  openNativeDatePicker(input: HTMLInputElement | null) {
    if (!input) return;
    const a = input as any;
    typeof a.showPicker === 'function'
      ? a.showPicker()
      : (input.focus(), input.click());
  }

  // ─── Data ─────────────────────────────────────────────────────────────────
  private loadEvents() {
    this.loading.set(true);
    this.eventService.getAllEvents().subscribe({
      next: (d) => {
        this.events.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ─── Modals ───────────────────────────────────────────────────────────────
  openCreateModal() {
    this.showCreateModal.set(true);
  }
  openViewModal(e: EventModel) {
    this.openMenuId.set(null);
    this.selectedEvent.set(e);
    this.showViewModal.set(true);
  }
  openEditModal(e: EventModel) {
    this.openMenuId.set(null);
    this.selectedEvent.set(e);
    this.showViewModal.set(false);
    this.showEditModal.set(true);
  }
  switchToEdit() {
    this.showViewModal.set(false);
    this.showEditModal.set(true);
  }
  onEventCreated() {
    this.showCreateModal.set(false);
    this.loadEvents();
  }
  onEventUpdated(u: EventModel) {
    this.showEditModal.set(false);
    this.events.update((l) => l.map((e) => (e.id === u.id ? u : e)));
    this.selectedEvent.set(u);
  }

  deleteEvent(event: EventModel) {
    this.openMenuId.set(null);
    if (!confirm(`Delete "${event.title}"?\n\nThis action cannot be undone.`))
      return;
    this.eventService.deleteEvent(event.id).subscribe({
      next: () => {
        this.events.update((l) => l.filter((e) => e.id !== event.id));
        toast.success('Event deleted');
      },
      error: () => toast.error('Failed to delete event'),
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  toggleMenu(id: number) {
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }
  isUpcoming(e: EventModel) {
    return new Date(e.start_time) > new Date();
  }
  onImageError(e: Event) {
    (e.target as HTMLImageElement).style.display = 'none';
  }

  getEventGradient(e: EventModel): string {
    const gradients = [
      'linear-gradient(135deg,#1a1a2e,#16213e)',
      'linear-gradient(135deg,#1a0a00,#2d1500)',
      'linear-gradient(135deg,#0a0a1a,#1a0a2e)',
      'linear-gradient(135deg,#001a0a,#002d16)',
      'linear-gradient(135deg,#1a0f00,#2d1a00)',
    ];
    return gradients[e.id % gradients.length];
  }
}
