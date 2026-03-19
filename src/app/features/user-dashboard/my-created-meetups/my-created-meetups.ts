// src/app/features/user-dashboard/my-created-meetups/my-created-meetups.ts
import {
  Component, inject, signal, computed, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { Router }       from '@angular/router';
import { Subject, of }  from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';

import { MeetupService }             from '@core/services/meetup.service';
import { AuthService }               from '@core/services/auth.service';
import { CategoryService, Category } from '@core/services/category';
import {
  Meetup, MeetupLocationType,
  CreateMeetupDto, UpdateMeetupDto,
} from '@core/models/meetup.model';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-EG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
}
function isUpcoming(iso?: string | null): boolean {
  return !!iso && new Date(iso) > new Date();
}
function toInputDt(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso), pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── form model ────────────────────────────────────────────────────────────────
interface MeetupForm {
  title: string; start_Time: string; end_Time: string; maxAttendees: string;
  description: string; city: string; region: string; street: string;
  nameOfPlace: string; online_url: string; meetup_img_url: string;
  locationType: MeetupLocationType; categoryId: number | null;
}
const emptyForm = (): MeetupForm => ({
  title: '', start_Time: '', end_Time: '', maxAttendees: '',
  description: '', city: '', region: '', street: '',
  nameOfPlace: '', online_url: '', meetup_img_url: '',
  locationType: MeetupLocationType.Offline, categoryId: null,
});
type ModalMode = 'create' | 'edit';

@Component({
  selector:   'app-my-created-meetups',
  standalone: true,
  imports:    [CommonModule, FormsModule],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <div class="min-h-screen bg-[#060608] text-[#F2EEE6] font-[Plus_Jakarta_Sans,sans-serif]">

      <!-- ── HERO ── -->
      <header class="relative overflow-hidden px-4 pt-8 pb-6 sm:px-6 md:px-10 md:pt-12 md:pb-8
                     flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="pointer-events-none absolute -top-36 -right-20 w-80 h-80 rounded-full"
             style="background:radial-gradient(circle,rgba(240,180,41,.06) 0%,transparent 65%)"></div>

        <div class="relative z-10 flex-1">
          <div class="flex gap-2 mb-3">
            <span class="inline-flex items-center px-3 py-0.5 rounded-full font-[DM_Mono,monospace]
                         text-[0.58rem] tracking-widest uppercase
                         bg-[#F0B429]/10 border border-[#F0B429]/22 text-[#F0B429]">Hosting</span>
            @if (!loading() && meetups().length > 0) {
              <span class="inline-flex items-center px-3 py-0.5 rounded-full font-[DM_Mono,monospace]
                           text-[0.58rem] tracking-widest uppercase
                           bg-white/5 border border-white/7 text-[#F2EEE6]/40">
                {{ meetups().length }} meetup{{ meetups().length !== 1 ? 's' : '' }}
              </span>
            }
          </div>
          <h1 class="font-[Bebas_Neue,sans-serif] text-5xl sm:text-6xl md:text-7xl leading-none tracking-wide mb-2">
            My <em class="text-[#F0B429] not-italic">Created</em> Meetups
          </h1>
          <p class="text-sm text-[#F2EEE6]/40 font-light leading-relaxed">
            Meetups you manage — create, edit, or remove them here.
          </p>
        </div>

        <button (click)="openCreate()"
                class="relative z-10 self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                       bg-[#F0B429] text-[#1a0f00] font-bold text-sm cursor-pointer border-none
                       hover:opacity-85 hover:-translate-y-px transition-all duration-200 shrink-0">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          New Meetup
        </button>
      </header>

      <div class="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 pb-16">

        <!-- ── LOADING ── -->
        @if (loading()) {
          <div class="flex flex-col gap-3">
            @for (n of skeletons; track n) {
              <div class="h-28 rounded-2xl skeleton-shimmer" [style.animation-delay]="n * 65 + 'ms'"></div>
            }
          </div>
        }

        <!-- ── ERROR ── -->
        @else if (error()) {
          <div class="flex flex-col items-center gap-3 py-24 text-center">
            <span class="text-4xl">⚠</span>
            <p class="font-[Bebas_Neue,sans-serif] text-2xl tracking-wide">Couldn't load meetups</p>
            <button (click)="load()"
                    class="mt-2 px-6 py-2.5 rounded-xl bg-[#F0B429] text-[#1a0f00] font-bold text-sm cursor-pointer">
              Retry
            </button>
          </div>
        }

        <!-- ── EMPTY ── -->
        @else if (meetups().length === 0) {
          <div class="flex flex-col items-center gap-3 py-24 text-center">
            <div class="w-14 h-14 rounded-2xl bg-[#111116] border border-white/12
                        flex items-center justify-center">
              <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.4"
                   viewBox="0 0 24 24" class="text-[#F2EEE6]/40">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
            </div>
            <p class="font-[Bebas_Neue,sans-serif] text-2xl tracking-wide">No meetups yet</p>
            <p class="text-sm text-[#F2EEE6]/40 font-light">Create your first community meetup.</p>
            <button (click)="openCreate()"
                    class="mt-2 px-6 py-2.5 rounded-xl bg-[#F0B429] text-[#1a0f00] font-bold text-sm cursor-pointer">
              Create Meetup
            </button>
          </div>
        }

        <!-- ── LIST ── -->
        @else {
          <div class="flex flex-col gap-3">
            @for (m of sorted(); track m.id; let i = $index) {
              <div class="bg-[#09090c] border border-white/7 rounded-2xl overflow-hidden
                          transition-all duration-200 hover:border-white/12 hover:shadow-2xl
                          slide-up"
                   [class.opacity-60]="!isUpcoming(m.start_Time)"
                   [style.animation-delay]="i * 45 + 'ms'">

                @if (m.meetup_img_url) {
                  <div class="relative h-20 sm:h-24 overflow-hidden">
                    <img [src]="m.meetup_img_url" [alt]="m.title ?? ''" loading="lazy"
                         class="w-full h-full object-cover"/>
                    <div class="absolute inset-0"
                         style="background:linear-gradient(to top,rgba(9,9,12,.85) 0%,transparent 60%)"></div>
                  </div>
                }

                <div class="p-4 flex flex-col sm:flex-row sm:items-start gap-4">

                  <!-- Left: info -->
                  <div class="flex-1 min-w-0 flex flex-col gap-2">
                    <div class="flex flex-wrap gap-1.5">
                      @if (m.category?.name) {
                        <span class="px-2 py-0.5 rounded-md font-[DM_Mono,monospace] text-[0.56rem]
                                     tracking-widest uppercase text-[#F0B429] bg-[#F0B429]/8
                                     border border-[#F0B429]/22">{{ m.category!.name }}</span>
                      }
                      <span class="px-2 py-0.5 rounded-md font-[DM_Mono,monospace] text-[0.56rem]
                                   tracking-widest uppercase border"
                            [class]="m.meetup_location_type === 1
                              ? 'text-sky-400 bg-sky-500/8 border-sky-500/20'
                              : 'text-[#F2EEE6]/40 bg-white/5 border-white/7'">
                        {{ m.meetup_location_type === 1 ? 'Online' : 'In-Person' }}
                      </span>
                      @if (isUpcoming(m.start_Time)) {
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                                     font-[DM_Mono,monospace] text-[0.56rem] tracking-widest uppercase
                                     text-green-400 bg-green-500/8 border border-green-500/20">
                          <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"></span>
                          Upcoming
                        </span>
                      } @else {
                        <span class="px-2 py-0.5 rounded-md font-[DM_Mono,monospace] text-[0.56rem]
                                     tracking-widest uppercase text-[#F2EEE6]/30
                                     bg-white/5 border border-white/7 opacity-70">Past</span>
                      }
                    </div>

                    <h3 class="font-[Bebas_Neue,sans-serif] text-lg leading-tight tracking-wide
                               text-[#F2EEE6]">{{ m.title }}</h3>

                    @if (m.description) {
                      <p class="text-[0.73rem] text-[#F2EEE6]/40 leading-relaxed line-clamp-2">
                        {{ m.description }}
                      </p>
                    }

                    <div class="flex flex-col gap-1">
                      @if (m.start_Time) {
                        <div class="flex items-center gap-1.5 text-[0.7rem] text-[#F2EEE6]/40">
                          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="shrink-0 opacity-60">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                          </svg>
                          {{ fmtDate(m.start_Time) }} · {{ fmtTime(m.start_Time) }}
                          @if (m.end_Time) { → {{ fmtTime(m.end_Time) }} }
                        </div>
                      }
                      @if (m.nameOfPlace || m.city) {
                        <div class="flex items-center gap-1.5 text-[0.7rem] text-[#F2EEE6]/40">
                          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="shrink-0 opacity-60">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                          </svg>
                          {{ m.nameOfPlace || m.city }}
                        </div>
                      }
                      @if (m.online_url && m.meetup_location_type === 1) {
                        <div class="flex items-center gap-1.5 text-[0.7rem] text-[#F2EEE6]/40">
                          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="shrink-0 opacity-60">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                          </svg>
                          <a [href]="m.online_url" target="_blank" rel="noopener"
                             class="text-sky-400 no-underline hover:underline">Join link</a>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Right: count + actions -->
                  <div class="flex sm:flex-col items-center sm:items-end justify-between sm:justify-between
                              gap-3 shrink-0 sm:min-w-[90px]">
                    <div class="flex items-baseline gap-0.5">
                      <span class="font-[Bebas_Neue,sans-serif] text-2xl leading-none tracking-wide text-[#F0B429]">
                        {{ (m.participants ?? []).length }}
                      </span>
                      @if (m.maxAttendees) {
                        <span class="text-[0.68rem] text-[#F2EEE6]/40"> / {{ m.maxAttendees }}</span>
                      }
                      <span class="font-[DM_Mono,monospace] text-[0.54rem] tracking-widest uppercase
                                   text-[#F2EEE6]/40 ml-1">attendees</span>
                    </div>

                    <div class="flex sm:flex-col gap-2 w-full sm:w-auto">
                      <button (click)="openEdit(m)"
                              class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5
                                     rounded-lg text-[0.7rem] font-semibold cursor-pointer
                                     border border-[#F0B429]/30 bg-[#F0B429]/6 text-[#F0B429]
                                     hover:bg-[#F0B429]/14 transition-colors duration-200">
                        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        Edit
                      </button>
                      <button (click)="confirmDelete(m)"
                              [disabled]="deletingId() === m.id"
                              class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5
                                     rounded-lg text-[0.7rem] font-semibold cursor-pointer
                                     border border-[#FF4433]/25 bg-[#FF4433]/5 text-[#FF4433]
                                     hover:bg-[#FF4433]/14 transition-colors duration-200
                                     disabled:opacity-40 disabled:cursor-not-allowed">
                        @if (deletingId() === m.id) {
                          <span class="w-3 h-3 rounded-full border-2 border-[#FF4433]/30
                                       border-t-[#FF4433] animate-spin inline-block"></span>
                        } @else {
                          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                          Delete
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- ── TOAST ── -->
      @if (toast()) {
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl
                    text-[0.82rem] font-semibold whitespace-nowrap z-[300] toast-in"
             [class]="toast()!.type === 'error'
               ? 'bg-[#FF4433]/12 border border-[#FF4433]/30 text-[#FF4433]'
               : 'bg-[#F0B429]/12 border border-[#F0B429]/30 text-[#F0B429]'"
             role="status" aria-live="polite">
          {{ toast()!.msg }}
        </div>
      }

      <!-- ── DELETE CONFIRM ── -->
      @if (deleteTarget()) {
        <div class="fixed inset-0 bg-[#060608]/80 backdrop-blur-md flex items-center justify-center
                    z-[200] p-4 fade-in"
             (click)="deleteTarget.set(null)">
          <div class="bg-[#111116] border border-white/12 rounded-2xl p-7 max-w-sm w-full pop-in"
               (click)="$event.stopPropagation()">
            <p class="font-[Bebas_Neue,sans-serif] text-2xl tracking-wide text-[#F2EEE6] mb-1">
              Delete meetup?
            </p>
            <p class="text-[0.8rem] text-[#F2EEE6]/40 leading-relaxed mb-5">
              "<strong class="text-[#F2EEE6]/70">{{ deleteTarget()!.title }}</strong>" will be permanently removed.
            </p>
            <div class="flex gap-2.5 justify-end">
              <button (click)="deleteTarget.set(null)"
                      class="px-4 py-2 rounded-lg text-[0.78rem] bg-transparent cursor-pointer
                             border border-white/7 text-[#F2EEE6]/40
                             hover:border-white/12 hover:text-[#F2EEE6] transition-all">
                Cancel
              </button>
              <button (click)="doDelete()" [disabled]="deletingId() !== null"
                      class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[0.78rem] font-semibold
                             cursor-pointer bg-[#FF4433]/15 border border-[#FF4433]/35 text-[#FF4433]
                             hover:bg-[#FF4433]/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                @if (deletingId() !== null) {
                  <span class="w-3 h-3 rounded-full border-2 border-[#FF4433]/30 border-t-[#FF4433] animate-spin"></span>
                } @else { Delete }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ── CREATE / EDIT MODAL ── -->
      @if (modalOpen()) {
        <div class="fixed inset-0 bg-[#060608]/80 backdrop-blur-md flex items-center justify-center
                    z-[200] p-4 fade-in"
             (click)="closeModal()"
             role="dialog"
             [attr.aria-label]="modalMode() === 'create' ? 'Create Meetup' : 'Edit Meetup'">
          <div class="bg-[#111116] border border-white/12 rounded-2xl w-full max-w-lg
                      max-h-[90vh] overflow-y-auto pop-in"
               (click)="$event.stopPropagation()">

            <!-- Head -->
            <div class="flex items-center justify-between px-6 pt-6 pb-0">
              <h2 class="font-[Bebas_Neue,sans-serif] text-2xl tracking-wide text-[#F2EEE6]">
                {{ modalMode() === 'create' ? 'New Meetup' : 'Edit Meetup' }}
              </h2>
              <button (click)="closeModal()" aria-label="Close"
                      class="w-8 h-8 rounded-lg bg-[#16161c] border border-white/7 text-[#F2EEE6]/40
                             flex items-center justify-center cursor-pointer
                             hover:border-white/12 hover:text-[#F2EEE6] transition-all">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="px-6 py-5 flex flex-col gap-4">

              <!-- Title -->
              <div class="flex flex-col gap-1.5">
                <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">
                  Title <span class="text-[#FF4433]">*</span>
                </label>
                <input type="text" [(ngModel)]="form.title" placeholder="e.g. Cairo JS Monthly"
                       class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                              font-[Plus_Jakarta_Sans,sans-serif] text-[0.82rem] px-3 py-2.5 outline-none
                              placeholder-[#F2EEE6]/20 focus:border-[#F0B429]/45 transition-colors"/>
              </div>

              <!-- Description -->
              <div class="flex flex-col gap-1.5">
                <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">Description</label>
                <textarea [(ngModel)]="form.description" rows="3" placeholder="What's this meetup about?"
                          class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                                 font-[Plus_Jakarta_Sans,sans-serif] text-[0.82rem] px-3 py-2.5 outline-none
                                 placeholder-[#F2EEE6]/20 focus:border-[#F0B429]/45 transition-colors
                                 resize-y min-h-[72px]"></textarea>
              </div>

              <!-- Start / End -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">
                    Start <span class="text-[#FF4433]">*</span>
                  </label>
                  <input type="datetime-local" [(ngModel)]="form.start_Time"
                         class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                                text-[0.82rem] px-3 py-2.5 outline-none
                                focus:border-[#F0B429]/45 transition-colors [color-scheme:dark]"/>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">
                    End <span class="text-[#FF4433]">*</span>
                  </label>
                  <input type="datetime-local" [(ngModel)]="form.end_Time"
                         class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                                text-[0.82rem] px-3 py-2.5 outline-none
                                focus:border-[#F0B429]/45 transition-colors [color-scheme:dark]"/>
                </div>
              </div>

              <!-- Location type -->
              <div class="flex flex-col gap-1.5">
                <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">
                  Location type <span class="text-[#FF4433]">*</span>
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button (click)="form.locationType = 0"
                          class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[0.78rem]
                                 border cursor-pointer transition-all duration-200"
                          [class]="form.locationType === 0
                            ? 'bg-[#F0B429]/10 border-[#F0B429]/40 text-[#F0B429] font-semibold'
                            : 'bg-[#16161c] border-white/7 text-[#F2EEE6]/40 hover:border-white/12'">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    In-Person
                  </button>
                  <button (click)="form.locationType = 1"
                          class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[0.78rem]
                                 border cursor-pointer transition-all duration-200"
                          [class]="form.locationType === 1
                            ? 'bg-[#F0B429]/10 border-[#F0B429]/40 text-[#F0B429] font-semibold'
                            : 'bg-[#16161c] border-white/7 text-[#F2EEE6]/40 hover:border-white/12'">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                    Online
                  </button>
                </div>
              </div>

              <!-- In-Person fields -->
              @if (form.locationType === 0) {
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">Venue name</label>
                    <input type="text" [(ngModel)]="form.nameOfPlace" placeholder="e.g. GrEEK Campus"
                           class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                                  text-[0.82rem] px-3 py-2.5 outline-none placeholder-[#F2EEE6]/20
                                  focus:border-[#F0B429]/45 transition-colors"/>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">City</label>
                    <input type="text" [(ngModel)]="form.city" placeholder="Cairo"
                           class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                                  text-[0.82rem] px-3 py-2.5 outline-none placeholder-[#F2EEE6]/20
                                  focus:border-[#F0B429]/45 transition-colors"/>
                  </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">Region</label>
                    <input type="text" [(ngModel)]="form.region" placeholder="Maadi"
                           class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                                  text-[0.82rem] px-3 py-2.5 outline-none placeholder-[#F2EEE6]/20
                                  focus:border-[#F0B429]/45 transition-colors"/>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">Street</label>
                    <input type="text" [(ngModel)]="form.street" placeholder="123 Tahrir St"
                           class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                                  text-[0.82rem] px-3 py-2.5 outline-none placeholder-[#F2EEE6]/20
                                  focus:border-[#F0B429]/45 transition-colors"/>
                  </div>
                </div>
              }

              <!-- Online URL -->
              @if (form.locationType === 1) {
                <div class="flex flex-col gap-1.5">
                  <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">Meeting URL</label>
                  <input type="url" [(ngModel)]="form.online_url" placeholder="https://meet.google.com/..."
                         class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                                text-[0.82rem] px-3 py-2.5 outline-none placeholder-[#F2EEE6]/20
                                focus:border-[#F0B429]/45 transition-colors"/>
                </div>
              }

              <!-- Category + Max attendees -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">
                    Category <span class="text-[#FF4433]">*</span>
                  </label>
                  @if (categoriesLoading()) {
                    <div class="h-10 rounded-xl skeleton-shimmer"></div>
                  } @else if (categoriesError()) {
                    <div class="flex items-center gap-2 text-[0.73rem] text-[#FF4433]
                                bg-[#FF4433]/7 border border-[#FF4433]/18 rounded-xl px-3 py-2.5">
                      <span>Failed to load</span>
                      <button (click)="loadCategories()"
                              class="ml-auto text-[0.7rem] font-semibold text-[#FF4433] cursor-pointer
                                     bg-transparent border border-[#FF4433]/30 rounded-md px-2 py-0.5
                                     hover:bg-[#FF4433]/12">Retry</button>
                    </div>
                  } @else {
                    <select [(ngModel)]="form.categoryId"
                            class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                                   text-[0.82rem] px-3 py-2.5 outline-none cursor-pointer appearance-none
                                   focus:border-[#F0B429]/45 transition-colors">
                      <option [ngValue]="null" disabled>Select category…</option>
                      @for (cat of categories(); track cat.id) {
                        <option [ngValue]="cat.id" class="bg-[#111116]">{{ cat.name }}</option>
                      }
                    </select>
                  }
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">Max attendees</label>
                  <input type="number" [(ngModel)]="form.maxAttendees" placeholder="unlimited" min="1"
                         class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                                text-[0.82rem] px-3 py-2.5 outline-none placeholder-[#F2EEE6]/20
                                focus:border-[#F0B429]/45 transition-colors"/>
                </div>
              </div>

              <!-- Cover image -->
              <div class="flex flex-col gap-1.5">
                <label class="text-[0.72rem] font-semibold text-[#F2EEE6]/40 tracking-wide">Cover image URL</label>
                <input type="url" [(ngModel)]="form.meetup_img_url" placeholder="https://..."
                       class="w-full bg-[#16161c] border border-white/7 rounded-xl text-[#F2EEE6]
                              text-[0.82rem] px-3 py-2.5 outline-none placeholder-[#F2EEE6]/20
                              focus:border-[#F0B429]/45 transition-colors"/>
              </div>

              @if (formError()) {
                <p class="text-[0.76rem] text-[#FF4433] bg-[#FF4433]/8 border border-[#FF4433]/20
                           rounded-xl px-3 py-2.5 m-0">{{ formError() }}</p>
              }
            </div>

            <!-- Footer -->
            <div class="px-6 pb-6 pt-4 flex items-center justify-end gap-2.5
                        border-t border-white/7">
              <button (click)="closeModal()"
                      class="px-4 py-2 rounded-xl text-[0.8rem] bg-transparent cursor-pointer
                             border border-white/7 text-[#F2EEE6]/40
                             hover:border-white/12 hover:text-[#F2EEE6] transition-all">
                Cancel
              </button>
              <button (click)="submitForm()" [disabled]="saving()"
                      class="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[0.82rem] font-bold
                             bg-[#F0B429] text-[#1a0f00] border-none cursor-pointer
                             hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                @if (saving()) {
                  <span class="w-3.5 h-3.5 rounded-full border-2 border-[#1a0f00]/30
                               border-t-[#1a0f00] animate-spin"></span>
                  Saving…
                } @else {
                  {{ modalMode() === 'create' ? 'Create Meetup' : 'Save Changes' }}
                }
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes popIn   { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: none; } }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(12px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    .slide-up  { animation: slideUp .4s cubic-bezier(.22,1,.36,1) both; }
    .fade-in   { animation: fadeIn .2s ease; }
    .pop-in    { animation: popIn .28s cubic-bezier(.22,1,.36,1); }
    .toast-in  { animation: toastIn .3s cubic-bezier(.22,1,.36,1); }
    .skeleton-shimmer {
      background: linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);
      background-size: 600px 100%;
      animation: shimmer 1.5s ease-in-out infinite;
    }
  `],
})
export class MyCreatedMeetupsPage implements OnInit, OnDestroy {
  readonly router         = inject(Router);
  private readonly svc    = inject(MeetupService);
  private readonly auth   = inject(AuthService);
  private readonly catSvc = inject(CategoryService);
  private readonly d$     = new Subject<void>();

  meetups           = signal<Meetup[]>([]);
  loading           = signal(true);
  error             = signal(false);
  categories        = signal<Category[]>([]);
  categoriesLoading = signal(false);
  categoriesError   = signal(false);
  modalOpen         = signal(false);
  modalMode         = signal<ModalMode>('create');
  editTarget        = signal<Meetup | null>(null);
  form              = emptyForm();
  saving            = signal(false);
  formError         = signal<string | null>(null);
  deleteTarget      = signal<Meetup | null>(null);
  deletingId        = signal<number | null>(null);
  toast             = signal<{ msg: string; type: 'success' | 'error' } | null>(null);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly skeletons  = Array.from({ length: 3 }, (_, i) => i);
  readonly fmtDate    = fmtDate;
  readonly fmtTime    = fmtTime;
  readonly isUpcoming = isUpcoming;

  sorted = computed(() =>
    [...this.meetups()].sort((a, b) => +new Date(b.start_Time) - +new Date(a.start_Time))
  );

  ngOnInit()    { this.load(); this.loadCategories(); }
  ngOnDestroy() {
    this.d$.next(); this.d$.complete();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  load() {
    const userId = this.auth.getUserProfile()?.id;
    if (!userId) { this.loading.set(false); return; }
    this.loading.set(true); this.error.set(false);
    this.svc.getCreatedByUser(userId).pipe(
      catchError(() => { this.error.set(true); this.loading.set(false); return of([] as Meetup[]); }),
      takeUntil(this.d$),
    ).subscribe(list => { this.meetups.set(list); this.loading.set(false); });
  }

  loadCategories() {
    if (this.categories().length) return;
    this.categoriesLoading.set(true); this.categoriesError.set(false);
    this.catSvc.getAllCategories().pipe(
      catchError(() => { this.categoriesError.set(true); this.categoriesLoading.set(false); return of([] as Category[]); }),
      takeUntil(this.d$),
    ).subscribe(cats => { this.categories.set(cats); this.categoriesLoading.set(false); });
  }

  openCreate() {
    this.form = emptyForm(); this.editTarget.set(null);
    this.modalMode.set('create'); this.formError.set(null);
    this.modalOpen.set(true); this.loadCategories();
  }

  openEdit(m: Meetup) {
    this.form = {
      title: m.title ?? '', start_Time: toInputDt(m.start_Time), end_Time: toInputDt(m.end_Time),
      maxAttendees: m.maxAttendees != null ? String(m.maxAttendees) : '',
      description: m.description ?? '', city: m.city ?? '', region: m.region ?? '',
      street: m.street ?? '', nameOfPlace: m.nameOfPlace ?? '', online_url: m.online_url ?? '',
      meetup_img_url: m.meetup_img_url ?? '', locationType: m.meetup_location_type,
      categoryId: m.categoryId ?? null,
    };
    this.editTarget.set(m); this.modalMode.set('edit');
    this.formError.set(null); this.modalOpen.set(true); this.loadCategories();
  }

  closeModal() { if (this.saving()) return; this.modalOpen.set(false); }

  submitForm() {
    if (!this.form.title.trim()) { this.formError.set('Title is required.');           return; }
    if (!this.form.start_Time)   { this.formError.set('Start date/time is required.'); return; }
    if (!this.form.end_Time)     { this.formError.set('End date/time is required.');   return; }
    if (!this.form.categoryId)   { this.formError.set('Please select a category.');    return; }

    const userId = this.auth.getUserProfile()?.id;
    if (!userId) { this.formError.set('Session expired — please log in again.'); return; }

    this.formError.set(null); this.saving.set(true);
    const maxAtt = this.form.maxAttendees ? parseInt(this.form.maxAttendees, 10) : null;

    if (this.modalMode() === 'create') {
      const dto: CreateMeetupDto = {
        title:                this.form.title.trim(),
        start_Time:           new Date(this.form.start_Time).toISOString(),
        end_Time:             new Date(this.form.end_Time).toISOString(),
        max_Participants:     maxAtt && !isNaN(maxAtt) ? maxAtt : null,
        description:          this.form.description.trim() || null,
        city:                 this.form.city.trim() || null,
        region:               this.form.region.trim() || null,
        street:               this.form.street.trim() || null,
        nameOfPlace:          this.form.nameOfPlace.trim() || null,
        online_url:           this.form.online_url.trim() || null,
        meetup_img_url:       this.form.meetup_img_url.trim() || null,
        meetup_location_type: this.form.locationType,
        categoryId:           this.form.categoryId!,
        managerId:            userId,
      };
      this.svc.createMeetup(dto).pipe(
        // On error: set formError, clear saving, return null
        catchError(err => {
          this.formError.set(err?.error?.message ?? 'Failed to create meetup.');
          this.saving.set(false);
          return of(null);
        }),
        takeUntil(this.d$),
      ).subscribe(res => {
        // res === null  → error handled above
        // res === true  → success
        if (!res) return;
        this.saving.set(false);
        this.modalOpen.set(false);
        this.showToast('Meetup created! 🎉', 'success');
        this.load();
      });

    } else {
      const dto: UpdateMeetupDto = {
        title:                this.form.title.trim(),
        start_Time:           new Date(this.form.start_Time).toISOString(),
        end_Time:             new Date(this.form.end_Time).toISOString(),
        maxAttendees:         maxAtt && !isNaN(maxAtt) ? maxAtt : null,
        description:          this.form.description.trim() || null,
        city:                 this.form.city.trim() || null,
        region:               this.form.region.trim() || null,
        street:               this.form.street.trim() || null,
        nameOfPlace:          this.form.nameOfPlace.trim() || null,
        online_url:           this.form.online_url.trim() || null,
        meetup_img_url:       this.form.meetup_img_url.trim() || null,
        meetup_location_type: this.form.locationType,
        categoryId:           this.form.categoryId!,
        managerId:            userId,
      };
      this.svc.updateMeetup(this.editTarget()!.id, dto).pipe(
        catchError(err => {
          this.formError.set(err?.error?.message ?? 'Failed to update meetup.');
          this.saving.set(false);
          return of(null);
        }),
        takeUntil(this.d$),
      ).subscribe(res => {
        if (!res) return;
        this.saving.set(false);
        this.modalOpen.set(false);
        this.showToast('Meetup updated ✓', 'success');
        this.load();
      });
    }
  }

  confirmDelete(m: Meetup) { this.deleteTarget.set(m); }

  doDelete() {
    const m = this.deleteTarget();
    if (!m) return;
    this.deletingId.set(m.id);
    this.svc.deleteMeetup(m.id).pipe(
      catchError(err => {
        this.showToast(err?.error?.message ?? 'Failed to delete.', 'error');
        this.deletingId.set(null);
        this.deleteTarget.set(null);
        return of(null);
      }),
      takeUntil(this.d$),
    ).subscribe(res => {
      this.deletingId.set(null);
      this.deleteTarget.set(null);
      if (!res) return;
      this.meetups.update(list => list.filter(x => x.id !== m.id));
      this.showToast(`"${m.title}" deleted.`, 'success');
    });
  }

  private showToast(msg: string, type: 'success' | 'error') {
    this.toast.set({ msg, type });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 3200);
  }
}