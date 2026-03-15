// src/app/core/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

export type UserRole = 'user' | 'organizer';

export interface Organization {
  id: number; name: string; email: string;
  logoUrl?: string; coverUrl?: string; city?: string; region?: string; bio?: string; phoneNumber?: string;
}

export interface UserProfile {
  id: number; firstName: string; lastName: string; email: string;
  logoUrl?: string; coverUrl?: string; city?: string; region?: string; phoneNumber?: string;
  role?: string; isVerified?: boolean;
}

export interface RegisterDto {
  firstName?: string; lastName?: string; name?: string;
  email: string; password: string; phoneNumber?: string;
  city?: string; region?: string;
  role?: string; // backend requires "Role" for /Auth/register
}

export interface VerifyAccountDto { email: string; code: string; }
export interface LoginDto { email: string; password: string; }
export interface ForgotPasswordDto { email: string; }
export interface ResetPasswordDto { email: string; token: string; newPassword: string; }

export interface AuthResponse {
  data?: { token?: string; refreshToken?: string; role?: string } | string;
  success: boolean; message: string; errors?: string[]; token?: string;
}

interface OrgJwtPayload {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': string;
  OrganizationName?: string; exp: number;
}
interface UserJwtPayload {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'?: string;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string;
  FirstName?: string; LastName?: string; exp: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = 'https://eventora.runasp.net/api';

  private authState         = new BehaviorSubject<boolean>(false);
  private organizationState = new BehaviorSubject<Organization | null>(null);
  private userProfileState  = new BehaviorSubject<UserProfile | null>(null);

  public auth$         = this.authState.asObservable();
  public organization$ = this.organizationState.asObservable();
  public userProfile$  = this.userProfileState.asObservable();

  constructor() { this.checkAuthStatus(); }

  // ── Register ─────────────────────────────────────────────────────────────

  register(data: RegisterDto, role: UserRole): Observable<AuthResponse> {
    const endpoint = role === 'organizer'
      ? `${this.baseUrl}/OrganizationAuth/register`
      : `${this.baseUrl}/Auth/register`;
    // /Auth/register requires the "Role" field in the body
    const payload = role === 'user' ? { ...data, role: 'User' } : data;
    return this.http.post<AuthResponse>(endpoint, payload).pipe(
      catchError(err => this.handleAuthError(err, 'Registration')),
    );
  }

  // ── Verify email ─────────────────────────────────────────────────────────

  verifyAccount(dto: VerifyAccountDto): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/Auth/verify`, dto).pipe(
      catchError(err => this.handleAuthError(err, 'Verification')),
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  login(data: LoginDto, role: UserRole): Observable<AuthResponse> {
    const endpoint = role === 'organizer'
      ? `${this.baseUrl}/OrganizationAuth/login`
      : `${this.baseUrl}/Auth/login`;
    return this.http.post<AuthResponse>(endpoint, data).pipe(
      tap(r => { if (r.success) this.setAuthData(r, role); }),
      catchError(err => this.handleAuthError(err, 'Login')),
    );
  }

  // ── Forgot / Reset ────────────────────────────────────────────────────────

  forgotPassword(data: ForgotPasswordDto, role: UserRole): Observable<AuthResponse> {
    const ep = role === 'organizer'
      ? `${this.baseUrl}/OrganizationAuth/forgot-password`
      : `${this.baseUrl}/Auth/forgot-password`;
    return this.http.post<AuthResponse>(ep, data).pipe(catchError(e => this.handleAuthError(e, 'Forgot')));
  }

  resetPassword(data: ResetPasswordDto, role: UserRole): Observable<AuthResponse> {
    const ep = role === 'organizer'
      ? `${this.baseUrl}/OrganizationAuth/reset-password`
      : `${this.baseUrl}/Auth/reset-password`;
    return this.http.post<AuthResponse>(ep, data).pipe(catchError(e => this.handleAuthError(e, 'Reset')));
  }

  // ── Token / profile ───────────────────────────────────────────────────────

  private setAuthData(r: AuthResponse, role: UserRole): void {
    const token = typeof r.data === 'string' ? r.data : (r.data as any)?.token || r.token;
    if (!token) { console.warn('No token in response'); return; }
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_role', role);
    this.authState.next(true);
    role === 'organizer' ? this.extractOrganizationFromToken(token) : this.extractUserFromToken(token);
  }

  private extractOrganizationFromToken(token: string): void {
    try {
      const d = jwtDecode<OrgJwtPayload>(token);
      const org: Organization = {
        id:    parseInt(d['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']),
        name:  d['OrganizationName'] || 'Unknown Organization',
        email: d['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
      };
      this.organizationState.next(org);
      localStorage.setItem('organization', JSON.stringify(org));
    } catch (e) { console.error('Org token decode failed', e); }
  }

  private extractUserFromToken(token: string): void {
    try {
      const d = jwtDecode<UserJwtPayload>(token);
      const user: UserProfile = {
        id:        parseInt(d['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']),
        firstName: d['FirstName'] || d['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || '',
        lastName:  d['LastName']  || d['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname']    || '',
        email:     d['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
        role:      d['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
      };
      this.userProfileState.next(user);
      localStorage.setItem('user_profile', JSON.stringify(user));
    } catch (e) { console.error('User token decode failed', e); }
  }

  logout(): void {
    ['auth_token','auth_role','organization','user_profile','user_categories'].forEach(k => localStorage.removeItem(k));
    this.organizationState.next(null);
    this.userProfileState.next(null);
    this.authState.next(false);
  }

  getToken(): string | null   { return localStorage.getItem('auth_token'); }
  getRole():  UserRole | null { return localStorage.getItem('auth_role') as UserRole | null; }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const { exp } = jwtDecode<{ exp: number }>(token);
      if (exp < Date.now() / 1000) { this.logout(); return false; }
      return true;
    } catch { this.logout(); return false; }
  }

  isOrganizer(): boolean { return this.getRole() === 'organizer' && this.isAuthenticated(); }
  isUser():      boolean { return this.getRole() === 'user'      && this.isAuthenticated(); }
  getDashboardRoute(): string { return this.getRole() === 'organizer' ? '/dashboard' : '/user-dashboard'; }

  getOrganization(): Organization | null {
    if (this.organizationState.value) return this.organizationState.value;
    try {
      const s = localStorage.getItem('organization');
      if (s) { const o = JSON.parse(s); this.organizationState.next(o); return o; }
    } catch { /* ignore */ }
    return null;
  }

  getUserProfile(): UserProfile | null {
    if (this.userProfileState.value) return this.userProfileState.value;
    try {
      const s = localStorage.getItem('user_profile');
      if (s) { const u = JSON.parse(s); this.userProfileState.next(u); return u; }
    } catch { /* ignore */ }
    return null;
  }

  getSavedCategoryIds(): number[] {
    try { const s = localStorage.getItem('user_categories'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  }

  saveCategoryIds(ids: number[]): void { localStorage.setItem('user_categories', JSON.stringify(ids)); }

  private checkAuthStatus(): void {
    const isAuth = this.isAuthenticated();
    this.authState.next(isAuth);
    if (!isAuth) return;
    if (this.getRole() === 'organizer') { if (!this.getOrganization()) this.logout(); }
    else this.getUserProfile();
  }

  private handleAuthError(error: any, ctx: string): Observable<never> {
    let message = `${ctx} failed`;
    if      (error.status === 400) message = error.error?.message || error.error?.errors?.[0] || 'Invalid data';
    else if (error.status === 401) message = 'Unauthorized. Check your credentials.';
    else if (error.status === 404) message = 'Account not found. Please sign up first.';
    else if (error.error?.message)          message = error.error.message;
    else if (error.error?.errors?.length)   message = error.error.errors.join(', ');
    else if (typeof error.error === 'string') message = error.error;
    return throwError(() => ({ error: { message } }));
  }
}