// src/app/core/services/meetup.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Meetup,
  MeetupAllDetailsDto,
  mapAllDetailsDto,
  CreateMeetupDto,
  UpdateMeetupDto,
  ServiceResponse,
} from '@core/models/meetup.model';

@Injectable({ providedIn: 'root' })
export class MeetupService {
  private readonly http = inject(HttpClient);
  private readonly base = 'https://eventora.runasp.net/api/Meetup';

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * GET /api/Meetup/AllDetails
   *
   * Returns a flat DTO — maps to canonical Meetup via mapAllDetailsDto().
   * This is the primary list used for the browse page because it includes
   * currentAttendees and isFull without requiring extra requests.
   */
  getAllDetails(): Observable<Meetup[]> {
    return this.http
      .get<ServiceResponse<MeetupAllDetailsDto[]>>(`${this.base}/AllDetails`)
      .pipe(
        map(r => (r?.data ?? []).map(mapAllDetailsDto)),
        catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
      );
  }

  /**
   * GET /api/Meetup/allMeetups
   * Returns simpler meetup objects — use getAllDetails() when you need
   * attendee counts.
   */
  getAllMeetups(): Observable<Meetup[]> {
    return this.http
      .get<ServiceResponse<Meetup[]>>(`${this.base}/allMeetups`)
      .pipe(
        map(r => r?.data ?? []),
        catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
      );
  }

  /**
   * Primary entry point for the browse page.
   * Uses AllDetails so we get currentAttendees and isFull.
   */
  getAllMeetupsWithIds(): Observable<Meetup[]> {
    return this.getAllDetails();
  }

  /** GET /api/Meetup/{id} */
  getMeetupById(id: number): Observable<Meetup> {
    return this.http
      .get<ServiceResponse<Meetup>>(`${this.base}/${id}`)
      .pipe(
        map(r => r.data),
        catchError(this.err),
      );
  }

  /** GET /api/Meetup/Details?meetupId= */
  getMeetupDetails(meetupId: number): Observable<Meetup> {
    const params = new HttpParams().set('meetupId', meetupId);
    return this.http
      .get<ServiceResponse<Meetup>>(`${this.base}/Details`, { params })
      .pipe(
        map(r => r.data),
        catchError(this.err),
      );
  }

  /** GET /api/Meetup/upcoming */
  getUpcoming(): Observable<Meetup[]> {
    return this.http
      .get<ServiceResponse<Meetup[]>>(`${this.base}/upcoming`)
      .pipe(
        map(r => r?.data ?? []),
        catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
      );
  }

  /** GET /api/Meetup/online */
  getOnline(): Observable<Meetup[]> {
    return this.http
      .get<ServiceResponse<Meetup[]>>(`${this.base}/online`)
      .pipe(
        map(r => r?.data ?? []),
        catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
      );
  }

  /** GET /api/Meetup/offline */
  getOffline(): Observable<Meetup[]> {
    return this.http
      .get<ServiceResponse<Meetup[]>>(`${this.base}/offline`)
      .pipe(
        map(r => r?.data ?? []),
        catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
      );
  }

  /** GET /api/Meetup/joinedmeetupsbyuser/{userId} */
  getJoinedByUser(userId: number): Observable<Meetup[]> {
    return this.http
      .get<ServiceResponse<Meetup[]>>(`${this.base}/joinedmeetupsbyuser/${userId}`)
      .pipe(
        map(r => r?.data ?? []),
        catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
      );
  }

  /** GET /api/Meetup/createdmeetupsbyuser/{userId} */
  getCreatedByUser(userId: number): Observable<Meetup[]> {
    return this.http
      .get<ServiceResponse<Meetup[]>>(`${this.base}/createdmeetupsbyuser/${userId}`)
      .pipe(
        map(r => r?.data ?? []),
        catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
      );
  }

  /** GET /api/Meetup/category/{categoryId} */
  getByCategory(categoryId: number): Observable<Meetup[]> {
    return this.http
      .get<ServiceResponse<Meetup[]>>(`${this.base}/category/${categoryId}`)
      .pipe(
        map(r => r?.data ?? []),
        catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
      );
  }

  /** GET /api/Meetup/nearby?userLat=&userLon=&radiusInKm= */
  getNearby(userLat: number, userLon: number, radiusInKm: number): Observable<Meetup[]> {
    const params = new HttpParams()
      .set('userLat', userLat)
      .set('userLon', userLon)
      .set('radiusInKm', radiusInKm);
    return this.http
      .get<ServiceResponse<Meetup[]>>(`${this.base}/nearby`, { params })
      .pipe(
        map(r => r?.data ?? []),
        catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
      );
  }

  // ── Mutations — all return Observable<true> on success ────────────────────
  //
  // Returning `true` means callers can safely use:
  //   subscribe(res => { if (!res) return; /* success */ })
  // catchError returns of(null) → res === null → falsy → early return.

  /** POST /api/Meetup */
  createMeetup(dto: CreateMeetupDto): Observable<true> {
    return this.http.post<any>(this.base, dto).pipe(
      map(() => true as true),
      catchError(this.err),
    );
  }

  /** PUT /api/Meetup/{id} */
  updateMeetup(id: number, dto: UpdateMeetupDto): Observable<true> {
    return this.http.put<any>(`${this.base}/${id}`, dto).pipe(
      map(() => true as true),
      catchError(this.err),
    );
  }

  /** DELETE /api/Meetup/{id} */
  deleteMeetup(id: number): Observable<true> {
    return this.http.delete<any>(`${this.base}/${id}`).pipe(
      map(() => true as true),
      catchError(this.err),
    );
  }

  /**
   * POST /api/Meetup/{meetupId}/join
   *
   * The endpoint returns HTTP 200 even on failure:
   *   { data: false, success: false, message: "Meetup not found." }
   * We inspect the envelope and throw so catchError fires properly.
   */
  joinMeetup(meetupId: number): Observable<true> {
    if (!meetupId) {
      return throwError(() => ({ error: { message: 'Invalid meetup ID.' } }));
    }

    return this.http
      .post<ServiceResponse<boolean>>(`${this.base}/${meetupId}/join`, {})
      .pipe(
        map(res => {
          if (res?.success === false) {
            // Backend returned 200 but with a failure envelope — treat as error
            throw { error: { message: res.message ?? 'Failed to join meetup.' } };
          }
          return true as true;
        }),
        catchError(this.err),
      );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private err = (e: HttpErrorResponse | any): Observable<never> => {
    const msg =
      e?.error?.message
      ?? (Array.isArray(e?.error?.errors) ? e.error.errors[0] : null)
      ?? e?.message
      ?? 'An error occurred';
    console.error('[MeetupService]', e?.status ?? '', msg);
    return throwError(() => ({ error: { message: msg } }));
  };
}