// src/app/core/services/user.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { UserProfile } from './auth.service';
import { Category } from '@core/services/category'; // ← required for getFavorites()

// ─────────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────────

export interface ServiceResponse<T> {
  data: T;
  success: boolean;
  message: string | null;
  errors: string[] | null;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  logoUrl?: string;
  coverUrl?: string;
  city?: string;
  region?: string;
  street?: string;
}

export interface UserBooking {
  id: number;
  ticketUniqueCode: string;
  isUsed: boolean;
  usedAt?: string;
  purchaseDate: string;
  eventTicket?: {
    id: number;
    actualPrice: number;
    event?: {
      id: number;
      title: string;
      start_time: string;
      event_img_url?: string;
      city?: string;
    };
  };
}

// ─────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = 'https://eventora.runasp.net/api';

  private currentUser$ = new BehaviorSubject<UserProfile | null>(null);

  /** Observable of the currently-logged-in user profile */
  get user$(): Observable<UserProfile | null> {
    return this.currentUser$.asObservable();
  }

  // ══════════════════════════════════════════
  // PROFILE
  // ══════════════════════════════════════════

  /**
   * Fetch the current authenticated user's profile.
   * Maps GET /api/User → UserProfile
   */
  getCurrentUser(): Observable<UserProfile> {
    return this.http
      .get<ServiceResponse<UserProfile>>(`${this.baseUrl}/User`)
      .pipe(
        map(response => {
          if (response.success) return response.data;
          throw new Error(response.message || 'Failed to fetch user profile');
        }),
        tap(user => {
          this.currentUser$.next(user);
          localStorage.setItem('user_profile', JSON.stringify(user));
        }),
        catchError(this.handleError),
      );
  }

  /**
   * Update user profile.
   * PUT /api/User/{id}
   */
  updateUser(id: number, dto: UpdateUserDto): Observable<UserProfile> {
    return this.http
      .put<ServiceResponse<UserProfile>>(`${this.baseUrl}/User/${id}`, dto)
      .pipe(
        map(response => {
          if (response.success) return response.data;
          throw new Error(response.message || 'Failed to update user');
        }),
        tap(user => {
          this.currentUser$.next(user);
          localStorage.setItem('user_profile', JSON.stringify(user));
        }),
        catchError(this.handleError),
      );
  }

  // ══════════════════════════════════════════
  // BOOKINGS
  // ══════════════════════════════════════════

  /** GET /api/Ticket/MyBookings */
  getMyBookings(): Observable<UserBooking[]> {
    return this.http
      .get<ServiceResponse<UserBooking[]>>(`${this.baseUrl}/Ticket/MyBookings`)
      .pipe(
        map(response => {
          if (response.success) return response.data ?? [];
          throw new Error(response.message || 'Failed to fetch bookings');
        }),
        catchError(this.handleError),
      );
  }

  // ══════════════════════════════════════════
  // FOLLOW / FAVORITES
  // ══════════════════════════════════════════

  /** POST /api/User/toggle-follow/{organizationId} */
  toggleFollow(organizationId: number): Observable<ServiceResponse<unknown>> {
    return this.http
      .post<ServiceResponse<unknown>>(
        `${this.baseUrl}/User/toggle-follow/${organizationId}`,
        {},
      )
      .pipe(catchError(this.handleError));
  }

  /** POST /api/User/add-favorites  (array of categoryIds) */
  addFavorites(categoryIds: number[]): Observable<ServiceResponse<unknown>> {
    return this.http
      .post<ServiceResponse<unknown>>(
        `${this.baseUrl}/User/add-favorites`,
        categoryIds,
      )
      .pipe(catchError(this.handleError));
  }

  /** GET /api/User/favorites — returns the user's saved category list */
  getFavorites(): Observable<Category[]> {
    return this.http
      .get<ServiceResponse<Category[]>>(`${this.baseUrl}/User/favorites`)
      .pipe(
        map(r => (r.success ? r.data ?? [] : [])),
        catchError(this.handleError),
      );
  }

  /** DELETE /api/User/remove-favorite/{categoryId} */
  removeFavorite(categoryId: number): Observable<ServiceResponse<unknown>> {
    return this.http
      .delete<ServiceResponse<unknown>>(
        `${this.baseUrl}/User/remove-favorite/${categoryId}`,
      )
      .pipe(catchError(this.handleError));
  }

  // ══════════════════════════════════════════
  // CACHE HELPERS
  // ══════════════════════════════════════════

  getCachedUser(): UserProfile | null {
    return this.currentUser$.value;
  }

  clearUser(): void {
    this.currentUser$.next(null);
    localStorage.removeItem('user_profile');
  }

  // ══════════════════════════════════════════
  // ERROR HANDLING
  // ══════════════════════════════════════════

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An error occurred';
    if (error.error instanceof ErrorEvent) {
      message = error.error.message;
    } else {
      message =
        error.error?.message ||
        error.error?.errors?.join(', ') ||
        `Error ${error.status}: ${error.message}`;
    }
    console.error('[UserService]', message);
    return throwError(() => new Error(message));
  }
}