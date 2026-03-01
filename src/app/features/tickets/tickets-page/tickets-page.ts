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
import {
  ReactiveFormsModule,
  Validators,
  FormGroup,
  FormControl,
} from '@angular/forms';
import {
  TicketService,
  TicketTemplate,
  TicketTier,
  CreateTemplateDto,
} from '@core/services/ticket.service';
import { AuthService } from '@core/services/auth.service';
import { ZardDialogModule } from '@shared/components/dialog/dialog.component';
import {
  Z_MODAL_DATA,
  ZardDialogService,
} from '@shared/components/dialog/dialog.service';
import { ZardInputDirective } from '@shared/components/input/input.directive';
import { ZardSelectItemComponent } from '@shared/components/select/select-item.component';
import { ZardSelectComponent } from '@shared/components/select/select.component';
import { ZardIconComponent } from '@shared/components/icon/icon.component';
import { ZardBadgeComponent } from '@shared/components/badge/badge.component';
import { ZardButtonComponent } from '@shared/components/button/button.component';
import { ZARD_ICONS } from '@shared/components/icon/icons';
type ZardIcon = keyof typeof ZARD_ICONS;
// ─── Tier Meta ───────────────────────────────────────────────────────────────
interface TierMeta {
  label: string;
  icon: ZardIcon;
  badgeType: 'default' | 'secondary' | 'outline' | 'destructive';
  accentLight: string;
  accentDark: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
}

const TIER_META: Record<number, TierMeta> = {
  0: {
    label: 'Standard',
    icon: 'ticket' as ZardIcon,
    badgeType: 'secondary',
    accentLight: '#059669',
    accentDark: '#10b981',
    bgLight: 'rgba(16,185,129,.08)',
    bgDark: 'rgba(16,185,129,.12)',
    borderLight: 'rgba(16,185,129,.2)',
    borderDark: 'rgba(16,185,129,.28)',
  },
  1: {
    label: 'VIP',
    icon: 'star' as ZardIcon,
    badgeType: 'default',
    accentLight: '#d97706',
    accentDark: '#f59e0b',
    bgLight: 'rgba(245,158,11,.08)',
    bgDark: 'rgba(245,158,11,.12)',
    borderLight: 'rgba(245,158,11,.2)',
    borderDark: 'rgba(245,158,11,.28)',
  },
  2: {
    label: 'Premium',
    icon: 'sparkles' as ZardIcon,
    badgeType: 'outline',
    accentLight: '#7c3aed',
    accentDark: '#8b5cf6',
    bgLight: 'rgba(139,92,246,.08)',
    bgDark: 'rgba(139,92,246,.12)',
    borderLight: 'rgba(139,92,246,.2)',
    borderDark: 'rgba(139,92,246,.28)',
  },
};

// ─── Tier Option Interface ────────────────────────────────────────────────────
interface TierOption {
  value: string;
  label: string;
  icon: ZardIcon;
  accent: string;
  bg: string;
}

// ─── Dialog Form Component ───────────────────────────────────────────────────
@Component({
  selector: 'app-ticket-template-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardInputDirective,
    ZardSelectComponent,
    ZardSelectItemComponent,
    ZardIconComponent,
  ],
  template: `
    <form [formGroup]="form" class="grid gap-5">
      <!-- Name -->
      <div class="grid gap-2">
        <label class="text-sm font-medium text-foreground">
          Template Name <span class="text-destructive">*</span>
        </label>
        <input
          z-input
          formControlName="name"
          placeholder="e.g. General Admission, VIP Pass"
        />
        @if (form.get('name')?.invalid && form.get('name')?.touched) {
          <span class="text-xs text-destructive flex items-center gap-1.5">
            <div z-icon zType="circle-alert" class="w-3 h-3 shrink-0"></div>
            Name is required (min 2 characters)
          </span>
        }
      </div>

      <!-- Description -->
      <div class="grid gap-2">
        <label class="text-sm font-medium text-foreground">
          Description <span class="text-destructive">*</span>
        </label>
        <textarea
          z-input
          formControlName="description"
          rows="3"
          placeholder="What does this ticket include?"
          class="min-h-[80px] resize-y"
        ></textarea>
        @if (
          form.get('description')?.invalid && form.get('description')?.touched
        ) {
          <span class="text-xs text-destructive flex items-center gap-1.5">
            <div z-icon zType="circle-alert" class="w-3 h-3 shrink-0"></div>
            Description is required
          </span>
        }
      </div>

      <!-- Tier -->
      <div class="grid gap-2">
        <label class="text-sm font-medium text-foreground">
          Tier <span class="text-destructive">*</span>
        </label>

        @if (!isEdit) {
          <div class="grid grid-cols-3 gap-2">
            @for (opt of tierOptions; track opt.value) {
              <button
                type="button"
                (click)="form.get('tier')?.setValue(opt.value)"
                class="relative flex flex-col items-center gap-2 py-3 px-2 rounded-xl border
                       text-center transition-all duration-150 cursor-pointer hover:bg-muted/60"
                [class.bg-muted]="form.get('tier')?.value !== opt.value"
                [class.border-border]="form.get('tier')?.value !== opt.value"
                [style]="
                  form.get('tier')?.value === opt.value
                    ? 'border-color:' + opt.accent + ';background:' + opt.bg
                    : ''
                "
              >
                <div
                  z-icon
                  [zType]="opt.icon"
                  class="w-5 h-5"
                  [style.color]="
                    form.get('tier')?.value === opt.value
                      ? opt.accent
                      : 'var(--muted-foreground)'
                  "
                ></div>
                <span
                  class="text-xs font-semibold"
                  [style.color]="
                    form.get('tier')?.value === opt.value
                      ? opt.accent
                      : 'var(--muted-foreground)'
                  "
                >
                  {{ opt.label }}
                </span>
                @if (form.get('tier')?.value === opt.value) {
                  <span
                    class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                    [style.background]="opt.accent"
                  ></span>
                }
              </button>
            }
          </div>
        } @else {
          <div
            class="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/40"
          >
            <div
              z-icon
              [zType]="getSelectedTierIcon()"
              class="w-5 h-5 text-muted-foreground shrink-0"
            ></div>
            <div>
              <p class="text-sm font-semibold text-foreground">
                {{ getSelectedTierLabel() }}
              </p>
              <p class="text-xs text-muted-foreground">
                Tier cannot be changed after creation
              </p>
            </div>
          </div>
        }
      </div>

      <!-- Price -->
      <div class="grid gap-2">
        <label class="text-sm font-medium text-foreground">
          Default Price (USD) <span class="text-destructive">*</span>
        </label>
        <div class="relative flex items-center">
          <span
            class="absolute left-3 text-muted-foreground text-sm font-medium pointer-events-none"
          >
            $
          </span>
          <input
            z-input
            formControlName="defaultPrice"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            class="pl-7"
          />
        </div>
        @if (
          form.get('defaultPrice')?.invalid && form.get('defaultPrice')?.touched
        ) {
          <span class="text-xs text-destructive flex items-center gap-1.5">
            <div z-icon zType="circle-alert" class="w-3 h-3 shrink-0"></div>
            Price must be 0 or more
          </span>
        }
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketTemplateFormComponent implements AfterViewInit {
  private readonly zData = inject<{
    template: TicketTemplate | null;
    isEdit: boolean;
  }>(Z_MODAL_DATA);

  isEdit = false;

  readonly tierOptions: TierOption[] = [
    {
      value: '0',
      label: 'Standard',
      icon: 'ticket' as ZardIcon,
      accent: '#10b981',
      bg: 'rgba(16,185,129,.1)',
    },
    {
      value: '1',
      label: 'VIP',
      icon: 'star' as ZardIcon,
      accent: '#f59e0b',
      bg: 'rgba(245,158,11,.1)',
    },
    {
      value: '2',
      label: 'Premium',
      icon: 'sparkles' as ZardIcon,
      accent: '#8b5cf6',
      bg: 'rgba(139,92,246,.1)',
    },
  ];

  form = new FormGroup({
    name: new FormControl<string>('', [
      Validators.required,
      Validators.minLength(2),
    ]),
    description: new FormControl<string>('', [Validators.required]),
    tier: new FormControl<string>('0', [Validators.required]),
    defaultPrice: new FormControl<number | null>(0, [
      Validators.required,
      Validators.min(0),
    ]),
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

  getSelectedTierLabel(): string {
    return TIER_META[Number(this.form.get('tier')?.value)]?.label ?? 'Standard';
  }

  getSelectedTierIcon(): ZardIcon {
    return (
      TIER_META[Number(this.form.get('tier')?.value)]?.icon ??
      ('ticket' as ZardIcon)
    );
  }
}

// ─── Main Page Component ─────────────────────────────────────────────────────
@Component({
  selector: 'app-tickets-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardDialogModule,
    ZardIconComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes fade-up {
        from {
          opacity: 0;
          transform: translateY(14px);
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

      .page-enter {
        animation: fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .card-enter {
        animation: fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .template-card {
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
      }
      .template-card:hover {
        transform: translateY(-2px);
      }

      :host-context(.dark) .template-card:hover {
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
      }
      :host-context(:not(.dark)) .template-card:hover {
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      }

      .skeleton-light {
        background: linear-gradient(
          90deg,
          #f1f5f9 25%,
          #e2e8f0 50%,
          #f1f5f9 75%
        );
        background-size: 800px 100%;
        animation: shimmer 1.4s ease-in-out infinite;
      }
      .skeleton-dark {
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.04) 25%,
          rgba(255, 255, 255, 0.08) 50%,
          rgba(255, 255, 255, 0.04) 75%
        );
        background-size: 800px 100%;
        animation: shimmer 1.4s ease-in-out infinite;
      }
    `,
  ],
  template: `
    <div class="w-full min-h-full bg-background text-foreground">
      <div class="w-full px-4 sm:px-6 lg:px-8 py-8 page-enter space-y-8">
        <!-- ══ HEADER ══ -->
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <div
                class="w-6 h-6 rounded-md flex items-center justify-center bg-primary shrink-0"
              >
                <div
                  z-icon
                  zType="ticket"
                  class="w-3.5 h-3.5 text-primary-foreground"
                ></div>
              </div>
              <span
                class="text-xs font-semibold tracking-widest uppercase text-muted-foreground"
              >
                Ticket Management
              </span>
            </div>
            <h1 class="text-3xl font-bold tracking-tight text-foreground">
              Templates
            </h1>
            <p class="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Define reusable ticket types — set tier, pricing, and description
              once, attach anywhere.
            </p>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            @if (templates().length > 0) {
              <div
                class="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/60"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                <span class="text-xs font-medium text-muted-foreground">
                  {{ templates().length }} template{{
                    templates().length !== 1 ? 's' : ''
                  }}
                </span>
              </div>
            }
            <button
              z-button
              zType="default"
              (click)="openCreateDialog()"
              class="flex items-center gap-2"
            >
              <div z-icon zType="plus" class="w-4 h-4"></div>
              New Template
            </button>
          </div>
        </div>

        <!-- ══ ERROR ══ -->
        @if (error()) {
          <div
            class="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10"
          >
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-destructive/15"
            >
              <div
                z-icon
                zType="triangle-alert"
                class="w-4 h-4 text-destructive"
              ></div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-destructive">
                Something went wrong
              </p>
              <p class="text-xs text-destructive/70 mt-0.5">{{ error() }}</p>
            </div>
            <button
              z-button
              zType="ghost"
              class="w-8 h-8 p-0 shrink-0 text-destructive/60 hover:text-destructive"
              (click)="error.set(null)"
            >
              <div z-icon zType="x" class="w-4 h-4"></div>
            </button>
          </div>
        }

        <!-- ══ LOADING SKELETONS ══ -->
        @if (loading()) {
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @for (i of [1, 2, 3, 4]; track i) {
              <div
                class="rounded-2xl h-44 border border-border"
                [class]="isDark ? 'skeleton-dark' : 'skeleton-light'"
              ></div>
            }
          </div>
        }

        <!-- ══ EMPTY STATE ══ -->
        @else if (templates().length === 0) {
          <div
            class="flex flex-col items-center justify-center py-24 text-center space-y-5
                  rounded-2xl border border-dashed border-border bg-muted/30"
          >
            <div
              class="w-16 h-16 rounded-2xl flex items-center justify-center
                    border border-border bg-background shadow-sm"
            >
              <div
                z-icon
                zType="ticket"
                class="w-8 h-8 text-muted-foreground"
              ></div>
            </div>
            <div class="space-y-1.5">
              <h3 class="text-lg font-bold text-foreground">
                No templates yet
              </h3>
              <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Create your first ticket template to start selling tickets for
                your events.
              </p>
            </div>
            <button
              z-button
              zType="default"
              (click)="openCreateDialog()"
              class="flex items-center gap-2"
            >
              <div z-icon zType="plus" class="w-4 h-4"></div>
              Create First Template
            </button>
          </div>
        }

        <!-- ══ TEMPLATE GRID ══ -->
        @else {
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @for (tpl of templates(); track tpl.id; let i = $index) {
              <div
                class="template-card card-enter flex flex-col rounded-2xl border overflow-hidden bg-card"
                [style]="
                  'border-color:' +
                  getMeta(tpl.tier).borderDark +
                  ';animation-delay:' +
                  i * 40 +
                  'ms'
                "
              >
                <!-- Tier accent top bar -->
                <div
                  class="h-0.5 w-full shrink-0"
                  [style.background]="getMeta(tpl.tier).accentDark"
                ></div>

                <div class="p-5 flex flex-col gap-4 flex-1">
                  <!-- Badge + Actions -->
                  <div class="flex items-start justify-between gap-2">
                    <z-badge
                      [zType]="getMeta(tpl.tier).badgeType"
                      class="shrink-0 flex items-center gap-1"
                    >
                      <div
                        z-icon
                        [zType]="getMeta(tpl.tier).icon"
                        class="w-3 h-3 mr-1"
                      ></div>
                      {{ getMeta(tpl.tier).label }}
                    </z-badge>

                    <div class="flex items-center gap-0.5 shrink-0">
                      @if (deleteConfirmId() === tpl.id) {
                        <div
                          class="flex items-center gap-1 px-2 py-1 rounded-lg
                                border border-destructive/25 bg-destructive/10"
                        >
                          <span
                            class="text-[10px] font-medium text-destructive mr-0.5"
                            >Sure?</span
                          >
                          <button
                            z-button
                            zType="ghost"
                            class="w-6 h-6 p-0 text-destructive hover:bg-destructive/20"
                            (click)="deleteTemplate(tpl.id)"
                            title="Confirm delete"
                          >
                            <div z-icon zType="check" class="w-3.5 h-3.5"></div>
                          </button>
                          <button
                            z-button
                            zType="ghost"
                            class="w-6 h-6 p-0 text-muted-foreground"
                            (click)="cancelDelete()"
                            title="Cancel"
                          >
                            <div z-icon zType="x" class="w-3.5 h-3.5"></div>
                          </button>
                        </div>
                      } @else {
                        <button
                          z-button
                          zType="ghost"
                          class="w-7 h-7 p-0"
                          (click)="openEditDialog(tpl)"
                          title="Edit"
                        >
                          <div z-icon zType="pencil" class="w-3.5 h-3.5"></div>
                        </button>
                        <button
                          z-button
                          zType="ghost"
                          class="w-7 h-7 p-0 text-muted-foreground hover:text-destructive"
                          (click)="confirmDelete(tpl.id)"
                          title="Delete"
                        >
                          <div z-icon zType="trash" class="w-3.5 h-3.5"></div>
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Name + Description -->
                  <div class="flex-1 min-w-0 space-y-1">
                    <h3
                      class="font-semibold text-foreground text-sm leading-snug line-clamp-1"
                    >
                      {{ tpl.name }}
                    </h3>
                    <p
                      class="text-xs text-muted-foreground leading-relaxed line-clamp-3"
                    >
                      {{ tpl.description }}
                    </p>
                  </div>

                  <!-- Price footer -->
                  <div
                    class="flex items-center justify-between pt-3 border-t border-border"
                  >
                    <span
                      class="text-xs font-medium text-muted-foreground flex items-center gap-1"
                    >
                      <div
                        z-icon
                        zType="circle-dollar-sign"
                        class="w-3.5 h-3.5 shrink-0"
                      ></div>
                      Default Price
                    </span>
                    <span
                      class="text-base font-bold tabular-nums"
                      [style.color]="getMeta(tpl.tier).accentDark"
                    >
                      {{ formatCurrency(tpl.defaultPrice) }}
                    </span>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Footer Stats -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p class="text-xs text-muted-foreground">
              {{ templates().length }} template{{
                templates().length !== 1 ? 's' : ''
              }}
              total
            </p>
            <div class="flex items-center gap-4 flex-wrap">
              @for (tier of tierSummary(); track tier.label) {
                <span
                  class="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    class="w-2 h-2 rounded-full shrink-0"
                    [style.background]="tier.accentDark"
                  ></span>
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
  private readonly authService = inject(AuthService);
  private readonly dialogService = inject(ZardDialogService);

  templates = signal<TicketTemplate[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  deleteConfirmId = signal<number | null>(null);
  submitting = signal(false);
  organizationId!: number;

  get isDark(): boolean {
    return document.documentElement.classList.contains('dark');
  }

  tierSummary = computed(() => {
    const list = this.templates();
    return [0, 1, 2]
      .map((n) => ({
        ...TIER_META[n],
        count: list.filter((t) => t.tier === n).length,
      }))
      .filter((t) => t.count > 0);
  });

  ngOnInit(): void {
    const org = this.authService.getOrganization();
    if (!org) {
      this.error.set('No organization found. Please log in again.');
      return;
    }
    this.organizationId = org.id;
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.error.set(null);
    this.ticketService
      .getTemplatesByOrganization(this.organizationId)
      .subscribe({
        next: (t) => {
          this.templates.set(t);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
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
        if (instance.form.invalid) {
          instance.form.markAllAsTouched();
          return false;
        }

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
          next: () => {
            this.loadTemplates();
            this.submitting.set(false);
          },
          error: (err) => {
            this.error.set(err.message);
            this.submitting.set(false);
          },
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
        if (instance.form.invalid) {
          instance.form.markAllAsTouched();
          return false;
        }

        this.submitting.set(true);
        const raw = instance.form.value;
        this.ticketService
          .updateTemplate(template.id, {
            name: raw.name ?? undefined,
            description: raw.description ?? undefined,
            price: raw.defaultPrice ?? undefined,
          })
          .subscribe({
            next: () => {
              this.loadTemplates();
              this.submitting.set(false);
            },
            error: (err) => {
              this.error.set(err.message);
              this.submitting.set(false);
            },
          });
        return {};
      },
    });
  }

  confirmDelete(id: number): void {
    this.deleteConfirmId.set(id);
  }
  cancelDelete(): void {
    this.deleteConfirmId.set(null);
  }

  deleteTemplate(id: number): void {
    this.ticketService.deleteTemplate(id).subscribe({
      next: () => {
        this.templates.update((l) => l.filter((t) => t.id !== id));
        this.deleteConfirmId.set(null);
      },
      error: (err) => {
        this.error.set(err.message);
        this.deleteConfirmId.set(null);
      },
    });
  }

  getMeta(tier: TicketTier): TierMeta {
    return TIER_META[tier as number] ?? TIER_META[0];
  }

  formatCurrency(amount: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(typeof amount === 'number' ? amount : 0);
  }
}
