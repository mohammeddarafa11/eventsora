 // src/app/core/guards/guest.guard.ts
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { inject } from '@angular/core';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && authService.getRole() === 'organizer') {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};