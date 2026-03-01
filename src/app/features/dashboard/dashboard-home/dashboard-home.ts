// src/app/features/dashboard/dashboard-home/dashboard-home.ts
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { EventService } from '@core/services/event.service';
import { CategoryService } from '@core/services/category';
import { AuthService } from '../../../core/services/auth.service';
import { ZardIconComponent } from '@shared/components/icon/icon.component';
import { type ZardIcon } from '@shared/components/icon/icons';

interface CategoryStat {
  name: string;
  count: number;
  percent: number;
  color: string;
}

interface QuickAction {
  label: string;
  description: string;
  route: string;
  icon: ZardIcon;
  color: string;
  iconBg: string;
  hoverBg: string;
  borderColor: string;
}

const COLORS = [
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#3b82f6',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

const C = 2 * Math.PI * 38;

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ZardIconComponent],

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
      @keyframes bar-grow {
        from {
          width: 0%;
        }
        to {
          width: var(--w);
        }
      }

      .page-enter {
        animation: fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .card-enter {
        animation: fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
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

      /* ── Stat card ── */
      .stat-card {
        transition:
          transform 0.2s ease,
          box-shadow 0.2s;
      }
      .stat-card:hover {
        transform: translateY(-2px);
      }
      :host-context(.dark) .stat-card:hover {
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      }
      :host-context(:not(.dark)) .stat-card:hover {
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.1);
      }

      /* ── Bar fill ── */
      .bar-fill {
        height: 100%;
        border-radius: 999px;
        animation: bar-grow 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      /* ── Quick action card ── */
      .quick-card {
        transition:
          transform 0.15s ease,
          border-color 0.15s,
          background 0.15s;
        cursor: pointer;
      }
      .quick-card:hover {
        transform: translateY(-2px);
      }

      /* ── Donut ── */
      .donut-seg {
        transition:
          stroke-dasharray 0.8s cubic-bezier(0.22, 1, 0.36, 1),
          stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1);
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
          class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <div
                class="w-6 h-6 rounded-md flex items-center justify-center bg-primary shrink-0"
              >
                <div
                  z-icon
                  zType="house"
                  class="w-3.5 h-3.5 text-primary-foreground"
                ></div>
              </div>
              <span
                class="text-xs font-semibold tracking-widest uppercase text-muted-foreground"
              >
                Overview
              </span>
            </div>
            <div>
              <h1 class="text-3xl font-bold tracking-tight text-foreground">
                Welcome back
                @if (organizationName()) {
                  ,&nbsp;<span
                    class="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent"
                    >{{ organizationName() }}</span
                  >
                }
              </h1>
              <p class="text-sm text-muted-foreground mt-1 leading-relaxed">
                Here's what's happening with your events today.
              </p>
            </div>
          </div>

          <!-- Date pill -->
          <div
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border
                  bg-muted/50 shrink-0"
          >
            <div
              z-icon
              zType="calendar"
              class="w-3.5 h-3.5 text-amber-500 shrink-0"
            ></div>
            <span class="text-xs font-medium text-muted-foreground">{{
              todayLabel
            }}</span>
          </div>
        </div>

        <!-- ════════ STAT CARDS ════════ -->
        @if (loadingStats()) {
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            @for (i of [1, 2, 3]; track i) {
              <div
                class="rounded-2xl h-28 border border-border"
                [class]="isDark ? 'skeleton-dark' : 'skeleton-light'"
              ></div>
            }
          </div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            @for (s of statItems(); track s.label; let i = $index) {
              <div
                class="stat-card card-enter rounded-2xl border border-border bg-card p-5
                   flex items-center justify-between"
                [style.animation-delay]="i * 60 + 'ms'"
              >
                <div class="space-y-1">
                  <p
                    class="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground"
                  >
                    {{ s.label }}
                  </p>
                  <p class="text-4xl font-bold tracking-tight text-foreground">
                    {{ s.value }}
                  </p>
                  <p class="text-[11px] text-muted-foreground/60">
                    {{ s.sub }}
                  </p>
                </div>
                <div
                  class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  [style.background]="s.bgColor"
                >
                  <svg
                    class="w-5 h-5"
                    [style.color]="s.color"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      [attr.d]="s.path"
                    />
                  </svg>
                </div>
              </div>
            }
          </div>
        }

        <!-- ════════ MAIN CONTENT ROW ════════ -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- ── Category Analysis (2/3) ── -->
          <div
            class="lg:col-span-2 rounded-2xl border border-border bg-card p-6"
          >
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="font-bold text-foreground text-[15px]">
                  Category Breakdown
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Distribution of events by category
                </p>
              </div>
              @if (!loadingStats() && categoryStats().length > 0) {
                <span
                  class="text-[11px] font-medium text-muted-foreground px-2.5 py-1
                         rounded-full border border-border bg-muted/40"
                >
                  {{ totalEvents() }} total
                </span>
              }
            </div>

            <!-- Loading -->
            @if (loadingStats()) {
              <div class="space-y-4">
                @for (i of [1, 2, 3, 4]; track i) {
                  <div class="space-y-1.5">
                    <div
                      class="rounded h-3 w-32 border border-border"
                      [class]="isDark ? 'skeleton-dark' : 'skeleton-light'"
                    ></div>
                    <div
                      class="rounded-full h-2 border border-border"
                      [class]="isDark ? 'skeleton-dark' : 'skeleton-light'"
                    ></div>
                  </div>
                }
              </div>

              <!-- Empty -->
            } @else if (categoryStats().length === 0) {
              <div
                class="flex flex-col items-center justify-center py-14 text-center space-y-4"
              >
                <div
                  class="w-16 h-16 rounded-2xl flex items-center justify-center
                        border border-border bg-muted/40"
                >
                  <div
                    z-icon
                    zType="trending-up"
                    class="w-8 h-8 text-muted-foreground"
                  ></div>
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-semibold text-foreground">
                    No analytics yet
                  </p>
                  <p
                    class="text-xs text-muted-foreground max-w-xs leading-relaxed"
                  >
                    Create your first event to start seeing category breakdowns
                    here.
                  </p>
                </div>
                <button
                  (click)="navigateTo('/events')"
                  class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold
                     text-zinc-900 hover:opacity-90 transition-all"
                  style="background:linear-gradient(135deg,#f59e0b,#f97316)"
                >
                  Go to Events
                  <div z-icon zType="arrow-right" class="w-3.5 h-3.5"></div>
                </button>
              </div>

              <!-- Chart -->
            } @else {
              <div class="flex flex-col sm:flex-row items-center gap-8">
                <!-- Bar list -->
                <div class="flex-1 w-full space-y-4">
                  @for (
                    stat of categoryStats();
                    track stat.name;
                    let i = $index
                  ) {
                    <div
                      class="card-enter"
                      [style.animation-delay]="i * 80 + 'ms'"
                    >
                      <div class="flex justify-between items-center mb-1.5">
                        <span
                          class="flex items-center gap-2 text-[13px] font-medium text-foreground"
                        >
                          <span
                            class="w-2 h-2 rounded-full shrink-0"
                            [style.background]="stat.color"
                          ></span>
                          {{ stat.name }}
                        </span>
                        <span
                          class="text-[12px] font-bold"
                          [style.color]="stat.color"
                        >
                          {{ stat.count }}&nbsp;<span
                            class="font-normal text-muted-foreground"
                          >
                            ({{ stat.percent }}%)
                          </span>
                        </span>
                      </div>
                      <div class="h-1.5 rounded-full overflow-hidden bg-muted">
                        <div
                          class="bar-fill"
                          [style.background]="stat.color"
                          [style.width]="stat.percent + '%'"
                        ></div>
                      </div>
                    </div>
                  }
                </div>

                <!-- Donut -->
                <div class="relative w-36 h-36 shrink-0">
                  <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
                    <!-- Track -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="14"
                      class="text-muted opacity-60"
                    />
                    <!-- Segments -->
                    @for (seg of donutSegments(); track seg.name) {
                      <circle
                        class="donut-seg"
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        [attr.stroke]="seg.color"
                        stroke-width="14"
                        stroke-linecap="butt"
                        [attr.stroke-dasharray]="seg.dash"
                        [attr.stroke-dashoffset]="seg.offset"
                      />
                    }
                  </svg>
                  <!-- Center label -->
                  <div
                    class="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <span class="text-2xl font-bold text-foreground">{{
                      totalEvents()
                    }}</span>
                    <span
                      class="text-[10px] font-medium text-muted-foreground mt-0.5
                             uppercase tracking-widest"
                      >Events</span
                    >
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- ── Quick Actions (1/3) ── -->
          <div
            class="rounded-2xl border border-border bg-card p-6 flex flex-col gap-3"
          >
            <div class="mb-1">
              <h3 class="font-bold text-foreground text-[15px]">
                Quick Actions
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                Jump to a section
              </p>
            </div>

            @for (action of quickActions; track action.label) {
              <button
                class="quick-card flex items-center gap-4 p-3.5 rounded-xl border text-left w-full"
                [style.border-color]="
                  hovered === action.label
                    ? action.borderColor
                    : 'var(--border)'
                "
                [style.background]="
                  hovered === action.label ? action.hoverBg : 'var(--muted)'
                "
                (click)="navigateTo(action.route)"
                (mouseenter)="hovered = action.label"
                (mouseleave)="hovered = null"
              >
                <div
                  class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  [style.background]="action.iconBg"
                >
                  <div
                    z-icon
                    [zType]="action.icon"
                    class="w-4 h-4"
                    [style.color]="action.color"
                  ></div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[13px] font-semibold text-foreground">
                    {{ action.label }}
                  </p>
                  <p class="text-[11px] text-muted-foreground leading-snug">
                    {{ action.description }}
                  </p>
                </div>
                <div
                  z-icon
                  zType="chevron-right"
                  class="w-4 h-4 text-muted-foreground shrink-0 transition-colors"
                  [class.opacity-100]="hovered === action.label"
                  [class.opacity-40]="hovered !== action.label"
                ></div>
              </button>
            }
          </div>
        </div>

        <!-- ════════ EVENT TIMELINE ════════ -->
        <div class="rounded-2xl border border-border bg-card p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h3 class="font-bold text-foreground text-[15px]">
                Event Timeline
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                Upcoming vs past at a glance
              </p>
            </div>
          </div>

          @if (loadingStats()) {
            <div
              class="rounded-xl h-14 border border-border"
              [class]="isDark ? 'skeleton-dark' : 'skeleton-light'"
            ></div>
          } @else if (totalEvents() === 0) {
            <p class="text-sm text-muted-foreground py-4 text-center">
              No events to display yet.
            </p>
          } @else {
            <div class="space-y-3">
              <!-- Upcoming bar -->
              <div class="flex items-center gap-3">
                <span
                  class="text-[11px] font-medium text-muted-foreground w-20 text-right shrink-0"
                >
                  Upcoming
                </span>
                <div
                  class="flex-1 h-7 rounded-xl overflow-hidden relative bg-muted"
                >
                  <div
                    class="h-full rounded-xl transition-all duration-700 flex items-center px-3"
                    style="background:linear-gradient(90deg,rgba(16,185,129,.6),rgba(16,185,129,.3))"
                    [style.width]="upcomingPercent() + '%'"
                  >
                    @if (upcomingPercent() > 12) {
                      <span class="text-[11px] font-bold text-emerald-300">{{
                        upcomingCount()
                      }}</span>
                    }
                  </div>
                  @if (upcomingPercent() <= 12) {
                    <span
                      class="absolute left-2 top-1/2 -translate-y-1/2
                             text-[11px] font-bold text-emerald-500"
                    >
                      {{ upcomingCount() }}
                    </span>
                  }
                </div>
                <span
                  class="text-[11px] font-bold text-emerald-500 w-8 shrink-0"
                >
                  {{ upcomingPercent() }}%
                </span>
              </div>

              <!-- Past bar -->
              <div class="flex items-center gap-3">
                <span
                  class="text-[11px] font-medium text-muted-foreground w-20 text-right shrink-0"
                >
                  Past
                </span>
                <div
                  class="flex-1 h-7 rounded-xl overflow-hidden relative bg-muted"
                >
                  <div
                    class="h-full rounded-xl transition-all duration-700 flex items-center px-3"
                    style="background:linear-gradient(90deg,rgba(245,158,11,.5),rgba(245,158,11,.2))"
                    [style.width]="pastPercent() + '%'"
                  >
                    @if (pastPercent() > 12) {
                      <span class="text-[11px] font-bold text-amber-300">{{
                        pastCount()
                      }}</span>
                    }
                  </div>
                  @if (pastPercent() <= 12) {
                    <span
                      class="absolute left-2 top-1/2 -translate-y-1/2
                             text-[11px] font-bold text-amber-500"
                    >
                      {{ pastCount() }}
                    </span>
                  }
                </div>
                <span class="text-[11px] font-bold text-amber-500 w-8 shrink-0">
                  {{ pastPercent() }}%
                </span>
              </div>
            </div>

            <!-- Legend -->
            <div
              class="flex items-center gap-5 mt-4 pt-4 border-t border-border"
            >
              <span
                class="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                ></span>
                Upcoming events
              </span>
              <span
                class="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span class="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                Past events
              </span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class DashboardHomeComponent implements OnInit {
  private router = inject(Router);
  private eventService = inject(EventService);
  private categoryService = inject(CategoryService);
  private authService = inject(AuthService);

  // ─── State ────────────────────────────────────────────────────────────────
  organizationName = signal('');
  totalEvents = signal(0);
  upcomingCount = signal(0);
  pastCount = signal(0);
  loadingStats = signal(true);
  categoryStats = signal<CategoryStat[]>([]);
  hovered: string | null = null;

  get isDark(): boolean {
    return document.documentElement.classList.contains('dark');
  }

  readonly todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // ─── Quick actions ─────────────────────────────────────────────────────────
  readonly quickActions: QuickAction[] = [
    {
      label: 'Events',
      description: 'Create and manage your events',
      route: '/events',
      icon: 'calendar' as ZardIcon,
      color: '#f59e0b',
      iconBg: 'rgba(245,158,11,.12)',
      hoverBg: 'rgba(245,158,11,.06)',
      borderColor: 'rgba(245,158,11,.3)',
    },
    {
      label: 'Tickets',
      description: 'Manage ticket templates',
      route: '/tickets',
      icon: 'ticket' as ZardIcon,
      color: '#10b981',
      iconBg: 'rgba(16,185,129,.12)',
      hoverBg: 'rgba(16,185,129,.06)',
      borderColor: 'rgba(16,185,129,.3)',
    },
  ];

  // ─── Computed ─────────────────────────────────────────────────────────────
  upcomingPercent = computed(() =>
    this.totalEvents() > 0
      ? Math.round((this.upcomingCount() / this.totalEvents()) * 100)
      : 0,
  );
  pastPercent = computed(() =>
    this.totalEvents() > 0
      ? Math.round((this.pastCount() / this.totalEvents()) * 100)
      : 0,
  );

  statItems = computed(() => {
    const up = this.upcomingCount();
    const past = this.pastCount();
    const all = this.totalEvents();
    return [
      {
        label: 'Total Events',
        value: all,
        sub: 'All time',
        color: '#a5b4fc',
        bgColor: 'rgba(99,102,241,.12)',
        path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      },
      {
        label: 'Upcoming',
        value: up,
        sub: up === 1 ? '1 event ahead' : `${up} events ahead`,
        color: '#10b981',
        bgColor: 'rgba(16,185,129,.12)',
        path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      },
      {
        label: 'Past Events',
        value: past,
        sub: past === 1 ? '1 event completed' : `${past} completed`,
        color: '#f59e0b',
        bgColor: 'rgba(245,158,11,.12)',
        path: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
      },
    ];
  });

  donutSegments = computed(() => {
    let cumulative = 0;
    return this.categoryStats().map((stat) => {
      const arc = (stat.percent / 100) * C;
      const offset = -cumulative;
      const seg = {
        name: stat.name,
        color: stat.color,
        dash: `${arc.toFixed(2)} ${(C - arc).toFixed(2)}`,
        offset: offset.toFixed(2),
      };
      cumulative += arc;
      return seg;
    });
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit() {
    const org = this.authService.getOrganization();
    if (org) this.organizationName.set(org.name);
    this.loadStats();
  }

  private loadStats() {
    this.loadingStats.set(true);
    forkJoin({
      events: this.eventService.getAllEvents(),
      categories: this.categoryService.getAllCategories(),
    }).subscribe({
      next: ({ events, categories }) => {
        const now = new Date();
        const total = events.length;
        const upcoming = events.filter(
          (e) => new Date(e.start_time) > now,
        ).length;
        const past = total - upcoming;

        this.totalEvents.set(total);
        this.upcomingCount.set(upcoming);
        this.pastCount.set(past);

        const catMap = new Map<number, string>(
          categories.map((c) => [c.id, c.name]),
        );
        const grouped = events.reduce(
          (acc, e) => {
            const name =
              (e as any).category?.name ||
              catMap.get(e.categoryId) ||
              'Uncategorized';
            acc[name] = (acc[name] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        const stats: CategoryStat[] = Object.entries(grouped)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count], i) => ({
            name,
            count,
            percent: total > 0 ? Math.round((count / total) * 100) : 0,
            color: COLORS[i % COLORS.length],
          }));

        this.categoryStats.set(stats);
        this.loadingStats.set(false);
      },
      error: () => this.loadingStats.set(false),
    });
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
