import { Injectable }                    from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, forkJoin } from 'rxjs';
import { catchError, map }               from 'rxjs/operators';
import {
  OrgMembership,
  MembershipStatus,
  PendingRequest,
  ProcessRequestDto,
} from '../models/membership.model';

interface SR<T> {
  data:    T;
  success: boolean;
  message: string | null;
  errors:  string[] | null;
}
// The real shape returned by GET /members
interface MemberDto {
  userId:     number;
  userName:   string;
  email:      string;
  joinedDate: string;
  isBanned:   boolean;
}

@Injectable({ providedIn: 'root' })
export class MembershipService {
  private readonly base = 'https://eventora.runasp.net/api/OrganizationMemberShip';

  constructor(private http: HttpClient) {}

  getAllMembers(orgId: number): Observable<OrgMembership[]> {
    const members$ = this.http
      .get<SR<MemberDto[]>>(this.base + '/' + orgId + '/members')
      .pipe(
        map(r => (r.success ? (r.data ?? []) : []).map((m): OrgMembership => ({
          userId:         m.userId,
          organizationId: orgId,
          status:         m.isBanned ? MembershipStatus.Banned : MembershipStatus.Approved,
          requestDate:    m.joinedDate,
          joinDate:       m.joinedDate,
          user: {
            id:        m.userId,
            firstName: m.userName,
            email:     m.email,
          },
        })))
      );
  
    const pending$ = this.http
      .get<SR<PendingRequest[]>>(this.base + '/' + orgId + '/pending-requests')
      .pipe(
        map(r => (r.success ? (r.data ?? []) : []).map((p): OrgMembership => ({
          userId:         p.userId,
          organizationId: orgId,
          status:         MembershipStatus.Pending,
          requestDate:    p.requestDate,
          joinDate:       null,
          user: {
            id:        p.userId,
            firstName: p.userName,
            email:     p.email,
          },
        })))
      );
  
    return forkJoin([members$, pending$]).pipe(
      map(([members, pending]) => {
        const memberIds = new Set(members.map(m => m.userId));
        const uniquePending = pending.filter(p => !memberIds.has(p.userId));
        return [...members, ...uniquePending];
      }),
      catchError(this.handleError),
    );
  }

  getPendingRequests(orgId: number): Observable<PendingRequest[]> {
    return this.http
      .get<SR<PendingRequest[]>>(this.base + '/' + orgId + '/pending-requests')
      .pipe(
        map(r => r.success ? (r.data ?? []) : []),
        catchError(this.handleError),
      );
  }

  processRequest(dto: ProcessRequestDto): Observable<any> {
    return this.http
      .post<SR<any>>(this.base + '/process-request', dto)
      .pipe(catchError(this.handleError));
  }

  banUser(orgId: number, userId: number): Observable<any> {
    return this.http
      .post<SR<any>>(this.base + '/' + orgId + '/ban/' + userId, {})
      .pipe(catchError(this.handleError));
  }

  unbanUser(orgId: number, userId: number): Observable<any> {
    return this.http
      .post<SR<any>>(this.base + '/' + orgId + '/unban/' + userId, {})
      .pipe(catchError(this.handleError));
  }

  removeMember(orgId: number, userId: number): Observable<any> {
    return this.http
      .delete<SR<any>>(this.base + '/' + orgId + '/remove/' + userId)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred';
    if (error.error?.message) message = error.error.message;
    else if (Array.isArray(error.error?.errors) && error.error.errors.length)
      message = error.error.errors.join(', ');
    else if (error.message) message = error.message;
    console.error('[MembershipService]', error.status, message);
    return throwError(() => ({ error: { message } }));
  }
}