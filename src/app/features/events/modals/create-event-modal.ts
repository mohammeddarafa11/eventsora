// src/app/features/events/create-event-modal/create-event-modal.component.ts
import {
  Component, computed, inject, OnInit, output, signal, ChangeDetectionStrategy,
} from '@angular/core';
import {
  FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toast } from 'ngx-sonner';

import { CategoryService, Category }   from '@core/services/category';
import { AuthService }                  from '@core/services/auth.service';
import {
  TicketService, TicketTemplate, CreateEventWithTicketsDto,
} from '@core/services/ticket.service';

import { ZardIconComponent } from '@shared/components/icon/icon.component';

// ─── step config ────────────────────────────────────────────────────────────
const TOTAL_STEPS = 3;

@Component({
  selector:    'app-create-event-modal',
  standalone:  true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPipe, ReactiveFormsModule, RouterLink, ZardIconComponent],

  // ─── ALL STYLES INLINED — only Tailwind utilities ─────────────────────────
  styles: [`
    @keyframes modal-in {
      from { opacity: 0; transform: scale(.96) translateY(12px) }
      to   { opacity: 1; transform: scale(1)   translateY(0) }
    }
    @keyframes step-in {
      from { opacity: 0; transform: translateX(20px) }
      to   { opacity: 1; transform: translateX(0) }
    }
    @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }

    .modal-enter  { animation: modal-in .32s cubic-bezier(.22,1,.36,1) both }
    .step-animate { animation: step-in  .24s cubic-bezier(.22,1,.36,1) both }
    .fade-in      { animation: fade-in  .2s ease both }

    /* Floating label fields */
    .field-line {
      border-bottom: 1px solid rgba(255,255,255,.1);
      transition: border-color .2s;
    }
    .field-line:focus-within { border-color: #f59e0b; }

    input, textarea, select {
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
    input::placeholder, textarea::placeholder {
      color: rgba(255,255,255,.22) !important;
    }
    select option { background: #18181b; }
    textarea { resize: none; }
    input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(.4); cursor: pointer; }

    /* Ticket card hover */
    .ticket-card { transition: background .15s, border-color .15s, transform .15s; }
    .ticket-card:hover { transform: translateY(-1px); }

    /* Scrollbar */
    .thin-scroll::-webkit-scrollbar { width: 3px; }
    .thin-scroll::-webkit-scrollbar-track { background: transparent; }
    .thin-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 99px; }

    /* Tier accent lines */
    .tier-standard { border-left: 3px solid #10b981; }
    .tier-vip      { border-left: 3px solid #f59e0b; }
    .tier-premium  { border-left: 3px solid #8b5cf6; }
  `],

  template: `
<!-- ░░░░░░░░░░░░░░░░  BACKDROP  ░░░░░░░░░░░░░░░░ -->
<div
  class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
  style="background:rgba(0,0,0,.72); backdrop-filter:blur(16px)"
  (click)="onClose()"
>

<!-- ░░░░░░░░░░░░░░░░  MODAL PANEL  ░░░░░░░░░░░░░░░░ -->
<div
  class="modal-enter relative w-full sm:max-w-[900px]
         flex flex-col sm:flex-row
         bg-zinc-950 text-zinc-100
         rounded-t-3xl sm:rounded-3xl
         border border-white/[.06]
         shadow-[0_32px_80px_rgba(0,0,0,.6)]
         overflow-hidden
         max-h-[96dvh] sm:max-h-[88vh]"
  (click)="$event.stopPropagation()"
>

  <!-- ═══════════════════════════════════════════════
       LEFT PANEL — Live Preview (desktop only)
  ═══════════════════════════════════════════════════ -->
  <div class="hidden sm:flex flex-col w-[320px] shrink-0 relative overflow-hidden"
       style="background: linear-gradient(160deg, #18181b 0%, #0f0f11 100%)">

    <!-- Ambient glow -->
    <div class="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-20 pointer-events-none"
         style="background: radial-gradient(circle, #f59e0b 0%, transparent 70%)"></div>

    <!-- Header -->
    <div class="relative z-10 px-7 pt-8 pb-0">
      <div class="flex items-center gap-2.5 mb-8">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center"
             style="background: linear-gradient(135deg, #f59e0b, #ef4444)">
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
        <span class="text-xs font-semibold tracking-[.12em] uppercase text-zinc-500">New Event</span>
      </div>

      <!-- Step label -->
      <p class="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-1">
        Step {{ currentStep() }} of {{ totalSteps }}
      </p>
      <h2 class="text-xl font-bold text-white mb-1">{{ stepTitle() }}</h2>
      <p class="text-[13px] text-zinc-500 leading-relaxed">{{ stepDescription() }}</p>
    </div>

    <!-- Progress steps -->
    <div class="relative z-10 px-7 mt-8 space-y-1">
      @for (s of stepMeta; track s.step) {
        <div class="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-200"
             [class.bg-white]="currentStep() === s.step"
             [class.bg-white/[.03]]="currentStep() !== s.step"
             (click)="s.step < currentStep() && goToStep(s.step)">
          <!-- Number -->
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all"
               [ngClass]="currentStep() === s.step
                 ? 'bg-zinc-900 text-amber-400'
                 : currentStep() > s.step
                   ? 'bg-amber-400 text-zinc-900'
                   : 'bg-zinc-800 text-zinc-500'">
            @if (currentStep() > s.step) {
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            } @else {
              {{ s.step }}
            }
          </div>
          <div>
            <p class="text-[13px] font-semibold transition-colors"
               [class.text-zinc-900]="currentStep() === s.step"
               [class.text-zinc-400]="currentStep() !== s.step">{{ s.label }}</p>
            <p class="text-[11px] transition-colors"
               [class.text-zinc-600]="currentStep() === s.step"
               [class.text-zinc-600]="currentStep() !== s.step">{{ s.hint }}</p>
          </div>
        </div>
      }
    </div>

    <!-- Live preview card -->
    <div class="relative z-10 mx-5 mt-auto mb-7">
      <div class="rounded-2xl overflow-hidden border border-white/[.06]"
           style="background: rgba(255,255,255,.04)">
        <!-- Banner -->
        <div class="h-28 relative overflow-hidden bg-zinc-800/60">
          @if (previewImg()) {
            <img [src]="previewImg()" class="w-full h-full object-cover opacity-80 fade-in" alt="">
          }
          <div class="absolute inset-0"
               style="background: linear-gradient(to top, rgba(0,0,0,.6) 0%, transparent 60%)"></div>
          <!-- Type badge -->
          @if (isOnline()) {
            <span class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                  style="background:rgba(245,158,11,.2);color:#fbbf24;border:1px solid rgba(245,158,11,.3)">
              💻 Online
            </span>
          } @else {
            <span class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                  style="background:rgba(99,102,241,.2);color:#a5b4fc;border:1px solid rgba(99,102,241,.3)">
              📍 In-Person
            </span>
          }
        </div>
        <!-- Card body -->
        <div class="p-3.5">
          <p class="text-[13px] font-semibold text-white truncate leading-tight">
            {{ previewTitle() || 'Event title...' }}
          </p>
          <p class="text-[11px] text-zinc-500 mt-0.5 truncate">
            {{ previewDate() || 'Set a start date →' }}
          </p>
          @if (ticketRows.length > 0) {
            <div class="mt-2 flex items-center gap-1.5">
              <svg class="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
              </svg>
              <span class="text-[11px] text-amber-400/80 font-medium">
                {{ ticketRows.length }} ticket type{{ ticketRows.length > 1 ? 's' : '' }}
              </span>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Org name -->
    @if (organizationName()) {
      <p class="relative z-10 px-7 pb-6 text-[11px] text-zinc-600 truncate">
        Publishing as <span class="text-zinc-400">{{ organizationName() }}</span>
      </p>
    }
  </div>

  <!-- ═══════════════════════════════════════════════
       RIGHT PANEL — Form
  ═══════════════════════════════════════════════════ -->
  <div class="flex flex-col flex-1 min-w-0 min-h-0">

    <!-- Top bar: mobile title + close -->
    <div class="flex items-center justify-between px-6 pt-6 pb-5 shrink-0">
      <!-- Mobile progress dots -->
      <div class="flex items-center gap-2 sm:hidden">
        @for (s of stepMeta; track s.step) {
          <div class="h-1 rounded-full transition-all duration-300"
               [class.w-6]="currentStep() === s.step"
               [class.w-2]="currentStep() !== s.step"
               [ngClass]="currentStep() >= s.step ? 'bg-amber-400' : 'bg-zinc-700'">
          </div>
        }
        <span class="text-xs text-zinc-500 ml-1">{{ currentStep() }}/{{ totalSteps }}</span>
      </div>

      <!-- Desktop: step info -->
      <div class="hidden sm:block">
        <p class="text-xs font-medium text-zinc-500 tracking-wide uppercase">{{ stepTitle() }}</p>
      </div>

      <!-- Close -->
      <button type="button" (click)="onClose()"
              class="w-8 h-8 rounded-xl flex items-center justify-center
                     bg-white/[.05] hover:bg-white/[.09] text-zinc-400 hover:text-zinc-200
                     transition-all duration-150 border border-white/[.05]">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Progress bar (mobile) -->
    <div class="h-px w-full bg-white/[.05] sm:hidden shrink-0">
      <div class="h-full bg-amber-400 transition-all duration-500"
           [style.width]="(currentStep() / totalSteps * 100) + '%'"></div>
    </div>

    <!-- ─── Scrollable form body ──────────────────── -->
    <form [formGroup]="eventForm" (ngSubmit)="onSubmit()"
          class="flex flex-col flex-1 min-h-0">

      <div class="flex-1 overflow-y-auto thin-scroll px-6 py-2">

        <!-- ╔════════════════════════════╗
             ║   STEP 1 — Basic Details   ║
             ╚════════════════════════════╝ -->
        @if (currentStep() === 1) {
          <div class="step-animate space-y-6 pb-6">

            <!-- Title -->
            <div class="space-y-1.5">
              <label class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
                Event Title <span class="text-amber-400">*</span>
              </label>
              <div class="field-line pb-2.5">
                <input type="text" formControlName="title"
                       placeholder="e.g. Annual Design Summit 2026"
                       class="text-[22px] font-bold tracking-tight placeholder:text-zinc-700 placeholder:font-normal placeholder:text-[22px]"
                       style="font-size:22px !important; font-weight:700 !important"/>
              </div>
              @if (f['title'].invalid && f['title'].touched) {
                <p class="text-[11px] text-red-400">Title is required (min 3 characters)</p>
              }
            </div>

            <!-- Description -->
            <div class="space-y-1.5">
              <label class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
                Description <span class="text-amber-400">*</span>
              </label>
              <div class="field-line pb-2">
                <textarea formControlName="description" rows="4"
                          placeholder="What will attendees experience? Be specific and compelling."></textarea>
              </div>
              @if (f['description'].invalid && f['description'].touched) {
                <p class="text-[11px] text-red-400">Description is required</p>
              }
            </div>

            <!-- Category + Visibility row -->
            <div class="grid grid-cols-2 gap-5">
              <div class="space-y-1.5">
                <label class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
                  Category <span class="text-amber-400">*</span>
                </label>
                <div class="field-line pb-2">
                  <select formControlName="categoryId" style="font-size:14px !important">
                    <option [ngValue]="null" disabled>Choose one…</option>
                    @for (cat of categories(); track cat.id) {
                      <option [ngValue]="cat.id">{{ cat.name }}</option>
                    }
                  </select>
                </div>
                @if (f['categoryId'].invalid && f['categoryId'].touched) {
                  <p class="text-[11px] text-red-400">Required</p>
                }
              </div>

              <div class="space-y-1.5">
                <label class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
                  Format <span class="text-amber-400">*</span>
                </label>
                <div class="field-line pb-2">
                  <select formControlName="event_type" style="font-size:14px !important">
                    <option [ngValue]="0">🏛️ In-Person</option>
                    <option [ngValue]="1">💻 Online</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Banner URL -->
            <div class="space-y-1.5">
              <label class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
                Cover Image URL
              </label>
              <div class="field-line pb-2.5 flex items-center gap-2">
                <svg class="w-4 h-4 text-zinc-600 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <input type="url" formControlName="event_img_url" placeholder="https://your-image.com/cover.jpg"/>
              </div>
              @if (previewImg()) {
                <div class="mt-2 rounded-xl overflow-hidden h-28 bg-zinc-800 fade-in border border-white/[.06]">
                  <img [src]="previewImg()" class="w-full h-full object-cover" alt="">
                </div>
              }
            </div>

          </div>
        }

        <!-- ╔════════════════════════════════╗
             ║  STEP 2 — Schedule & Location  ║
             ╚════════════════════════════════╝ -->
        @if (currentStep() === 2) {
          <div class="step-animate space-y-6 pb-6">

            <!-- Dates -->
            <div class="space-y-3">
              <label class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
                Date & Time <span class="text-amber-400">*</span>
              </label>

              <!-- Start -->
              <div class="flex items-center gap-4 p-4 rounded-2xl border border-white/[.06] bg-white/[.02]">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                     style="background:rgba(245,158,11,.12)">
                  <svg class="w-4.5 h-4.5 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1">Starts</p>
                  <input type="datetime-local" formControlName="start_time" style="font-size:14px !important"/>
                </div>
              </div>

              <!-- End -->
              <div class="flex items-center gap-4 p-4 rounded-2xl border border-white/[.06] bg-white/[.02]">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                     style="background:rgba(239,68,68,.1)">
                  <svg class="w-4.5 h-4.5 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1">Ends</p>
                  <input type="datetime-local" formControlName="end_time" style="font-size:14px !important"/>
                </div>
              </div>
            </div>

            <!-- Location section -->
            <div class="space-y-3">
              <label class="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
                Location
              </label>

              @if (!isOnline()) {
                <!-- Physical location card -->
                <div class="p-4 rounded-2xl border border-white/[.06] bg-white/[.02] space-y-4">
                  <div class="grid grid-cols-2 gap-x-5 gap-y-4">
                    <!-- City -->
                    <div class="space-y-1.5">
                      <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                        City <span class="text-amber-400">*</span>
                      </p>
                      <div class="field-line pb-2">
                        <input type="text" formControlName="city" placeholder="Cairo"/>
                      </div>
                      @if (f['city'].invalid && f['city'].touched) {
                        <p class="text-[10px] text-red-400">Required</p>
                      }
                    </div>
                    <!-- Region -->
                    <div class="space-y-1.5">
                      <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                        Region <span class="text-amber-400">*</span>
                      </p>
                      <div class="field-line pb-2">
                        <input type="text" formControlName="region" placeholder="Greater Cairo"/>
                      </div>
                      @if (f['region'].invalid && f['region'].touched) {
                        <p class="text-[10px] text-red-400">Required</p>
                      }
                    </div>
                    <!-- Street -->
                    <div class="space-y-1.5">
                      <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Street</p>
                      <div class="field-line pb-2">
                        <input type="text" formControlName="street" placeholder="123 Main St"/>
                      </div>
                    </div>
                    <!-- Venue -->
                    <div class="space-y-1.5">
                      <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Venue</p>
                      <div class="field-line pb-2">
                        <input type="text" formControlName="name_of_place" placeholder="Grand Hall"/>
                      </div>
                    </div>
                  </div>
                </div>
              } @else {
                <!-- Online URL -->
                <div class="p-4 rounded-2xl border border-amber-400/20 bg-amber-400/[.04] flex items-start gap-4">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                       style="background:rgba(245,158,11,.12)">
                    <svg class="w-4.5 h-4.5 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0 space-y-1.5">
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                      Meeting URL <span class="text-amber-400">*</span>
                    </p>
                    <div class="field-line pb-2">
                      <input type="url" formControlName="online_url"
                             placeholder="https://meet.google.com/..."/>
                    </div>
                    @if (f['online_url'].invalid && f['online_url'].touched) {
                      <p class="text-[10px] text-red-400">Valid URL required</p>
                    }
                  </div>
                </div>
              }
            </div>

          </div>
        }

        <!-- ╔═════════════════════════╗
             ║   STEP 3 — Tickets      ║
             ╚═════════════════════════╝ -->
        @if (currentStep() === 3) {
          <div class="step-animate pb-6">

            <!-- No templates state -->
            @if (templates().length === 0) {
              <div class="flex flex-col items-center justify-center py-16 space-y-4 text-center">
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center border border-white/[.06] bg-white/[.02]">
                  <svg class="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-semibold text-zinc-300">No ticket templates yet</p>
                  <p class="text-xs text-zinc-600 mt-1">Create templates before adding tickets to an event.</p>
                </div>
                <a routerLink="/dashboard/tickets" (click)="onClose()"
                   class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                          border border-amber-400/30 text-amber-400 bg-amber-400/[.06]
                          hover:bg-amber-400/[.1] transition-colors">
                  Manage Templates →
                </a>
              </div>
            } @else {
              <div class="space-y-4" formArrayName="tickets">

                <!-- Add button row -->
                <div class="flex items-center justify-between mb-2">
                  <div>
                    <p class="text-sm font-semibold text-zinc-300">Ticket Types</p>
                    <p class="text-xs text-zinc-600 mt-0.5">You can skip this step for free/invite-only events.</p>
                  </div>
                  <button type="button" (click)="addTicketRow()"
                          class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl
                                 text-xs font-semibold text-amber-400
                                 border border-amber-400/25 bg-amber-400/[.06]
                                 hover:bg-amber-400/[.12] hover:border-amber-400/40
                                 transition-all duration-150">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Add Ticket
                  </button>
                </div>

                <!-- Empty state within tickets step -->
                @if (ticketRows.length === 0) {
                  <div class="py-8 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/[.08] bg-white/[.01]">
                    <svg class="w-6 h-6 text-zinc-700" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    <p class="text-xs text-zinc-600">Click "Add Ticket" to attach a ticket type</p>
                  </div>
                }

                <!-- Ticket cards -->
                @for (row of ticketRows.controls; track $index; let i = $index) {
                  <div [formGroupName]="i"
                       class="ticket-card rounded-2xl border border-white/[.06] bg-white/[.02] overflow-hidden"
                       [ngClass]="getTicketCardClass(i)">

                    <!-- Card header -->
                    <div class="flex items-center justify-between px-5 py-4 border-b border-white/[.05]">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                             style="background:rgba(245,158,11,.12);color:#f59e0b">
                          {{ i + 1 }}
                        </div>
                        @if (getSelectedTemplate(i); as tpl) {
                          <div>
                            <p class="text-[13px] font-semibold text-white">{{ tpl.name }}</p>
                            <p class="text-[10px] text-zinc-500 flex items-center gap-1">
                              <span [ngClass]="getTierColorClass(tpl.tier)">
                                {{ getTierLabel(tpl.tier) }}
                              </span>
                              <span class="text-zinc-700">·</span>
                              <span>Default {{ tpl.defaultPrice | currency }}</span>
                            </p>
                          </div>
                        } @else {
                          <p class="text-[13px] text-zinc-500">Select a template</p>
                        }
                      </div>
                      <button type="button" (click)="removeTicketRow(i)"
                              class="w-7 h-7 rounded-lg flex items-center justify-center
                                     text-zinc-600 hover:text-red-400 hover:bg-red-400/[.08]
                                     transition-all duration-150">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>

                    <!-- Card body -->
                    <div class="px-5 py-4 space-y-4">
                      <!-- Template select -->
                      <div class="space-y-1.5">
                        <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                          Template <span class="text-amber-400">*</span>
                        </p>
                        <div class="field-line pb-2">
                          <select formControlName="templateId" style="font-size:13px !important">
                            <option [ngValue]="null" disabled>Choose ticket template…</option>
                            @for (t of templates(); track t.id) {
                              <option [ngValue]="t.id">
                                {{ t.name }} — {{ t.defaultPrice | currency }}
                                ({{ getTierLabel(t.tier) }})
                              </option>
                            }
                          </select>
                        </div>
                      </div>

                      <!-- Quantity + Price -->
                      <div class="grid grid-cols-2 gap-5">
                        <div class="space-y-1.5">
                          <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                            Quantity <span class="text-amber-400">*</span>
                          </p>
                          <div class="field-line pb-2">
                            <input type="number" formControlName="quantity" min="1" placeholder="100"/>
                          </div>
                          @if (ticketRows.at(i).get('quantity')?.invalid && ticketRows.at(i).get('quantity')?.touched) {
                            <p class="text-[10px] text-red-400">Min. 1</p>
                          }
                        </div>
                        <div class="space-y-1.5">
                          <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                            Price Override
                            <span class="normal-case text-zinc-600 font-normal ml-0.5">(optional)</span>
                          </p>
                          <div class="field-line pb-2 flex items-center gap-1.5">
                            <span class="text-zinc-600 text-sm shrink-0">$</span>
                            <input type="number" formControlName="priceOverride" min="0" step="0.01" placeholder="0.00"/>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                }

              </div>
            }
          </div>
        }

      </div><!-- /scroll area -->

      <!-- ─── Footer navigation ────────────────────────────────── -->
      <div class="shrink-0 px-6 py-5 border-t border-white/[.05] flex items-center justify-between gap-3"
           style="background: rgba(24,24,27,.8); backdrop-filter: blur(8px)">

        <!-- Back -->
        <button type="button"
                [class.invisible]="currentStep() === 1"
                (click)="prevStep()"
                [disabled]="loading()"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                       text-zinc-400 hover:text-zinc-200 bg-white/[.04] hover:bg-white/[.07]
                       border border-white/[.05] transition-all duration-150 disabled:opacity-40">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        <!-- Right side actions -->
        <div class="flex items-center gap-2">
          <!-- Ticket summary pill (step 3) -->
          @if (currentStep() === 3 && ticketRows.length > 0) {
            <span class="text-[11px] font-medium text-amber-400/70 px-3 py-1.5 rounded-full
                         border border-amber-400/15 bg-amber-400/[.05]">
              {{ ticketRows.length }} type{{ ticketRows.length > 1 ? 's' : '' }}
            </span>
          }

          <!-- Next / Submit -->
          @if (currentStep() < totalSteps) {
            <button type="button" (click)="nextStep()"
                    [disabled]="loading()"
                    class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                           text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-150 hover:opacity-90 active:scale-[.98]"
                    style="background: linear-gradient(135deg, #f59e0b, #f97316)">
              Continue
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          } @else {
            <button type="submit"
                    [disabled]="loading()"
                    class="flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-bold
                           text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-150 hover:opacity-90 active:scale-[.98]
                           shadow-[0_4px_20px_rgba(245,158,11,.3)]"
                    style="background: linear-gradient(135deg, #f59e0b, #ef4444)">
              @if (loading()) {
                <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Publishing…
              } @else {
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                Publish Event
              }
            </button>
          }
        </div>

      </div>
    </form>

  </div><!-- /right panel -->

</div><!-- /modal -->
</div><!-- /backdrop -->
  `,
})
export class CreateEventModalComponent implements OnInit {
  // ─── Outputs ────────────────────────────────────────────────────────────────
  created = output<void>();
  close   = output<void>();

  // ─── DI ─────────────────────────────────────────────────────────────────────
  private fb              = inject(FormBuilder);
  private ticketService   = inject(TicketService);
  private categoryService = inject(CategoryService);
  private authService     = inject(AuthService);


  // ─── State ──────────────────────────────────────────────────────────────────
  eventForm!: FormGroup;
  categories       = signal<Category[]>([]);
  templates        = signal<TicketTemplate[]>([]);
  loading          = signal(false);
  organizationName = signal('');
  organizationId   = signal<number | null>(null);
  currentStep      = signal(1);
  readonly totalSteps = TOTAL_STEPS;

  readonly stepMeta = [
    { step: 1, label: 'Details',  hint: 'Title, description & cover' },
    { step: 2, label: 'Schedule', hint: 'Dates & location'           },
    { step: 3, label: 'Tickets',  hint: 'Pricing & availability'     },
  ];

  // Writable signals kept in sync with form valueChanges — safe with OnPush
  private _eventType = signal<number>(0);
  private _title     = signal<string>('');
  private _imgUrl    = signal<string>('');
  private _startTime = signal<string>('');

  // ─── Computed ───────────────────────────────────────────────────────────────
  /** Reads a real signal → reacts correctly under ChangeDetectionStrategy.OnPush */
  isOnline     = computed(() => this._eventType() === 1);
  previewTitle = computed(() => this._title());
  previewImg   = computed(() => this._imgUrl());
  previewDate  = computed(() => {
    const v = this._startTime();
    if (!v) return '';
    try {
      return new Date(v).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  });

  stepTitle = computed(() => {
    const map: Record<number, string> = {
      1: 'Event Details', 2: 'Schedule & Location', 3: 'Tickets',
    };
    return map[this.currentStep()] ?? '';
  });

  stepDescription = computed(() => {
    const map: Record<number, string> = {
      1: 'Give your event a name, describe what attendees will experience, and set a cover image.',
      2: 'Set the date, time, and where your event will take place.',
      3: 'Add ticket types from your templates. You can skip this for free events.',
    };
    return map[this.currentStep()] ?? '';
  });

  // ─── Form accessors ──────────────────────────────────────────────────────────
  get f()          { return this.eventForm.controls; }
  get ticketRows() { return this.eventForm.get('tickets') as FormArray; }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit() {
    this.initForm();
    this.loadOrganizationInfo();
    this.loadCategories();
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────
  nextStep() {
    if (!this.validateCurrentStep()) return;
    if (this.currentStep() < this.totalSteps) this.currentStep.update(s => s + 1);
  }

  prevStep() {
    if (this.currentStep() > 1) this.currentStep.update(s => s - 1);
  }

  goToStep(step: number) {
    if (step >= 1 && step <= this.totalSteps) this.currentStep.set(step);
  }

  private validateCurrentStep(): boolean {
    const step = this.currentStep();

    if (step === 1) {
      const controls = ['title', 'description', 'categoryId', 'event_type'];
      controls.forEach(k => this.f[k].markAsTouched());
      return controls.every(k => this.f[k].valid);
    }

    if (step === 2) {
      const controls = this.isOnline()
        ? ['start_time', 'end_time', 'online_url']
        : ['start_time', 'end_time', 'city', 'region'];
      controls.forEach(k => this.f[k].markAsTouched());
      return controls.every(k => this.f[k].valid);
    }

    return true;
  }

  // ─── Data loaders ────────────────────────────────────────────────────────────
  private loadOrganizationInfo() {
    const org = this.authService.getOrganization();
    if (org) {
      this.organizationName.set(org.name);
      this.organizationId.set(org.id);
      this.loadTemplates(org.id);
      this.eventForm.patchValue({ organizationId: org.id });
    } else {
      toast.error('Organization not found. Please log in again.');
      this.onClose();
    }
  }

  private loadCategories() {
    this.categoryService.getAllCategories().subscribe({
      next:  (d) => this.categories.set(d),
      error: ()  => toast.error('Failed to load categories'),
    });
  }

  private loadTemplates(orgId: number) {
    this.ticketService.getTemplatesByOrganization(orgId).subscribe({
      next:  (t) => this.templates.set(t),
      error: ()  => toast.error('Failed to load ticket templates'),
    });
  }

  // ─── Form init ───────────────────────────────────────────────────────────────
  private initForm() {
    this.eventForm = this.fb.group({
      title:          ['', [Validators.required, Validators.minLength(3)]],
      description:    ['', Validators.required],
      event_img_url:  [''],
      start_time:     ['', Validators.required],
      end_time:       ['', Validators.required],
      event_type:     [0,  Validators.required],
      city:           [''],
      region:         [''],
      street:         [''],
      name_of_place:  [''],
      online_url:     [''],
      categoryId:     [null, Validators.required],
      organizationId: [null],
      tickets:        this.fb.array([]),
    });

    // Sync signals from form valueChanges so computed() reacts under OnPush
    this.eventForm.get('event_type')?.valueChanges.subscribe(v => {
      const t = Number(v);
      this._eventType.set(t);
      this.updateLocationValidators(t);
    });
    this.eventForm.get('title')?.valueChanges.subscribe(v => this._title.set(v ?? ''));
    this.eventForm.get('event_img_url')?.valueChanges.subscribe(v => this._imgUrl.set(v ?? ''));
    this.eventForm.get('start_time')?.valueChanges.subscribe(v => this._startTime.set(v ?? ''));

    this.updateLocationValidators(0);
  }

  private updateLocationValidators(type: number) {
    const city   = this.eventForm.get('city')!;
    const region = this.eventForm.get('region')!;
    const url    = this.eventForm.get('online_url')!;

    if (type === 1) {
      city.clearValidators();   region.clearValidators();
      url.setValidators([Validators.required, Validators.pattern(/^https?:\/\/.+/)]);
    } else {
      city.setValidators(Validators.required);
      region.setValidators(Validators.required);
      url.clearValidators();
    }
    [city, region, url].forEach(c => c.updateValueAndValidity());
  }

  // ─── Ticket helpers ──────────────────────────────────────────────────────────
  addTicketRow() {
    this.ticketRows.push(this.fb.group({
      templateId:    [null, Validators.required],
      quantity:      [1,   [Validators.required, Validators.min(1)]],
      priceOverride: [0,   [Validators.min(0)]],
    }));
  }

  removeTicketRow(i: number) { this.ticketRows.removeAt(i); }

  getSelectedTemplate(i: number): TicketTemplate | null {
    const id = this.ticketRows.at(i).get('templateId')?.value;
    return this.templates().find(t => t.id === Number(id)) ?? null;
  }

  getTierLabel(tier: number): string {
    return ['Standard', 'VIP', 'Premium'][tier] ?? 'Standard';
  }

  getTierColorClass(tier: number): string {
    return [
      'text-emerald-400',
      'text-amber-400',
      'text-violet-400',
    ][tier] ?? 'text-zinc-400';
  }

  getTicketCardClass(i: number): string {
    const tpl = this.getSelectedTemplate(i);
    if (!tpl) return '';
    return ['tier-standard', 'tier-vip', 'tier-premium'][tpl.tier] ?? '';
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────
  onSubmit() {
    this.eventForm.markAllAsTouched();

    if (this.eventForm.invalid) {
      const step1Fields = ['title', 'description', 'categoryId'];
      const step2Fields = this.isOnline()
        ? ['start_time', 'end_time', 'online_url']
        : ['start_time', 'end_time', 'city', 'region'];
      if (step1Fields.some(k => this.f[k].invalid)) { this.currentStep.set(1); }
      else if (step2Fields.some(k => this.f[k].invalid)) { this.currentStep.set(2); }
      toast.error('Please complete all required fields');
      return;
    }

    this.loading.set(true);
    const v = this.eventForm.value;

    const dto: CreateEventWithTicketsDto = {
      title:          v.title,
      description:    v.description,
      event_img_url:  v.event_img_url  || null,
      start_time:     new Date(v.start_time).toISOString(),
      end_time:       new Date(v.end_time).toISOString(),
      event_type:     Number(v.event_type),
      city:           v.city           || null,
      region:         v.region         || null,
      street:         v.street         || null,
      name_of_place:  v.name_of_place  || null,
      online_url:     v.online_url     || null,
      categoryId:     Number(v.categoryId),
      organizationId: Number(v.organizationId),
      tickets: (v.tickets as any[]).map(t => ({
        templateId:    Number(t.templateId),
        quantity:      Number(t.quantity),
        priceOverride: Number(t.priceOverride),
      })),
    };

    this.ticketService.createEventWithTickets(dto).subscribe({
      next: () => {
        toast.success('Event published successfully!');
        this.loading.set(false);
        this.created.emit();
      },
      error: (err) => {
        toast.error(err.message ?? 'Failed to publish event');
        this.loading.set(false);
      },
    });
  }

  onClose() { this.close.emit(); }
} 