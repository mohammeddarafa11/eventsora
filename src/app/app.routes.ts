// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing').then((m) => m.LandingComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-home/dashboard-home').then(
            (m) => m.DashboardHomeComponent,
          ),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./features/events/events-page/events-page').then(
            (m) => m.EventsPageComponent,
          ),
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./features/tickets/tickets-page/tickets-page').then(
            (m) => m.TicketsPageComponent,
          ),
      },
      {
        path: 'members',
        loadComponent: () =>
          import('./features/members/memberships-page').then(
            (m) => m.MembershipsPageComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];