// src/app/features/dashboard/dashboard.ts
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LayoutModule } from '@shared/components/layout/layout.module';
import { ZardBreadcrumbModule } from '@shared/components/breadcrumb/breadcrumb.module';
import { ZardButtonComponent } from '@shared/components/button/button.component';
import { ZardDividerComponent } from '@shared/components/divider/divider.component';
import { ZardIconComponent } from '@shared/components/icon/icon.component';
import { AppSidebarComponent } from '@shared/components/app-sidebar/app-sidebar.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterOutlet,
    LayoutModule,
    AppSidebarComponent,
    ZardBreadcrumbModule,
    ZardButtonComponent,
    ZardDividerComponent,
    ZardIconComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  standalone: true,
})
export class Dashboard {
  readonly sidebarCollapsed = signal(true);

  toggleSidebar() {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  onCollapsedChange(collapsed: boolean) {
    this.sidebarCollapsed.set(collapsed);
  }
}
