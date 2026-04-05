// src/app/features/user-dashboard/my-created-meetups/my-created-meetups.ts
import {
  Component, inject, signal, computed, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule   } from '@angular/forms';
import { Router }        from '@angular/router';
import { Subject, of }   from 'rxjs';
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
function attendeeCount(m: Meetup): number {
  if (m.currentAttendees !== undefined) return m.currentAttendees;
  return (m.participants ?? []).length;
}
function toDatetimeLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Shared form shape (used by both Create and Edit) ──────────────────────────

interface MeetupForm {
  title:                string;
  description:          string;
  start_Time:           string;
  end_Time:             string;
  maxAttendees:         string;
  city:                 string;
  region:               string;
  street:               string;
  nameOfPlace:          string;
  online_url:           string;
  meetup_img_url:       string;
  meetup_location_type: MeetupLocationType;
  categoryId:           number | null;
}

const blankForm = (): MeetupForm => ({
  title: '', description: '', start_Time: '', end_Time: '',
  maxAttendees: '', city: '', region: '', street: '',
  nameOfPlace: '', online_url: '', meetup_img_url: '',
  meetup_location_type: MeetupLocationType.Offline, categoryId: null,
});

type TabFilter  = 'all' | 'upcoming' | 'past';
type ModalMode  = 'create' | 'edit';

@Component({
  selector:   'app-my-created-meetups',
  standalone: true,
  imports:    [CommonModule, FormsModule],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <div class="mc-root">

      <!-- ── HERO ── -->
      <header class="mc-hero">
        <div class="mc-orb" aria-hidden="true"></div>
        <div class="mc-hero__body">
          <div class="mc-eyebrow">
            <span class="mc-tag">My Community</span>
            @if (!loading() && meetups().length > 0) {
              <span class="mc-tag mc-tag--dim">{{ meetups().length }} created</span>
            }
          </div>
          <div class="mc-hero__row">
            <div>
              <h1 class="mc-title">My <em class="mc-accent">Created</em> Meetups</h1>
              <p class="mc-sub">Meetups you've organised and published.</p>
            </div>
            <!-- ── NEW MEETUP BUTTON ── -->
            <button class="mc-new-btn" (click)="openCreate()">
              <svg width="13" height="13" fill="none" stroke="currentColor"
                   stroke-width="2.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              New Meetup
            </button>
          </div>
        </div>
      </header>

      <!-- ── FILTER TABS ── -->
      @if (!loading() && meetups().length > 0) {
        <div class="mc-tabs-wrap">
          @for (tab of tabs; track tab.value) {
            <button class="mc-tab" [class.mc-tab--on]="activeTab() === tab.value"
                    (click)="activeTab.set(tab.value)">{{ tab.label }}</button>
          }
        </div>
      }

      <!-- ── LOADING ── -->
      @if (loading()) {
        <div class="mc-list">
          @for (n of skeletons; track n) {
            <div class="mc-skel" [style.animation-delay]="n * 65 + 'ms'"></div>
          }
        </div>
      }

      <!-- ── ERROR ── -->
      @else if (error()) {
        <div class="mc-empty">
          <span class="mc-empty__ico">⚠</span>
          <p class="mc-empty__title">Couldn't load meetups</p>
          <button class="mc-btn" (click)="load()">Retry</button>
        </div>
      }

      <!-- ── TRULY EMPTY ── -->
      @else if (meetups().length === 0) {
        <div class="mc-empty">
          <div class="mc-empty__icon-wrap">
            <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.4"
                 viewBox="0 0 24 24" style="color:var(--muted)">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
          </div>
          <p class="mc-empty__title">No meetups created yet</p>
          <p class="mc-empty__sub">Start organising your own community gathering.</p>
          <button class="mc-btn" (click)="openCreate()">Create a Meetup</button>
        </div>
      }

      <!-- ── FILTERED EMPTY ── -->
      @else if (filtered().length === 0) {
        <div class="mc-empty mc-empty--sm">
          <p class="mc-empty__title">No {{ activeTab() }} meetups</p>
        </div>
      }

      <!-- ── LIST ── -->
      @else {
        <div class="mc-list">
          @for (m of filtered(); track m.id; let i = $index) {
            <div class="mc-card" [class.mc-card--past]="!isUpcoming(m.start_Time)"
                 [style.animation-delay]="i * 50 + 'ms'">

              @if (m.meetup_img_url) {
                <div class="mc-card__img-wrap">
                  <img [src]="m.meetup_img_url" [alt]="m.title ?? ''"
                       class="mc-card__img" loading="lazy"/>
                  <div class="mc-card__img-scrim"></div>
                </div>
              }

              <div class="mc-card__body">
                <div class="mc-card__left">

                  <div class="mc-badges">
                    @if (m.category?.name) {
                      <span class="mc-badge mc-badge--cat">{{ m.category!.name }}</span>
                    }
                    <span class="mc-badge" [class.mc-badge--online]="m.meetup_location_type === 1">
                      {{ m.meetup_location_type === 1 ? 'Online' : 'In-Person' }}
                    </span>
                    @if (isUpcoming(m.start_Time)) {
                      <span class="mc-badge mc-badge--upcoming">
                        <span class="mc-dot"></span> Upcoming
                      </span>
                    } @else {
                      <span class="mc-badge mc-badge--past-badge">Past</span>
                    }
                    <span class="mc-badge mc-badge--owner">
                      <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                      </svg>
                      Organiser
                    </span>
                  </div>

                  <h3 class="mc-card__title">{{ m.title }}</h3>

                  @if (m.description) {
                    <p class="mc-card__desc">{{ m.description }}</p>
                  }

                  <div class="mc-card__meta-list">
                    @if (m.start_Time) {
                      <div class="mc-card__meta">
                        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        {{ fmtDate(m.start_Time) }} · {{ fmtTime(m.start_Time) }}
                        @if (m.end_Time) { → {{ fmtTime(m.end_Time) }} }
                      </div>
                    }
                    @if (m.nameOfPlace || m.city) {
                      <div class="mc-card__meta">
                        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        {{ m.nameOfPlace || m.city }}
                      </div>
                    }
                    @if (m.online_url && m.meetup_location_type === 1) {
                      <div class="mc-card__meta">
                        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                        </svg>
                        <a [href]="m.online_url" target="_blank" rel="noopener" class="mc-card__link">Join online</a>
                      </div>
                    }
                  </div>
                </div>

                <!-- Right: stats + actions -->
                <div class="mc-card__right">
                  <div class="mc-stat">
                    <span class="mc-stat__num">{{ attendeeCount(m) }}</span>
                    @if (m.maxAttendees) {
                      <span class="mc-stat__max"> / {{ m.maxAttendees }}</span>
                    }
                    <span class="mc-stat__label">attendees</span>
                  </div>

                  @if (m.maxAttendees) {
                    <div class="mc-bar-wrap">
                      <div class="mc-bar-fill"
                           [style.width.%]="capacityPct(m)"
                           [class.mc-bar-fill--full]="m.isFull"></div>
                    </div>
                  }

                  @if (m.isFull) {
                    <span class="mc-status-pill mc-status-pill--full">Full</span>
                  } @else {
                    <span class="mc-status-pill mc-status-pill--open">Open</span>
                  }

                  <div class="mc-actions">
                    <button class="mc-action-btn mc-action-btn--edit"
                            [disabled]="deletingId() === m.id"
                            (click)="openEdit(m)">
                      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                      Edit
                    </button>
                    <button class="mc-action-btn mc-action-btn--delete"
                            [disabled]="deletingId() === m.id"
                            (click)="confirmDelete(m)">
                      @if (deletingId() === m.id) {
                        <span class="mc-spinner"></span>
                      } @else {
                        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
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

      <div style="height:3rem"></div>
    </div>

    <!-- ════════════════════════════════════════════════
         DELETE CONFIRM MODAL
    ════════════════════════════════════════════════ -->
    @if (deleteTarget()) {
      <div class="mc-overlay" (click)="cancelDelete()">
        <div class="mc-modal" (click)="$event.stopPropagation()">
          <h2 class="mc-modal__title">Delete Meetup?</h2>
          <p class="mc-modal__body">
            "<strong>{{ deleteTarget()!.title }}</strong>" will be permanently removed.
            This action cannot be undone.
          </p>
          <div class="mc-modal__footer">
            <button class="mc-modal-btn mc-modal-btn--cancel" (click)="cancelDelete()">Cancel</button>
            <button class="mc-modal-btn mc-modal-btn--confirm"
                    [disabled]="deletingId() !== null"
                    (click)="executeDelete()">
              @if (deletingId() !== null) { <span class="mc-spinner mc-spinner--light"></span> }
              @else { Delete }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ════════════════════════════════════════════════
         CREATE / EDIT MODAL  (shared UI, different mode)
    ════════════════════════════════════════════════ -->
    @if (modalOpen()) {
      <div class="mc-overlay" (click)="closeModal()">
        <div class="mc-modal mc-modal--wide" (click)="$event.stopPropagation()"
             role="dialog"
             [attr.aria-label]="modalMode() === 'create' ? 'Create Meetup' : 'Edit Meetup'">

          <!-- Header -->
          <div class="mc-modal__header">
            <h2 class="mc-modal__title">
              {{ modalMode() === 'create' ? 'New Meetup' : 'Edit Meetup' }}
            </h2>
            <button class="mc-modal__close" (click)="closeModal()" aria-label="Close">
              <svg width="16" height="16" fill="none" stroke="currentColor"
                   stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Form body -->
          <div class="mc-form">

            <!-- Title -->
            <label class="mc-label">Title *
              <input class="mc-input" [(ngModel)]="form.title" placeholder="e.g. Cairo JS Monthly"/>
            </label>

            <!-- Description -->
            <label class="mc-label">Description
              <textarea class="mc-input mc-textarea" [(ngModel)]="form.description"
                        placeholder="What's this meetup about?" rows="3"></textarea>
            </label>

            <!-- Dates row -->
            <div class="mc-row">
              <label class="mc-label">Start *
                <input class="mc-input" type="datetime-local" [(ngModel)]="form.start_Time"
                       style="color-scheme:dark"/>
              </label>
              <label class="mc-label">End *
                <input class="mc-input" type="datetime-local" [(ngModel)]="form.end_Time"
                       style="color-scheme:dark"/>
              </label>
            </div>

            <!-- Location type -->
            <label class="mc-label">Location type *
              <div class="mc-type-btns">
                <button type="button"
                        (click)="form.meetup_location_type = 0"
                        [class.mc-type-btn--on]="form.meetup_location_type === 0"
                        class="mc-type-btn">
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  In-Person
                </button>
                <button type="button"
                        (click)="form.meetup_location_type = 1"
                        [class.mc-type-btn--on]="form.meetup_location_type === 1"
                        class="mc-type-btn">
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  Online
                </button>
              </div>
            </label>

            <!-- In-person location fields -->
            @if (form.meetup_location_type === 0) {
              <div class="mc-row">
                <label class="mc-label">Venue name
                  <input class="mc-input" [(ngModel)]="form.nameOfPlace" placeholder="Tech Hub Cairo"/>
                </label>
                <label class="mc-label">City
                  <input class="mc-input" [(ngModel)]="form.city" placeholder="Cairo"/>
                </label>
              </div>
              <div class="mc-row">
                <label class="mc-label">Region
                  <input class="mc-input" [(ngModel)]="form.region" placeholder="Cairo Governorate"/>
                </label>
                <label class="mc-label">Street
                  <input class="mc-input" [(ngModel)]="form.street" placeholder="123 Tahrir Square"/>
                </label>
              </div>
            }

            <!-- Online URL -->
            @if (form.meetup_location_type === 1) {
              <label class="mc-label">Meeting URL
                <input class="mc-input" [(ngModel)]="form.online_url"
                       placeholder="https://meet.google.com/..."/>
              </label>
            }

            <!-- Category + max attendees -->
            <div class="mc-row">
              <label class="mc-label">Category *
                @if (catsLoading()) {
                  <div class="mc-input mc-input--skel"></div>
                } @else if (catsError()) {
                  <button class="mc-input mc-input--err" (click)="loadCategories()">
                    Failed to load — tap to retry
                  </button>
                } @else {
                  <select class="mc-input mc-select" [(ngModel)]="form.categoryId">
                    <option [ngValue]="null" disabled>Select category…</option>
                    @for (c of categories(); track c.id) {
                      <option [ngValue]="c.id" class="bg-[#111116]">{{ c.name }}</option>
                    }
                  </select>
                }
              </label>
              <label class="mc-label">Max attendees
                <input class="mc-input" type="number" min="1"
                       [(ngModel)]="form.maxAttendees" placeholder="Unlimited"/>
              </label>
            </div>

            <!-- Cover image -->
            <label class="mc-label">Cover image URL
              <input class="mc-input" [(ngModel)]="form.meetup_img_url"
                     placeholder="https://example.com/image.jpg"/>
            </label>

          </div><!-- /mc-form -->

          @if (formError()) {
            <p class="mc-form-error">{{ formError() }}</p>
          }

          <!-- Footer -->
          <div class="mc-modal__footer">
            <button class="mc-modal-btn mc-modal-btn--cancel" (click)="closeModal()">Cancel</button>
            <button class="mc-modal-btn mc-modal-btn--save"
                    [disabled]="saving()"
                    (click)="submitForm()">
              @if (saving()) { <span class="mc-spinner mc-spinner--dark"></span> }
              @else { {{ modalMode() === 'create' ? 'Create Meetup' : 'Save Changes' }} }
            </button>
          </div>

        </div>
      </div>
    }

    <!-- ── TOAST ── -->
    @if (toast()) {
      <div class="mc-toast" [class.mc-toast--error]="toast()!.type === 'error'"
           role="status" aria-live="polite">
        {{ toast()!.msg }}
      </div>
    }
  `,
  styles: [`
    :host {
      --gold:  #F0B429; --coral: #FF4433; --green: #22c55e;
      --bg:    #060608; --bg2:  #09090c;  --bg3: #111116; --bg4: #16161b;
      --text:  #F2EEE6; --muted: rgba(242,238,230,.42);
      --bdr:   rgba(242,238,230,.07); --bdrhi: rgba(242,238,230,.12);
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: block; background: var(--bg); color: var(--text); min-height: 100%;
    }

    /* ── Hero ── */
    .mc-hero { position:relative;overflow:hidden;padding:2.5rem 1.75rem 2rem; }
    .mc-orb {
      position:absolute;width:360px;height:360px;top:-140px;right:-80px;border-radius:50%;
      pointer-events:none;z-index:0;
      background:radial-gradient(circle,rgba(240,180,41,.08) 0%,transparent 65%);
    }
    .mc-hero__body { position:relative;z-index:1; }
    .mc-hero__row  { display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap; }
    .mc-eyebrow    { display:flex;gap:.5rem;margin-bottom:.9rem; }
    .mc-tag {
      display:inline-flex;align-items:center;padding:3px 10px;border-radius:100px;
      font-family:'DM Mono',monospace;font-size:.59rem;letter-spacing:.12em;text-transform:uppercase;
      background:rgba(240,180,41,.1);border:1px solid rgba(240,180,41,.25);color:var(--gold);
    }
    .mc-tag--dim { background:rgba(242,238,230,.05);border-color:var(--bdr);color:var(--muted); }
    .mc-title {
      font-family:'Bebas Neue',sans-serif;font-size:clamp(2.6rem,7vw,4.6rem);
      letter-spacing:.03em;line-height:.9;color:var(--text);margin:0 0 .65rem;
    }
    .mc-accent { color:var(--gold);font-style:normal; }
    .mc-sub { font-size:.84rem;color:var(--muted);margin:0;font-weight:300;line-height:1.6; }

    /* ── New meetup button ── */
    .mc-new-btn {
      display:inline-flex;align-items:center;gap:.45rem;
      padding:.55rem 1.2rem;border-radius:12px;border:none;cursor:pointer;
      background:var(--gold);color:#3d2800;font-family:inherit;font-weight:700;font-size:.84rem;
      transition:opacity .2s,transform .2s;flex-shrink:0;margin-top:.25rem;
    }
    .mc-new-btn:hover { opacity:.88;transform:translateY(-1px); }

    /* ── Tabs ── */
    .mc-tabs-wrap { display:flex;gap:.4rem;padding:0 1.75rem 1.25rem;flex-wrap:wrap; }
    .mc-tab {
      padding:.38rem .9rem;border-radius:100px;
      background:var(--bg3);border:1px solid var(--bdr);
      color:var(--muted);font-size:.8rem;font-weight:500;cursor:pointer;transition:all .2s;
    }
    .mc-tab:hover  { border-color:var(--bdrhi);color:var(--text); }
    .mc-tab--on    { background:rgba(240,180,41,.1);border-color:rgba(240,180,41,.3)!important;color:var(--gold)!important;font-weight:700; }

    /* ── List ── */
    .mc-list { display:flex;flex-direction:column;gap:.85rem;padding:0 1.75rem; }

    /* ── Card ── */
    .mc-card {
      background:var(--bg2);border:1px solid var(--bdr);border-radius:16px;overflow:hidden;
      transition:border-color .2s,box-shadow .22s;
      animation:slideUp .4s cubic-bezier(.22,1,.36,1) both;
    }
    @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
    .mc-card:hover     { border-color:var(--bdrhi);box-shadow:0 8px 28px rgba(0,0,0,.35); }
    .mc-card--past     { opacity:.65; }
    .mc-card--past:hover { opacity:1; }

    .mc-card__img-wrap  { position:relative;height:110px;overflow:hidden; }
    .mc-card__img       { width:100%;height:100%;object-fit:cover; }
    .mc-card__img-scrim { position:absolute;inset:0;background:linear-gradient(to top,rgba(9,9,12,.8) 0%,transparent 60%); }

    .mc-card__body { display:flex;align-items:flex-start;gap:1rem;padding:1rem 1.1rem; }
    .mc-card__left { flex:1;min-width:0;display:flex;flex-direction:column;gap:.5rem; }

    /* ── Badges ── */
    .mc-badges { display:flex;gap:.35rem;flex-wrap:wrap; }
    .mc-badge {
      display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;
      font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;
      background:rgba(242,238,230,.06);border:1px solid var(--bdr);color:var(--muted);
    }
    .mc-badge--cat      { color:var(--green);background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.2); }
    .mc-badge--online   { color:#0ea5e9;background:rgba(14,165,233,.08);border-color:rgba(14,165,233,.2); }
    .mc-badge--upcoming { color:var(--green);background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.2); }
    .mc-badge--past-badge { color:var(--muted);opacity:.7; }
    .mc-badge--owner    { color:var(--gold);background:rgba(240,180,41,.08);border-color:rgba(240,180,41,.22); }
    .mc-dot { width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 1.4s ease-in-out infinite; }
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.6)}}

    .mc-card__title { font-family:'Bebas Neue',sans-serif;font-size:1.15rem;letter-spacing:.04em;color:var(--text);margin:0;line-height:1.1; }
    .mc-card__desc  {
      font-size:.76rem;color:var(--muted);line-height:1.55;margin:0;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    }
    .mc-card__meta-list { display:flex;flex-direction:column;gap:.3rem; }
    .mc-card__meta      { display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:var(--muted); }
    .mc-card__meta svg  { flex-shrink:0;opacity:.6; }
    .mc-card__link      { color:#0ea5e9;text-decoration:none; }
    .mc-card__link:hover{ text-decoration:underline; }

    /* ── Right panel ── */
    .mc-card__right {
      display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;
      gap:.6rem;flex-shrink:0;min-width:96px;
    }
    .mc-stat       { text-align:right;display:flex;align-items:baseline;gap:2px;flex-wrap:wrap;justify-content:flex-end; }
    .mc-stat__num  { font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:.04em;color:var(--gold);line-height:1; }
    .mc-stat__max  { font-size:.7rem;color:var(--muted); }
    .mc-stat__label{ width:100%;text-align:right;font-family:'DM Mono',monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted); }

    .mc-bar-wrap       { width:80px;height:4px;border-radius:2px;background:rgba(242,238,230,.08);overflow:hidden; }
    .mc-bar-fill       { height:100%;border-radius:2px;background:var(--gold);transition:width .4s ease; }
    .mc-bar-fill--full { background:var(--coral); }

    .mc-status-pill      { display:inline-flex;align-items:center;padding:3px 10px;border-radius:100px;font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase; }
    .mc-status-pill--open{ background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);color:var(--green); }
    .mc-status-pill--full{ background:rgba(255,68,51,.1);border:1px solid rgba(255,68,51,.25);color:var(--coral); }

    .mc-actions { display:flex;flex-direction:column;gap:.35rem;width:100%; }
    .mc-action-btn {
      display:inline-flex;align-items:center;justify-content:center;gap:.35rem;
      width:100%;padding:.35rem .6rem;border-radius:8px;
      font-size:.72rem;font-weight:600;cursor:pointer;border:1px solid;
      transition:background .18s,opacity .18s;
    }
    .mc-action-btn:disabled                     { opacity:.4;cursor:not-allowed; }
    .mc-action-btn--edit                        { background:rgba(240,180,41,.08);border-color:rgba(240,180,41,.25);color:var(--gold); }
    .mc-action-btn--edit:hover:not(:disabled)   { background:rgba(240,180,41,.16); }
    .mc-action-btn--delete                      { background:rgba(255,68,51,.07);border-color:rgba(255,68,51,.22);color:var(--coral); }
    .mc-action-btn--delete:hover:not(:disabled) { background:rgba(255,68,51,.15); }

    /* ── Skeleton ── */
    .mc-skel {
      height:120px;border-radius:16px;
      background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);
      background-size:600px 100%;animation:shimmer 1.5s ease-in-out infinite;
    }
    @keyframes shimmer{from{background-position:-600px 0}to{background-position:600px 0}}

    /* ── Empty ── */
    .mc-empty     { display:flex;flex-direction:column;align-items:center;gap:.75rem;padding:5rem 1rem;text-align:center; }
    .mc-empty--sm { padding:2rem 1rem; }
    .mc-empty__icon-wrap { width:56px;height:56px;border-radius:16px;background:var(--bg3);border:1px solid var(--bdrhi);display:flex;align-items:center;justify-content:center; }
    .mc-empty__ico   { font-size:2.5rem; }
    .mc-empty__title { font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:.04em;color:var(--text);margin:0; }
    .mc-empty__sub   { font-size:.84rem;color:var(--muted);margin:0;font-weight:300; }
    .mc-btn { padding:.6rem 1.5rem;border-radius:10px;background:var(--gold);color:#3d2800;border:none;font-weight:700;font-size:.85rem;cursor:pointer; }

    /* ── Overlay ── */
    .mc-overlay {
      position:fixed;inset:0;z-index:100;
      background:rgba(6,6,8,.75);backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;padding:1rem;
      animation:fadeIn .2s ease;
    }
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}

    /* ── Modal ── */
    .mc-modal {
      background:var(--bg2);border:1px solid var(--bdrhi);border-radius:20px;
      padding:1.75rem;width:100%;max-width:420px;
      animation:slideUp .3s cubic-bezier(.22,1,.36,1);
    }
    .mc-modal--wide    { max-width:640px;max-height:90vh;overflow-y:auto; }
    .mc-modal__header  { display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem; }
    .mc-modal__title   { font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:.04em;margin:0; }
    .mc-modal__close   { background:none;border:none;color:var(--muted);cursor:pointer;padding:.25rem;border-radius:6px;transition:color .15s; }
    .mc-modal__close:hover { color:var(--text); }
    .mc-modal__body    { font-size:.88rem;color:var(--muted);line-height:1.6;margin-bottom:1.5rem; }
    .mc-modal__footer  { display:flex;justify-content:flex-end;gap:.6rem;margin-top:1.5rem; }

    .mc-modal-btn { padding:.55rem 1.3rem;border-radius:10px;font-weight:700;font-size:.84rem;cursor:pointer;border:1px solid;display:inline-flex;align-items:center;gap:.4rem;transition:opacity .15s; }
    .mc-modal-btn:disabled           { opacity:.5;cursor:not-allowed; }
    .mc-modal-btn--cancel            { background:transparent;border-color:var(--bdrhi);color:var(--muted); }
    .mc-modal-btn--cancel:hover      { color:var(--text); }
    .mc-modal-btn--confirm           { background:rgba(255,68,51,.12);border-color:rgba(255,68,51,.3);color:var(--coral); }
    .mc-modal-btn--confirm:hover:not(:disabled) { background:rgba(255,68,51,.22); }
    .mc-modal-btn--save              { background:var(--gold);border-color:var(--gold);color:#3d2800; }
    .mc-modal-btn--save:hover:not(:disabled)    { opacity:.88; }

    /* ── Form ── */
    .mc-form { display:flex;flex-direction:column;gap:.85rem; }
    .mc-label {
      display:flex;flex-direction:column;gap:.35rem;
      font-size:.78rem;font-weight:600;color:var(--muted);
    }
    .mc-input {
      background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;
      color:var(--text);font-family:inherit;font-size:.84rem;
      padding:.55rem .75rem;outline:none;transition:border-color .15s;
      width:100%;box-sizing:border-box;
    }
    .mc-input:focus       { border-color:rgba(240,180,41,.4); }
    .mc-input--skel       { height:38px;background:linear-gradient(90deg,rgba(242,238,230,.04) 25%,rgba(242,238,230,.07) 50%,rgba(242,238,230,.04) 75%);background-size:400px 100%;animation:shimmer 1.5s ease-in-out infinite; }
    .mc-input--err        { color:var(--coral);border-color:rgba(255,68,51,.3);background:rgba(255,68,51,.06);cursor:pointer;text-align:left; }
    .mc-textarea          { resize:vertical;min-height:72px; }
    .mc-select            { appearance:none;cursor:pointer; }
    .mc-row               { display:grid;grid-template-columns:1fr 1fr;gap:.75rem; }
    .mc-form-error        { font-size:.78rem;color:var(--coral);margin:.25rem 0 0; }

    /* ── Location type toggle ── */
    .mc-type-btns { display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.1rem; }
    .mc-type-btn  {
      display:flex;align-items:center;justify-content:center;gap:.4rem;
      padding:.55rem .75rem;border-radius:10px;border:1px solid var(--bdr);
      background:var(--bg3);color:var(--muted);font-size:.8rem;font-weight:600;
      cursor:pointer;transition:all .18s;
    }
    .mc-type-btn:hover    { border-color:var(--bdrhi);color:var(--text); }
    .mc-type-btn--on      { background:rgba(240,180,41,.1);border-color:rgba(240,180,41,.35);color:var(--gold); }

    /* ── Spinner ── */
    .mc-spinner { display:inline-block;width:13px;height:13px;border-radius:50%;border:2px solid rgba(255,68,51,.3);border-top-color:var(--coral);animation:spin .7s linear infinite; }
    .mc-spinner--light { border-color:rgba(61,40,0,.25);border-top-color:#3d2800; }
    .mc-spinner--dark  { border-color:rgba(61,40,0,.25);border-top-color:#3d2800; }
    @keyframes spin{to{transform:rotate(360deg)}}

    /* ── Toast ── */
    .mc-toast {
      position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);
      padding:.65rem 1.25rem;border-radius:12px;font-size:.82rem;font-weight:600;
      white-space:nowrap;z-index:200;
      background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:var(--green);
      animation:toastIn .3s cubic-bezier(.22,1,.36,1);
    }
    .mc-toast--error { background:rgba(255,68,51,.12);border-color:rgba(255,68,51,.3);color:var(--coral); }
    @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

    @media(max-width:640px){
      .mc-hero { padding:1.75rem 1.1rem 1.5rem; }
      .mc-tabs-wrap,.mc-list { padding-inline:1.1rem; }
      .mc-row { grid-template-columns:1fr; }
      .mc-hero__row { flex-direction:column; }
    }
  `],
})
export class MyCreatedMeetupsPage implements OnInit, OnDestroy {
  readonly router         = inject(Router);
  private readonly svc    = inject(MeetupService);
  private readonly auth   = inject(AuthService);
  private readonly catSvc = inject(CategoryService);
  private readonly d$     = new Subject<void>();

  // ── List state ────────────────────────────────────────────────────────────
  meetups   = signal<Meetup[]>([]);
  loading   = signal(true);
  error     = signal(false);
  activeTab = signal<TabFilter>('all');

  // ── Delete state ──────────────────────────────────────────────────────────
  deleteTarget = signal<Meetup | null>(null);
  deletingId   = signal<number | null>(null);

  // ── Shared modal state ────────────────────────────────────────────────────
  modalOpen  = signal(false);
  modalMode  = signal<ModalMode>('create');
  editTarget = signal<Meetup | null>(null);   // null when creating
  form: MeetupForm = blankForm();
  saving     = signal(false);
  formError  = signal<string | null>(null);

  // ── Category state ────────────────────────────────────────────────────────
  categories  = signal<Category[]>([]);
  catsLoading = signal(false);
  catsError   = signal(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast = signal<{ msg: string; type: 'success' | 'error' } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly skeletons     = Array.from({ length: 3 }, (_, i) => i);
  readonly fmtDate       = fmtDate;
  readonly fmtTime       = fmtTime;
  readonly isUpcoming    = isUpcoming;
  readonly attendeeCount = attendeeCount;

  readonly tabs: { label: string; value: TabFilter }[] = [
    { label: 'All',      value: 'all'      },
    { label: 'Upcoming', value: 'upcoming' },
    { label: 'Past',     value: 'past'     },
  ];

  filtered = computed(() => {
    const t = this.activeTab(), list = this.meetups();
    if (t === 'upcoming') return list.filter(m =>  isUpcoming(m.start_Time));
    if (t === 'past')     return list.filter(m => !isUpcoming(m.start_Time));
    return list;
  });

  capacityPct(m: Meetup): number {
    if (!m.maxAttendees) return 0;
    return Math.min(100, Math.round((attendeeCount(m) / m.maxAttendees) * 100));
  }

  ngOnInit()    { this.load(); }
  ngOnDestroy() {
    this.d$.next(); this.d$.complete();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  load() {
    const userId = this.auth.getUserProfile()?.id;
    if (!userId) { this.loading.set(false); return; }

    this.loading.set(true);
    this.error.set(false);

    this.svc.getCreatedByUser(userId).pipe(
      catchError(() => { this.error.set(true); this.loading.set(false); return of([] as Meetup[]); }),
      takeUntil(this.d$),
    ).subscribe(list => {
      this.meetups.set([...list].sort((a, b) => +new Date(b.start_Time) - +new Date(a.start_Time)));
      this.loading.set(false);
    });
  }

  loadCategories() {
    if (this.categories().length) return;   // already loaded
    this.catsLoading.set(true);
    this.catsError.set(false);
    this.catSvc.getAllCategories().pipe(
      catchError(() => { this.catsError.set(true); this.catsLoading.set(false); return of([] as Category[]); }),
      takeUntil(this.d$),
    ).subscribe(cats => { this.categories.set(cats); this.catsLoading.set(false); });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  confirmDelete(m: Meetup)   { this.deleteTarget.set(m); }
  cancelDelete()             { this.deleteTarget.set(null); }

  executeDelete() {
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
      if (!res) return;
      this.meetups.update(list => list.filter(x => x.id !== m.id));
      this.deletingId.set(null);
      this.deleteTarget.set(null);
      this.showToast(`"${m.title}" has been deleted.`, 'success');
    });
  }

  // ── Modal: open / close ───────────────────────────────────────────────────

  openCreate() {
    this.form = blankForm();
    this.formError.set(null);
    this.editTarget.set(null);
    this.modalMode.set('create');
    this.modalOpen.set(true);
    this.loadCategories();
  }

  openEdit(m: Meetup) {
    this.form = {
      title:                m.title ?? '',
      description:          m.description ?? '',
      start_Time:           toDatetimeLocal(m.start_Time),
      end_Time:             toDatetimeLocal(m.end_Time),
      maxAttendees:         m.maxAttendees != null ? String(m.maxAttendees) : '',
      city:                 m.city ?? '',
      region:               m.region ?? '',
      street:               m.street ?? '',
      nameOfPlace:          m.nameOfPlace ?? '',
      online_url:           m.online_url ?? '',
      meetup_img_url:       m.meetup_img_url ?? '',
      meetup_location_type: m.meetup_location_type,
      categoryId:           m.categoryId ?? null,
    };
    this.formError.set(null);
    this.editTarget.set(m);
    this.modalMode.set('edit');
    this.modalOpen.set(true);
    this.loadCategories();
  }

  closeModal() {
    if (this.saving()) return;
    this.modalOpen.set(false);
    this.editTarget.set(null);
  }

  // ── Modal: submit ─────────────────────────────────────────────────────────

  submitForm() {
    // ── Validation ──
    if (!this.form.title.trim())  { this.formError.set('Title is required.');                return; }
    if (!this.form.start_Time)    { this.formError.set('Start date/time is required.');      return; }
    if (!this.form.end_Time)      { this.formError.set('End date/time is required.');        return; }
    if (!this.form.categoryId)    { this.formError.set('Please select a category.');         return; }

    const userId = this.auth.getUserProfile()?.id;
    if (!userId) { this.formError.set('Session expired — please log in again.'); return; }

    this.formError.set(null);
    this.saving.set(true);

    const maxAtt = this.form.maxAttendees
      ? parseInt(this.form.maxAttendees, 10) || null
      : null;

    // ── CREATE ──────────────────────────────────────────────────────────────
    if (this.modalMode() === 'create') {
      const dto: CreateMeetupDto = {
        title:                this.form.title.trim(),
        start_Time:           new Date(this.form.start_Time).toISOString(),
        end_Time:             new Date(this.form.end_Time).toISOString(),
        max_Participants:     maxAtt,
        description:          this.form.description.trim() || null,
        city:                 this.form.city.trim()         || null,
        region:               this.form.region.trim()       || null,
        street:               this.form.street.trim()       || null,
        nameOfPlace:          this.form.nameOfPlace.trim()  || null,
        online_url:           this.form.online_url.trim()   || null,
        meetup_img_url:       this.form.meetup_img_url.trim() || null,
        meetup_location_type: this.form.meetup_location_type,
        categoryId:           this.form.categoryId!,
        managerId:            userId,
      };

      this.svc.createMeetup(dto).pipe(
        catchError(err => {
          this.formError.set(err?.error?.message ?? 'Failed to create meetup.');
          this.saving.set(false);
          return of(null);
        }),
        takeUntil(this.d$),
      ).subscribe(res => {
        if (!res) return;
        this.saving.set(false);
        this.modalOpen.set(false);
        this.showToast('Meetup created! 🎉', 'success');
        this.load();   // refresh list from server
      });

    // ── EDIT ────────────────────────────────────────────────────────────────
    } else {
      const m = this.editTarget()!;
      const dto: UpdateMeetupDto = {
        title:                this.form.title.trim(),
        start_Time:           new Date(this.form.start_Time).toISOString(),
        end_Time:             new Date(this.form.end_Time).toISOString(),
        maxAttendees:         maxAtt,
        description:          this.form.description.trim() || null,
        city:                 this.form.city.trim()         || null,
        region:               this.form.region.trim()       || null,
        street:               this.form.street.trim()       || null,
        nameOfPlace:          this.form.nameOfPlace.trim()  || null,
        online_url:           this.form.online_url.trim()   || null,
        meetup_img_url:       this.form.meetup_img_url.trim() || null,
        meetup_location_type: this.form.meetup_location_type,
        categoryId:           this.form.categoryId!,
        managerId:            m.managerId,
      };

      this.svc.updateMeetup(m.id, dto).pipe(
        catchError(err => {
          this.formError.set(err?.error?.message ?? 'Failed to save changes.');
          this.saving.set(false);
          return of(null);
        }),
        takeUntil(this.d$),
      ).subscribe(res => {
        if (!res) return;

        // Patch the local list in-place (no extra HTTP call)
        this.meetups.update(list =>
          list.map(x => x.id !== m.id ? x : {
            ...x,
            title:                dto.title,
            description:          dto.description ?? null,
            start_Time:           dto.start_Time,
            end_Time:             dto.end_Time,
            maxAttendees:         dto.maxAttendees ?? null,
            city:                 dto.city ?? null,
            region:               dto.region ?? null,
            street:               dto.street ?? null,
            nameOfPlace:          dto.nameOfPlace ?? null,
            online_url:           dto.online_url ?? null,
            meetup_img_url:       dto.meetup_img_url ?? null,
            meetup_location_type: dto.meetup_location_type,
          })
        );

        this.saving.set(false);
        this.modalOpen.set(false);
        this.editTarget.set(null);
        this.showToast(`"${dto.title}" updated ✏️`, 'success');
      });
    }
  }

  // ── Toast helper ──────────────────────────────────────────────────────────

  private showToast(msg: string, type: 'success' | 'error') {
    this.toast.set({ msg, type });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }
}