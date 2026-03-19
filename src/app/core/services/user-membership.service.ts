// src/app/core/services/user-membership.service.ts

import { Injectable }                    from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, forkJoin } from 'rxjs';
import { catchError, map }               from 'rxjs/operators';

import { OrganizationService, Organization } from './organization.service';
import { MembershipStatus }                  from '../models/membership.model';
import { UserOrgMembership, OrgSummary }     from '../models/user-membership.model';

interface SR<T> { data: T; success: boolean; message: string | null; errors: string[] | null; }

// Raw shape returned by GET /api/OrganizationMemberShip/user/organizations
interface UserOrgDto {
  userId:         number;
  organizationId: number;
  status:         MembershipStatus;
  requestDate:    string;
  joinDate?:      string | null;
  organization?:  OrgSummary | null;   // usually null — we enrich it ourselves
}

@Injectable({ providedIn: 'root' })
export class UserMembershipService {
  private readonly base = 'https://eventora.runasp.net/api/OrganizationMemberShip';

  constructor(
    private http:    HttpClient,
    private orgSvc:  OrganizationService,   // ← inject to get full org details
  ) {}

  /**
   * Returns the user's memberships enriched with full org data.
   * Combines:
   *   GET /api/OrganizationMemberShip/user/organizations  (membership status)
   *   GET /api/Organization/all                           (org names / logos / etc.)
   */
  getMyMemberships(): Observable<UserOrgMembership[]> {
    const memberships$ = this.http
      .get<SR<UserOrgDto[]>>(this.base + '/user/organizations')
      .pipe(map(r => (r.success ? (r.data ?? []) : [])));

    const orgs$ = this.orgSvc.getAllOrganizations();   // returns Organization[]

    return forkJoin([memberships$, orgs$]).pipe(
      map(([memberships, orgs]) => {
        // Build a quick lookup map: orgId → Organization
        const orgMap = new Map<number, Organization>(orgs.map(o => [o.id, o]));

        return memberships.map((d): UserOrgMembership => {
          const org = orgMap.get(d.organizationId);
          return {
            userId:         d.userId,
            organizationId: d.organizationId,
            status:         d.status,
            requestDate:    d.requestDate,
            joinDate:       d.joinDate ?? null,
            organization:   org
              ? {
                  id:       org.id,
                  name:     org.name,
                  logoUrl:  org.logoUrl,
                  coverUrl: org.coverUrl,
                  city:     org.city,
                  region:   org.region,
                  bio:      org.bio,
                  email:    org.email,
                  status:   org.status,
                }
              : null,
          };
        });
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Delegates to OrganizationService so the component always gets
   * fully-shaped org objects for the Browse tab.
   */
  getAllOrganizations(): Observable<OrgSummary[]> {
    return this.orgSvc.getAllOrganizations().pipe(
      map(orgs => orgs.map(o => ({
        id:       o.id,
        name:     o.name,
        logoUrl:  o.logoUrl,
        coverUrl: o.coverUrl,
        city:     o.city,
        region:   o.region,
        bio:      o.bio,
        email:    o.email,
        status:   o.status,
      }))),
      catchError(this.handleError),
    );
  }

  /** POST /api/OrganizationMemberShip/{OrgId}/join */
  joinOrganization(orgId: number): Observable<any> {
    return this.http
      .post<SR<any>>(this.base + '/' + orgId + '/join', {})
      .pipe(catchError(this.handleError));
  }

  /** POST /api/OrganizationMemberShip/{orgId}/leave */
  leaveOrganization(orgId: number): Observable<any> {
    return this.http
      .post<SR<any>>(this.base + '/' + orgId + '/leave', {})
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred';
    if (error.error?.message)                                                message = error.error.message;
    else if (Array.isArray(error.error?.errors) && error.error.errors.length) message = error.error.errors.join(', ');
    else if (error.message)                                                  message = error.message;
    console.error('[UserMembershipService]', error.status, message);
    return throwError(() => ({ error: { message } }));
  }
}