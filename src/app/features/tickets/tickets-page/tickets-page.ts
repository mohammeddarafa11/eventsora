// src/app/features/tickets/tickets-page/tickets-page.ts
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
  type AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, Validators, FormGroup, FormControl } from '@angular/forms';
import { TicketService, TicketTemplate, TicketTier, CreateTemplateDto } from '@core/services/ticket.service';
import { AuthService } from '@core/services/auth.service';
import { ZardDialogModule } from '@shared/components/dialog/dialog.component';
import { Z_MODAL_DATA, ZardDialogService } from '@shared/components/dialog/dialog.service';
import { ZardInputDirective } from '@shared/components/input/input.directive';
import { ZardSelectItemComponent } from '@shared/components/select/select-item.component';
import { ZardSelectComponent } from '@shared/components/select/select.component';
import { ZardIconComponent } from '@shared/components/icon/icon.component';
import { ZardBadgeComponent } from '@shared/components/badge/badge.component';
import { ZardButtonComponent } from '@shared/components/button/button.component';
import { ZARD_ICONS } from '@shared/components/icon/icons';
type ZardIcon = keyof typeof ZARD_ICONS;

// ─── Tier Meta ────────────────────────────────────────────────────────────────
interface TierMeta {
  label: string;
  icon: ZardIcon;
  badgeType: 'default' | 'secondary' | 'outline' | 'destructive';
  accent: string;
  accentDim: string;
  accentBorder: string;
}

const TIER_META: Record<number, TierMeta> = {
  0: {
    label: 'Standard',
    icon: 'ticket' as ZardIcon,
    badgeType: 'secondary',
    accent: '#10b981',
    accentDim: 'rgba(16,185,129,.1)',
    accentBorder: 'rgba(16,185,129,.22)',
  },
  1: {
    label: 'VIP',
    icon: 'star' as ZardIcon,
    badgeType: 'default',
    accent: '#F0B429',
    accentDim: 'rgba(240,180,41,.1)',
    accentBorder: 'rgba(240,180,41,.22)',
  },
  2: {
    label: 'Premium',
    icon: 'sparkles' as ZardIcon,
    badgeType: 'outline',
    accent: '#a78bfa',
    accentDim: 'rgba(167,139,250,.1)',
    accentBorder: 'rgba(167,139,250,.22)',
  },
};

interface TierOption {
  value: string;
  label: string;
  icon: ZardIcon;
  accent: string;
  accentDim: string;
}

// ─── Dialog Form ──────────────────────────────────────────────────────────────
@Component({
  selector: 'app-ticket-template-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ZardInputDirective, ZardSelectComponent, ZardSelectItemComponent, ZardIconComponent],
  template: `
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <form [formGroup]="form" class="ttf-form">

      <div class="ttf-field">
        <label class="ttf-label">Template Name <span class="ttf-req">*</span></label>
        <input z-input formControlName="name" placeholder="e.g. General Admission, VIP Pass" class="ttf-input"/>
        @if (form.get('name')?.invalid && form.get('name')?.touched) {
          <span class="ttf-error"><div z-icon zType="circle-alert" class="ttf-icon-xs"></div>Name is required (min 2 characters)</span>
        }
      </div>

      <div class="ttf-field">
        <label class="ttf-label">Description <span class="ttf-req">*</span></label>
        <textarea z-input formControlName="description" rows="3" placeholder="What does this ticket include?" class="ttf-input ttf-textarea"></textarea>
        @if (form.get('description')?.invalid && form.get('description')?.touched) {
          <span class="ttf-error"><div z-icon zType="circle-alert" class="ttf-icon-xs"></div>Description is required</span>
        }
      </div>

      <div class="ttf-field">
        <label class="ttf-label">Tier <span class="ttf-req">*</span></label>
        @if (!isEdit) {
          <div class="ttf-tier-grid">
            @for (opt of tierOptions; track opt.value) {
              <button type="button" (click)="form.get('tier')?.setValue(opt.value)"
                      class="ttf-tier-btn"
                      [class.ttf-tier-btn--active]="form.get('tier')?.value === opt.value"
                      [style.--t-accent]="opt.accent"
                      [style.--t-dim]="opt.accentDim">
                <div z-icon [zType]="opt.icon" class="ttf-tier-icon"
                     [style.color]="form.get('tier')?.value === opt.value ? opt.accent : ''"></div>
                <span class="ttf-tier-label" [style.color]="form.get('tier')?.value === opt.value ? opt.accent : ''">
                  {{ opt.label }}
                </span>
                @if (form.get('tier')?.value === opt.value) {
                  <span class="ttf-tier-dot" [style.background]="opt.accent"></span>
                }
              </button>
            }
          </div>
        } @else {
          <div class="ttf-tier-locked">
            <div z-icon [zType]="getSelectedTierIcon()" class="ttf-icon-sm" style="color:var(--es-muted)"></div>
            <div>
              <p class="ttf-tier-locked__name">{{ getSelectedTierLabel() }}</p>
              <p style="font-size:.72rem;color:var(--es-muted)">Tier cannot be changed after creation</p>
            </div>
          </div>
        }
      </div>

      <div class="ttf-field">
        <label class="ttf-label">Default Price (EGP) <span class="ttf-req">*</span></label>
        <div class="ttf-price-wrap">
          <span class="ttf-price-sym">EGP</span>
          <input z-input formControlName="defaultPrice" type="number" min="0" step="0.01"
                 placeholder="0.00" class="ttf-input ttf-input--price"/>
        </div>
        @if (form.get('defaultPrice')?.invalid && form.get('defaultPrice')?.touched) {
          <span class="ttf-error"><div z-icon zType="circle-alert" class="ttf-icon-xs"></div>Price must be 0 or more</span>
        }
      </div>

    </form>
  `,
  styles: [`
    :host {
      --es-bg:     #09090c;
      --es-bg2:    #111116;
      --es-coral:  #FF4433;
      --es-text:   #F2EEE6;
      --es-muted:  rgba(242,238,230,.45);
      --es-border: rgba(242,238,230,.08);
      --es-fb: 'Plus Jakarta Sans', sans-serif;
      --es-fm: 'DM Mono', monospace;
      display: block;
    }
    .ttf-form  { display:flex; flex-direction:column; gap:1.1rem; }
    .ttf-field { display:flex; flex-direction:column; gap:.42rem; }
    .ttf-label { font-size:.78rem; font-weight:600; color:rgba(242,238,230,.72); letter-spacing:.02em; font-family:var(--es-fb); }
    .ttf-req   { color:var(--es-coral); }

    .ttf-input {
      background:var(--es-bg2) !important;
      border:1px solid var(--es-border) !important;
      border-radius:10px !important;
      color:var(--es-text) !important;
      font-family:var(--es-fb) !important;
      font-size:.88rem !important;
      padding:.7rem 1rem !important;
      transition:border-color .2s,box-shadow .2s !important;
      outline:none !important;
      width:100%;
    }
    .ttf-input:focus { border-color:rgba(255,68,51,.45) !important; box-shadow:0 0 0 3px rgba(255,68,51,.07) !important; }
    .ttf-input::placeholder { color:var(--es-muted) !important; }
    .ttf-textarea  { resize:vertical; min-height:80px; }
    .ttf-input--price { padding-left:3.8rem !important; }

    .ttf-price-wrap { position:relative; }
    .ttf-price-sym  { position:absolute; left:1rem; top:50%; transform:translateY(-50%); font-family:var(--es-fm); font-size:.7rem; letter-spacing:.06em; color:var(--es-muted); pointer-events:none; white-space:nowrap; }

    .ttf-error    { display:flex; align-items:center; gap:6px; font-size:.72rem; color:var(--es-coral); font-weight:500; }
    .ttf-icon-xs  { width:12px; height:12px; }
    .ttf-icon-sm  { width:16px; height:16px; }

    .ttf-tier-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.65rem; }
    .ttf-tier-btn {
      position:relative; display:flex; flex-direction:column; align-items:center; gap:.5rem;
      padding:.9rem .5rem; background:var(--es-bg2); border:1px solid var(--es-border);
      border-radius:12px; cursor:pointer; font-family:var(--es-fb);
      transition:border-color .2s,background .2s,transform .15s;
    }
    .ttf-tier-btn:hover { border-color:rgba(242,238,230,.16); transform:translateY(-1px); }
    .ttf-tier-btn--active { border-color:var(--t-accent) !important; background:var(--t-dim) !important; }
    .ttf-tier-icon  { width:18px; height:18px; color:var(--es-muted); }
    .ttf-tier-label { font-size:.7rem; font-weight:700; color:var(--es-muted); letter-spacing:.06em; text-transform:uppercase; }
    .ttf-tier-dot   { position:absolute; top:.55rem; right:.55rem; width:6px; height:6px; border-radius:50%; }

    .ttf-tier-locked { display:flex; align-items:center; gap:.75rem; padding:.85rem 1rem; background:var(--es-bg2); border:1px solid var(--es-border); border-radius:10px; }
    .ttf-tier-locked__name { font-size:.88rem; font-weight:600; color:var(--es-text); font-family:var(--es-fb); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketTemplateFormComponent implements AfterViewInit {
  private readonly zData = inject<{ template: TicketTemplate | null; isEdit: boolean }>(Z_MODAL_DATA);

  isEdit = false;

  readonly tierOptions: TierOption[] = [
    { value: '0', label: 'Standard', icon: 'ticket'   as ZardIcon, accent: '#10b981', accentDim: 'rgba(16,185,129,.1)'  },
    { value: '1', label: 'VIP',      icon: 'star'      as ZardIcon, accent: '#F0B429', accentDim: 'rgba(240,180,41,.1)'  },
    { value: '2', label: 'Premium',  icon: 'sparkles'  as ZardIcon, accent: '#a78bfa', accentDim: 'rgba(167,139,250,.1)' },
  ];

  form = new FormGroup({
    name:         new FormControl<string>('',  [Validators.required, Validators.minLength(2)]),
    description:  new FormControl<string>('',  [Validators.required]),
    tier:         new FormControl<string>('0', [Validators.required]),
    defaultPrice: new FormControl<number | null>(0, [Validators.required, Validators.min(0)]),
  });

  ngAfterViewInit(): void {
    if (this.zData) {
      this.isEdit = this.zData.isEdit;
      if (this.zData.template) {
        this.form.patchValue({
          name: this.zData.template.name,
          description: this.zData.template.description,
          tier: String(this.zData.template.tier),
          defaultPrice: this.zData.template.defaultPrice,
        });
      }
    }
  }

  getSelectedTierLabel(): string  { return TIER_META[Number(this.form.get('tier')?.value)]?.label ?? 'Standard'; }
  getSelectedTierIcon():  ZardIcon { return TIER_META[Number(this.form.get('tier')?.value)]?.icon ?? ('ticket' as ZardIcon); }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-tickets-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ZardDialogModule, ZardIconComponent, ZardBadgeComponent, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      --bg:        #060608;
      --bg2:       #0c0c10;
      --bg3:       #111116;
      --coral:     #FF4433;
      --coral-dim: rgba(255,68,51,.1);
      --gold:      #F0B429;
      --text:      #F2EEE6;
      --muted:     rgba(242,238,230,.42);
      --border:    rgba(242,238,230,.07);
      --border-hi: rgba(242,238,230,.13);
      --fd: 'Bebas Neue', sans-serif;
      --fb: 'Plus Jakarta Sans', sans-serif;
      --fm: 'DM Mono', monospace;
      display: block;
    }

    @keyframes fade-up {
      from { opacity:0; transform:translateY(16px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes shimmer {
      from { background-position:-600px 0; }
      to   { background-position: 600px 0; }
    }

    .page-enter { animation: fade-up .4s cubic-bezier(.22,1,.36,1) both; }
    .card-enter { animation: fade-up .36s cubic-bezier(.22,1,.36,1) both; }

    /* ── layout ── */
    .tp-root {
      width:100%; min-height:100%;
      background:var(--bg); color:var(--text);
      font-family:var(--fb);
    }
    .tp-inner {
      max-width:1280px; margin:0 auto;
      padding:2.5rem 1.5rem;
      display:flex; flex-direction:column; gap:2.25rem;
    }

    /* ── header ── */
    .tp-header { display:flex; flex-direction:column; gap:1.25rem; }
    @media(min-width:640px){ .tp-header { flex-direction:row; align-items:flex-start; justify-content:space-between; } }
    .tp-header__left { display:flex; flex-direction:column; gap:.55rem; }

    .tp-kicker {
      display:inline-flex; align-items:center; gap:7px;
      font-family:var(--fm); font-size:.66rem;
      letter-spacing:.14em; text-transform:uppercase; color:var(--coral);
    }
    .tp-kicker__dot { width:5px; height:5px; border-radius:50%; background:var(--coral); flex-shrink:0; }

    .tp-title {
      font-family:var(--fd);
      font-size:clamp(2rem,5vw,3rem);
      letter-spacing:.04em; color:var(--text);
      margin:0; line-height:1;
    }
    .tp-desc { font-size:.85rem; color:var(--muted); line-height:1.65; max-width:380px; font-weight:300; margin:0; }

    .tp-header__right { display:flex; align-items:center; gap:.75rem; flex-shrink:0; }

    .tp-count-pill {
      display:inline-flex; align-items:center; gap:6px;
      padding:5px 14px;
      background:var(--bg3); border:1px solid var(--border);
      border-radius:100px;
      font-family:var(--fm); font-size:.67rem; letter-spacing:.08em; color:var(--muted);
    }
    .tp-count-pill__dot { width:5px; height:5px; border-radius:50%; background:var(--coral); flex-shrink:0; }

    .tp-btn-new {
      display:inline-flex; align-items:center; gap:8px;
      padding:.65rem 1.35rem;
      background:var(--coral); color:#fff;
      border:none; border-radius:100px;
      font-family:var(--fb); font-weight:700; font-size:.85rem; letter-spacing:.02em;
      cursor:pointer;
      transition:box-shadow .25s, transform .18s;
      box-shadow:0 0 24px rgba(255,68,51,.25);
      position:relative; overflow:hidden;
    }
    .tp-btn-new::before {
      content:''; position:absolute; inset:0;
      background:linear-gradient(135deg,rgba(255,255,255,.13) 0%,transparent 55%);
      pointer-events:none;
    }
    .tp-btn-new:hover { box-shadow:0 0 44px rgba(255,68,51,.45); transform:translateY(-1px); }
    .tp-btn-new .i { width:15px; height:15px; }

    /* ── error ── */
    .tp-error {
      display:flex; align-items:flex-start; gap:.85rem;
      padding:1rem 1.1rem;
      background:rgba(255,68,51,.08);
      border:1px solid rgba(255,68,51,.2);
      border-radius:14px;
    }
    .tp-error__icon-wrap {
      width:32px; height:32px; border-radius:9px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      background:rgba(255,68,51,.12);
    }
    .tp-error__icon  { width:15px; height:15px; color:var(--coral); }
    .tp-error__title { font-size:.85rem; font-weight:700; color:var(--coral); margin-bottom:2px; }
    .tp-error__msg   { font-size:.75rem; color:rgba(255,68,51,.75); }
    .tp-error__close {
      margin-left:auto; background:none; border:none; cursor:pointer;
      color:rgba(255,68,51,.5); padding:4px; flex-shrink:0; transition:color .2s; border-radius:6px;
    }
    .tp-error__close:hover { color:var(--coral); }
    .tp-error__close .i { width:14px; height:14px; }

    /* ── skeleton ── */
    .tp-skeleton-grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); }
    .tp-skeleton {
      height:180px; border-radius:16px; border:1px solid var(--border);
      background:linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.03) 75%);
      background-size:800px 100%; animation:shimmer 1.5s ease-in-out infinite;
    }

    /* ── empty ── */
    .tp-empty {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:6rem 2rem; text-align:center; gap:1.5rem;
      border:1px dashed var(--border); border-radius:20px; background:var(--bg2);
    }
    .tp-empty__icon-wrap {
      width:64px; height:64px; border-radius:18px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      background:var(--bg3); border:1px solid var(--border-hi);
    }
    .tp-empty__icon  { width:28px; height:28px; color:var(--muted); }
    .tp-empty__title { font-family:var(--fd); font-size:1.6rem; letter-spacing:.04em; color:var(--text); margin:0; }
    .tp-empty__desc  { font-size:.85rem; color:var(--muted); max-width:280px; line-height:1.65; margin:0; font-weight:300; }

    /* ── grid ── */
    .tp-grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); }

    /* ── card ── */
    .tp-card {
      display:flex; flex-direction:column;
      border-radius:18px; border:1px solid var(--border);
      background:var(--bg2); overflow:hidden;
      transition:transform .22s, border-color .22s, box-shadow .22s;
    }
    .tp-card:hover { transform:translateY(-3px); box-shadow:0 12px 40px rgba(0,0,0,.45); }

    .tp-card__bar  { height:3px; width:100%; flex-shrink:0; }
    .tp-card__body { padding:1.1rem 1.25rem; display:flex; flex-direction:column; gap:.9rem; flex:1; }
    .tp-card__head { display:flex; align-items:flex-start; justify-content:space-between; gap:.5rem; }

    /* tier badge */
    .tp-tier-badge {
      display:inline-flex; align-items:center; gap:5px;
      padding:4px 10px; border-radius:100px;
      font-family:var(--fm); font-size:.61rem;
      letter-spacing:.08em; text-transform:uppercase; font-weight:500; flex-shrink:0;
    }
    .tp-tier-badge .i { width:11px; height:11px; }

    /* actions */
    .tp-actions { display:flex; align-items:center; gap:2px; flex-shrink:0; }
    .tp-action-btn {
      display:flex; align-items:center; justify-content:center;
      width:28px; height:28px; background:none; border:none;
      border-radius:8px; cursor:pointer; color:var(--muted);
      transition:background .18s, color .18s;
    }
    .tp-action-btn:hover               { background:rgba(255,255,255,.06); color:var(--text); }
    .tp-action-btn--del:hover          { background:rgba(255,68,51,.1);    color:var(--coral); }
    .tp-action-btn .i { width:13px; height:13px; }

    .tp-del-confirm {
      display:flex; align-items:center; gap:4px;
      padding:4px 8px;
      background:rgba(255,68,51,.08); border:1px solid rgba(255,68,51,.2);
      border-radius:8px;
    }
    .tp-del-confirm__label { font-size:.67rem; font-weight:600; color:var(--coral); margin-right:2px; }

    /* content */
    .tp-card__content { flex:1; min-width:0; display:flex; flex-direction:column; gap:.35rem; }
    .tp-card__name {
      font-family:var(--fd); font-size:1.15rem; letter-spacing:.03em;
      color:var(--text); margin:0; line-height:1.1;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .tp-card__desc {
      font-size:.78rem; color:var(--muted); line-height:1.6; margin:0;
      display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
      font-weight:300;
    }

    /* price footer */
    .tp-card__foot { display:flex; align-items:center; justify-content:space-between; padding-top:.85rem; border-top:1px solid var(--border); }
    .tp-card__foot-lbl {
      display:flex; align-items:center; gap:5px;
      font-family:var(--fm); font-size:.63rem; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);
    }
    .tp-card__foot-lbl .i { width:12px; height:12px; }
    .tp-card__price { font-family:var(--fm); font-size:.96rem; font-weight:500; letter-spacing:.03em; }

    /* ── footer stats ── */
    .tp-stats { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.75rem; padding-top:.5rem; }
    .tp-stats__total { font-family:var(--fm); font-size:.65rem; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
    .tp-stats__tiers { display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap; }
    .tp-stats__tier  { display:flex; align-items:center; gap:6px; font-size:.72rem; color:var(--muted); }
    .tp-stats__tier-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
  `],
  template: `
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    <div class="tp-root">
      <div class="tp-inner page-enter">

        <!-- ══ HEADER ══ -->
        <div class="tp-header">
          <div class="tp-header__left">
            <div class="tp-kicker">
              <span class="tp-kicker__dot"></span>
              Ticket Management
            </div>
            <h1 class="tp-title">Templates</h1>
            <p class="tp-desc">Define reusable ticket types — set tier, pricing, and description once, attach anywhere.</p>
          </div>

          <div class="tp-header__right">
            @if (templates().length > 0) {
              <div class="tp-count-pill">
                <span class="tp-count-pill__dot"></span>
                {{ templates().length }} template{{ templates().length !== 1 ? 's' : '' }}
              </div>
            }
            <button class="tp-btn-new" (click)="openCreateDialog()">
              <div z-icon zType="plus" class="i"></div>
              New Template
            </button>
          </div>
        </div>

        <!-- ══ ERROR ══ -->
        @if (error()) {
          <div class="tp-error">
            <div class="tp-error__icon-wrap">
              <div z-icon zType="triangle-alert" class="tp-error__icon"></div>
            </div>
            <div style="flex:1;min-width:0">
              <p class="tp-error__title">Something went wrong</p>
              <p class="tp-error__msg">{{ error() }}</p>
            </div>
            <button class="tp-error__close" (click)="error.set(null)">
              <div z-icon zType="x" class="i"></div>
            </button>
          </div>
        }

        <!-- ══ LOADING ══ -->
        @if (loading()) {
          <div class="tp-skeleton-grid">
            @for (i of [1,2,3,4]; track i) {
              <div class="tp-skeleton"></div>
            }
          </div>
        }

        <!-- ══ EMPTY ══ -->
        @else if (templates().length === 0) {
          <div class="tp-empty">
            <div class="tp-empty__icon-wrap">
              <div z-icon zType="ticket" class="tp-empty__icon"></div>
            </div>
            <div>
              <h3 class="tp-empty__title">No Templates Yet</h3>
              <p class="tp-empty__desc">Create your first ticket template to start selling tickets for your events.</p>
            </div>
            <button class="tp-btn-new" (click)="openCreateDialog()">
              <div z-icon zType="plus" class="i"></div>
              Create First Template
            </button>
          </div>
        }

        <!-- ══ GRID ══ -->
        @else {
          <div class="tp-grid">
            @for (tpl of templates(); track tpl.id; let i = $index) {
              <div class="tp-card card-enter"
                   [style.border-color]="getMeta(tpl.tier).accentBorder"
                   [style.animation-delay]="i * 40 + 'ms'">

                <div class="tp-card__bar" [style.background]="getMeta(tpl.tier).accent"></div>

                <div class="tp-card__body">

                  <!-- Head -->
                  <div class="tp-card__head">
                    <div class="tp-tier-badge"
                         [style.background]="getMeta(tpl.tier).accentDim"
                         [style.border]="'1px solid ' + getMeta(tpl.tier).accentBorder"
                         [style.color]="getMeta(tpl.tier).accent">
                      <div z-icon [zType]="getMeta(tpl.tier).icon" class="i"></div>
                      {{ getMeta(tpl.tier).label }}
                    </div>

                    <div class="tp-actions">
                      @if (deleteConfirmId() === tpl.id) {
                        <div class="tp-del-confirm">
                          <span class="tp-del-confirm__label">Sure?</span>
                          <button class="tp-action-btn tp-action-btn--del" (click)="deleteTemplate(tpl.id)" title="Confirm">
                            <div z-icon zType="check" class="i"></div>
                          </button>
                          <button class="tp-action-btn" (click)="cancelDelete()" title="Cancel">
                            <div z-icon zType="x" class="i"></div>
                          </button>
                        </div>
                      } @else {
                        <button class="tp-action-btn" (click)="openEditDialog(tpl)" title="Edit">
                          <div z-icon zType="pencil" class="i"></div>
                        </button>
                        <button class="tp-action-btn tp-action-btn--del" (click)="confirmDelete(tpl.id)" title="Delete">
                          <div z-icon zType="trash" class="i"></div>
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Content -->
                  <div class="tp-card__content">
                    <h3 class="tp-card__name">{{ tpl.name }}</h3>
                    <p class="tp-card__desc">{{ tpl.description }}</p>
                  </div>

                  <!-- Price -->
                  <div class="tp-card__foot">
                    <span class="tp-card__foot-lbl">
                      <div z-icon zType="circle-dollar-sign" class="i"></div>
                      Default Price
                    </span>
                    <span class="tp-card__price" [style.color]="getMeta(tpl.tier).accent">
                      {{ formatCurrency(tpl.defaultPrice) }}
                    </span>
                  </div>

                </div>
              </div>
            }
          </div>

          <!-- Stats -->
          <div class="tp-stats">
            <span class="tp-stats__total">{{ templates().length }} template{{ templates().length !== 1 ? 's' : '' }} total</span>
            <div class="tp-stats__tiers">
              @for (tier of tierSummary(); track tier.label) {
                <span class="tp-stats__tier">
                  <span class="tp-stats__tier-dot" [style.background]="tier.accent"></span>
                  {{ tier.count }} {{ tier.label }}
                </span>
              }
            </div>
          </div>
        }

      </div>
    </div>
  `,
})
export class TicketsPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly authService   = inject(AuthService);
  private readonly dialogService = inject(ZardDialogService);

  templates       = signal<TicketTemplate[]>([]);
  loading         = signal(false);
  error           = signal<string | null>(null);
  deleteConfirmId = signal<number | null>(null);
  submitting      = signal(false);
  organizationId!: number;

  tierSummary = computed(() => {
    const list = this.templates();
    return [0, 1, 2]
      .map((n) => ({ ...TIER_META[n], count: list.filter((t) => t.tier === n).length }))
      .filter((t) => t.count > 0);
  });

  ngOnInit(): void {
    const org = this.authService.getOrganization();
    if (!org) { this.error.set('No organization found. Please log in again.'); return; }
    this.organizationId = org.id;
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.error.set(null);
    this.ticketService.getTemplatesByOrganization(this.organizationId).subscribe({
      next:  (t)   => { this.templates.set(t);        this.loading.set(false); },
      error: (err) => { this.error.set(err.message);  this.loading.set(false); },
    });
  }

  openCreateDialog(): void {
    this.dialogService.create({
      zTitle: 'New Ticket Template',
      zDescription: 'Create a reusable ticket type for your events.',
      zContent: TicketTemplateFormComponent,
      zData: { template: null, isEdit: false },
      zOkText: 'Create Template',
      zWidth: '480px',
      zOnOk: (instance: TicketTemplateFormComponent) => {
        if (instance.form.invalid) { instance.form.markAllAsTouched(); return false; }
        this.submitting.set(true);
        const raw = instance.form.value;
        const dto: CreateTemplateDto = {
          name: raw.name ?? '',
          description: raw.description ?? '',
          tier: Number(raw.tier) as TicketTier,
          defaultPrice: Number(raw.defaultPrice ?? 0),
          organizationId: this.organizationId,
        };
        this.ticketService.createTemplate(dto).subscribe({
          next:  () =>    { this.loadTemplates();          this.submitting.set(false); },
          error: (err) => { this.error.set(err.message);   this.submitting.set(false); },
        });
        return {};
      },
    });
  }

  openEditDialog(template: TicketTemplate): void {
    this.dialogService.create({
      zTitle: 'Edit Template',
      zDescription: 'Update name, description, or pricing.',
      zContent: TicketTemplateFormComponent,
      zData: { template, isEdit: true },
      zOkText: 'Save Changes',
      zWidth: '480px',
      zOnOk: (instance: TicketTemplateFormComponent) => {
        if (instance.form.invalid) { instance.form.markAllAsTouched(); return false; }
        this.submitting.set(true);
        const raw = instance.form.value;
        this.ticketService.updateTemplate(template.id, {
          name: raw.name ?? undefined,
          description: raw.description ?? undefined,
          price: raw.defaultPrice ?? undefined,
        }).subscribe({
          next:  () =>    { this.loadTemplates();          this.submitting.set(false); },
          error: (err) => { this.error.set(err.message);   this.submitting.set(false); },
        });
        return {};
      },
    });
  }

  confirmDelete(id: number): void  { this.deleteConfirmId.set(id);   }
  cancelDelete():           void  { this.deleteConfirmId.set(null);  }

  deleteTemplate(id: number): void {
    this.ticketService.deleteTemplate(id).subscribe({
      next:  ()    => { this.templates.update((l) => l.filter((t) => t.id !== id)); this.deleteConfirmId.set(null); },
      error: (err) => { this.error.set(err.message); this.deleteConfirmId.set(null); },
    });
  }

  getMeta(tier: TicketTier): TierMeta {
    return TIER_META[tier as number] ?? TIER_META[0];
  }

  formatCurrency(amount: number | null | undefined): string {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(typeof amount === 'number' ? amount : 0);
  }
}