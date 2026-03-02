// src/app/shared/components/app-sidebar/app-sidebar.component.ts
import { Component, computed, inject, input, output } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { DarkModeService } from '@core/services/darkmode.service';
import { LayoutModule } from '@shared/components/layout/layout.module';
import { ZardAvatarComponent } from '@shared/components/avatar/avatar.component';
import { ZardButtonComponent } from '@shared/components/button/button.component';
import { ZardDividerComponent } from '@shared/components/divider/divider.component';
import { ZardIconComponent } from '@shared/components/icon/icon.component';
import { type ZardIcon } from '@shared/components/icon/icons';
import { ZardMenuModule } from '@shared/components/menu/menu.module';
import { ZardTooltipDirective } from '@shared/components/tooltip/tooltip';
import { AuthService } from '../../../core/services/auth.service';

export interface MenuItem {
  icon: ZardIcon;
  label: string;
  route?: string;
  submenu?: { label: string; route?: string }[];
}

@Component({
  selector: 'app-sidebar',
  imports: [
    LayoutModule,
    ZardAvatarComponent,
    ZardButtonComponent,
    ZardDividerComponent,
    ZardIconComponent,
    ZardMenuModule,
    ZardTooltipDirective,
  ],
  templateUrl: './app-sidebar.component.html',
  standalone: true,
})
export class AppSidebarComponent {
  // 👇 Default to true → collapsed by default (mobile‑first)
  collapsed = input<boolean>(true);
  collapsedChange = output<boolean>();

  private router = inject(Router);
  private darkModeService = inject(DarkModeService);
  private authService = inject(AuthService);

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  themeIcon = computed(() => {
    const isDark = this.darkModeService.isCurrentlyDark();
    return (isDark ? 'sun' : 'moon') as ZardIcon;
  });

  private organization = computed(() => this.authService.getOrganization());
  orgName = computed(() => this.organization()?.name ?? 'Organization');
  orgEmail = computed(() => this.organization()?.email ?? '');
  orgInitials = computed(() => {
    const name = this.orgName();
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  });

  mainMenuItems: MenuItem[] = [
    { icon: 'house' as ZardIcon, label: 'Home', route: '/dashboard' },
  ];

  workspaceMenuItems: MenuItem[] = [
    {
      icon: 'calendar' as ZardIcon,
      label: 'Events',
      route: '/events',
    },
    {
      icon: 'ticket' as ZardIcon,
      label: 'Tickets',
      route: '/tickets',
    },
  ];

  currentPageName = computed(() => {
    const url = this.currentUrl() ?? '';
    const allItems = [...this.mainMenuItems, ...this.workspaceMenuItems];
    const match = allItems.find((item) => item.route && url.startsWith(item.route));
    return match?.label ?? 'Dashboard';
  });

  navigateTo(route: string) {
    if (route) {
      this.router.navigate([route]);
    }
  }

  toggleTheme() {
    this.darkModeService.toggleTheme();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}