// src/app/core/services/meetup.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Meetup, CreateMeetupDto, UpdateMeetupDto, ServiceResponse } from '@core/models/meetup.model';
import { forkJoin, switchMap } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class MeetupService {
  private readonly http = inject(HttpClient);
  private readonly base = 'https://eventora.runasp.net/api/Meetup';

  // ── Token reader ─────────────────────────────────────────────────────────

  private getToken(): string | null {
    const keys = [
      'auth_token', 'token', 'accessToken', 'access_token',
      'authToken', 'jwt', 'bearerToken', 'id_token',
    ];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      if (raw.startsWith('eyJ')) return raw;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string' && parsed.startsWith('eyJ')) return parsed;
        const inner = parsed?.token ?? parsed?.accessToken ?? parsed?.access_token ?? parsed?.jwt;
        if (typeof inner === 'string' && inner.startsWith('eyJ')) return inner;
      } catch { /* not JSON */ }
    }
    return null;
  }

  private authHeaders(): HttpHeaders {
    const token = this.getToken();
    if (!token) {
      console.warn('[MeetupService] No token found — request will be unauthenticated');
      return new HttpHeaders();
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  getAllDetails(): Observable<Meetup[]> {
    return this.http.get<any>(`${this.base}/AllDetails`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapMeetups(r)),
      catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
    );
  }

  getAllMeetups(): Observable<Meetup[]> {
    return this.http.get<any>(`${this.base}/allMeetups`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapMeetups(r)),
      catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
    );
  }

  getAllMeetupsWithIds(): Observable<Meetup[]> {
   return this.getAllDetails().pipe(
     switchMap(list => {
       if (!list.length) return of([] as Meetup[]);
 
       // Collect unique managerIds
       const managerIds = [...new Set(
         list
           .map((m: any) => m.managerId)
           .filter((id: any) => id != null && id !== 0)
       )] as number[];
 
       if (!managerIds.length) return of(list);
 
       // Fetch each manager's full meetups (which include real `id`)
       return forkJoin(
         managerIds.map(mId =>
           this.getCreatedByUser(mId).pipe(catchError(() => of([] as Meetup[])))
         )
       ).pipe(
         map((results: Meetup[][]) => {
           // Build lookup keyed by "managerId|title|startTime" for precision
           const idMap = new Map<string, number>();
           results.flat().forEach(m => {
             if (m.id != null) {
               const key = `${m.managerId}|${(m.title ?? '').trim().toLowerCase()}|${m.start_Time}`;
               idMap.set(key, m.id);
             }
           });
 
           return list.map((m: any) => {
             const key = `${m.managerId}|${(m.title ?? '').trim().toLowerCase()}|${m.start_Time}`;
             const resolvedId = idMap.get(key);
 
             // Log so you can verify in console
             if (!resolvedId) {
               console.warn('[MeetupService] Could not resolve id for meetup:', m.title, 'key:', key);
               console.log('[MeetupService] Available keys:', [...idMap.keys()]);
             }
 
             return {
               ...m,
               id: resolvedId,
               maxAttendees: m.maxAttendees ?? m.max_Participants ?? null,
             } as Meetup;
           });
         })
       );
     }),
     catchError((e: HttpErrorResponse) => {
       if (e.status === 404) return of([] as Meetup[]);
       return this.err(e);
     })
   );
 }

  getMeetupById(id: number): Observable<Meetup> {
    return this.http.get<any>(`${this.base}/${id}`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapSingle(r)),
      catchError(this.err),
    );
  }

  getMeetupDetails(meetupId: number): Observable<Meetup> {
    return this.http.get<any>(`${this.base}/Details?meetupId=${meetupId}`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapSingle(r)),
      catchError(this.err),
    );
  }

  getUpcoming(): Observable<Meetup[]> {
    return this.http.get<any>(`${this.base}/upcoming`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapMeetups(r)),
      catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
    );
  }

  getOnline(): Observable<Meetup[]> {
    return this.http.get<any>(`${this.base}/online`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapMeetups(r)),
      catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
    );
  }

  getOffline(): Observable<Meetup[]> {
    return this.http.get<any>(`${this.base}/offline`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapMeetups(r)),
      catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
    );
  }

  getJoinedByUser(userId: number): Observable<Meetup[]> {
    return this.http.get<any>(`${this.base}/joinedmeetupsbyuser/${userId}`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapMeetups(r)),
      catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
    );
  }

  getCreatedByUser(userId: number): Observable<Meetup[]> {
    return this.http.get<any>(`${this.base}/createdmeetupsbyuser/${userId}`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapMeetups(r)),
      catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
    );
  }

  getByCategory(categoryId: number): Observable<Meetup[]> {
    return this.http.get<any>(`${this.base}/category/${categoryId}`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapMeetups(r)),
      catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
    );
  }

  getNearby(userLat: number, userLon: number, radiusInKm: number): Observable<Meetup[]> {
    return this.http.get<any>(`${this.base}/nearby?userLat=${userLat}&userLon=${userLon}&radiusInKm=${radiusInKm}`, { headers: this.authHeaders() }).pipe(
      map(r => this.unwrapMeetups(r)),
      catchError((e: HttpErrorResponse) => e.status === 404 ? of([]) : this.err(e)),
    );
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  createMeetup(dto: CreateMeetupDto): Observable<ServiceResponse<Meetup>> {
    return this.http.post<ServiceResponse<Meetup>>(this.base, dto, { headers: this.authHeaders() })
      .pipe(catchError(this.err));
  }

  updateMeetup(id: number, dto: UpdateMeetupDto): Observable<ServiceResponse<Meetup>> {
    return this.http.put<ServiceResponse<Meetup>>(`${this.base}/${id}`, dto, { headers: this.authHeaders() })
      .pipe(catchError(this.err));
  }

  deleteMeetup(id: number): Observable<ServiceResponse<unknown>> {
    return this.http.delete<ServiceResponse<unknown>>(`${this.base}/${id}`, { headers: this.authHeaders() })
      .pipe(catchError(this.err));
  }

  joinMeetup(meetupId: number): Observable<ServiceResponse<unknown>> {
   console.log('[JOIN] firing with meetupId =', meetupId, typeof meetupId); // ← add this
   if (!meetupId) {
     return throwError(() => ({ error: { message: 'Invalid meetup ID.' } }));
   }
   return this.http.post<ServiceResponse<unknown>>(
     `${this.base}/${meetupId}/join`, {}, { headers: this.authHeaders() }
   ).pipe(catchError(this.err));
 }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Normalises every object in the array so that `id` is always populated.
   * The API sometimes returns `meetupId` instead of `id`.
   */
  private normalizeItem(raw: any): Meetup {
    return {
      ...raw,
      // Resolve id from all known field names
      id: raw.id ?? raw.meetupId ?? raw.MeetupId ?? raw.meetup_id,
    } as Meetup;
  }

  private unwrapMeetups(r: any): Meetup[] {
    let arr: any[];
    if (Array.isArray(r))        arr = r;
    else if (Array.isArray(r?.data)) arr = r.data;
    else return [];
    return arr.map(item => this.normalizeItem(item));
  }

  private unwrapSingle(r: any): Meetup {
    if (r?.id !== undefined || r?.meetupId !== undefined) return this.normalizeItem(r);
    if (r?.data)                                          return this.normalizeItem(r.data);
    throw new Error(r?.message ?? 'Meetup not found');
  }

  private err = (e: HttpErrorResponse): Observable<never> => {
    const msg =
      e.error?.message ||
      (Array.isArray(e.error?.errors) && e.error.errors[0]) ||
      e.message ||
      'An error occurred';
    console.error('[MeetupService]', e.status, msg);
    return throwError(() => ({ error: { message: msg } }));
  };
}