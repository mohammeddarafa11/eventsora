// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard }       from './core/guards/auth.guard';
import { guestGuard }      from './core/guards/guest.guard';
import { organizerGuard }  from './core/guards/organizer.guard';
import { userRoleGuard }   from './core/guards/user-role.guard';
import { EventDetail }     from './features/event-detail/event-detail';

export const routes: Routes = [

  // ── PUBLIC ──────────────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing').then(m => m.LandingComponent),
    canActivate: [guestGuard],
  },

  // ── ORGANIZER DASHBOARD ─────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard, organizerGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-home/dashboard-home').then(
            m => m.DashboardHomeComponent,
          ),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./features/events/events-page/events-page').then(
            m => m.EventsPageComponent,
          ),
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./features/tickets/tickets-page/tickets-page').then(
            m => m.TicketsPageComponent,
          ),
      },
      {
        path: 'members',
        loadComponent: () =>
          import('./features/members/memberships-page').then(
            m => m.MembershipsPageComponent,
          ),
      },
      // Ticket verification — organizer scans UUID at entry
      {
        path: 'verify-ticket',
        loadComponent: () =>
          import('./features/tickets/verify-ticket/verify-ticket').then(
            m => m.VerifyTicketComponent,
          ),
      },
    ],
  },

  // ── CATEGORY ONBOARDING ─────────────────────────────────────────────────
  {
    path: 'select-categories',
    loadComponent: () =>
      import('./features/auth/category-select-sheet/category-select-sheet').then(
        m => m.CategorySelectPage,
      ),
    canActivate: [authGuard, userRoleGuard],
  },

  // ── USER DASHBOARD ───────────────────────────────────────────────────────
  {
    path: 'user-dashboard',
    loadComponent: () =>
      import('./features/user-dashboard/user-dashboard').then(
        m => m.UserDashboard,
      ),
    canActivate: [authGuard, userRoleGuard],
    children: [

      // Home feed (For You · Who to Follow · Following · Trending)
      {
        path: '',
        loadComponent: () =>
          import('./features/user-dashboard/user-dashboard-home/user-dashboard-home').then(
            m => m.UserDashboardHome,
          ),
      },

      // Event detail (Follow Org + post-booking prompt)
      { path: 'events/:id', component: EventDetail },

      // My ticket bookings
      {
        path: 'bookings',
        loadComponent: () =>
          import('./features/user-dashboard/user-bookings/user-bookings').then(
            m => m.UserBookingsComponent,
          ),
      },

      // Edit genre interests
      {
        path: 'edit-interests',
        loadComponent: () =>
          import('./features/user-dashboard/edit-interests/edit-interests').then(
            m => m.EditInterests,
          ),
      },

      // ── MEETUPS ────────────────────────────────────────────────────────
      // Browse all community meetups + join via POST /api/Meetup/{id}/join
      {
        path: 'meetups',
        loadComponent: () =>
          import('./features/user-dashboard/meetups/meetups-page').then(
            m => m.MeetupsPage,
          ),
      },

      // Meetups the user has joined — GET /api/Meetup/joinedmeetupsbyuser/{id}
      {
        path: 'my-meetups',
        loadComponent: () =>
          import('./features/user-dashboard/my-meetups/my-meetups').then(
            m => m.MyMeetupsPage,
          ),
      },

      {
        path: 'my-created-meetups',
        loadComponent: () =>
          import('./features/user-dashboard/my-created-meetups/my-created-meetups').then(
            c => c.MyCreatedMeetupsPage,
          ),
      },

      {
        path: 'my-memberships',
        loadComponent: () =>
          import('./features/user-dashboard/my-memberships/my-memberships').then(
            m => m.MyMembershipsPage,
          ),
      },

      // Private events the user has access to — GET /api/Event/PrivateEventsByUserId
      {
        path: 'my-private-events',
        loadComponent: () =>
          import('./features/user-dashboard/my-private-events/my-private-events').then(
            m => m.MyPrivateEventsPage,
          ),
      },

    ],
  },

  // ── FALLBACK ─────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];