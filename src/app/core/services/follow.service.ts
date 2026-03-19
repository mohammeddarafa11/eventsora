// src/app/core/services/follow.service.ts
//
// Single service that owns ALL /api/User state:
//
//   GET    /api/User                              → load profile + followed orgs
//   PUT    /api/User/{id}                         → update profile
//   POST   /api/User/toggle-follow/{orgId}        → follow / unfollow
//   GET    /api/User/favorites                    → favorite categories
//   POST   /api/User/add-favorites                → add favorite categories
//   DELETE /api/User/remove-favorite/{categoryId} → remove favorite category
//
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse }         from '@angular/common/http';
import { Observable, throwError, of, forkJoin }  from 'rxjs';
import { catchError, map, tap }                  from 'rxjs/operators';

// ── Public types ──────────────────────────────────────────────────────────────

export interface FollowedOrg {
  id:       number;
  name:     string | null;
  logoUrl?: string | null;
}

export interface FavoriteCategory {
  id:   number;
  name: string | null;
}

export interface UserProfile {
  id:           number;
  firstName?:   string | null;
  lastName?:    string | null;
  email?:       string | null;
  phoneNumber?: string | null;
  logoUrl?:     string | null;
  coverUrl?:    string | null;
  city?:        string | null;
  region?:      string | null;
  street?:      string | null;
  role?:        string | null;
  isVerified?:  boolean;
}

export interface UpdateUserDto {
  firstName?:   string | null;
  lastName?:    string | null;
  phoneNumber?: string | null;
  logoUrl?:     string | null;
  coverUrl?:    string | null;
  city?:        string | null;
  region?:      string | null;
  street?:      string | null;
}

// ── Internal shapes from the API ──────────────────────────────────────────────

interface UserOrgEntry {
  organizationId?: number;
  organization?: {
    id?:      number;
    name?:    string | null;
    logoUrl?: string | null;
  } | null;
}

interface RawUser extends UserProfile {
  userOrganizations?: UserOrgEntry[] | null;
  userCategories?:    { categoryId?: number; category?: FavoriteCategory | null }[] | null;
}

// API can return the object directly OR wrapped in { data, success }
type MaybeWrapped<T> = T | { data: T; success: boolean; message?: string | null };

function unwrap<T>(res: MaybeWrapped<T>): T {
  const w = res as { data?: T; success?: boolean };
  if (w?.data !== undefined && w.data !== null && typeof w.data === 'object') {
    return w.data;
  }
  return res as T;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class FollowService {
  private readonly http = inject(HttpClient);
  private readonly base = 'https://eventora.runasp.net/api/User';

  // ── State signals ─────────────────────────────────────────────────────────
  private readonly _profile   = signal<UserProfile | null>(null);
  private readonly _followed  = signal<FollowedOrg[]>([]);
  private readonly _favorites = signal<FavoriteCategory[]>([]);
  private readonly _loaded    = signal(false);
  private readonly _loading   = signal(false);

  // ── Public read-only API ──────────────────────────────────────────────────
  readonly profile     = this._profile.asReadonly();
  readonly followed    = this._followed.asReadonly();
  readonly favorites   = this._favorites.asReadonly();
  readonly loaded      = this._loaded.asReadonly();
  readonly loading     = this._loading.asReadonly();
  readonly followedIds = computed(() => this._followed().map(o => o.id));
  readonly favoriteIds = computed(() => this._favorites().map(c => c.id));

  isFollowing(orgId: number): boolean {
    return this._followed().some(o => o.id === orgId);
  }

  isFavorite(catId: number): boolean {
    return this._favorites().some(c => c.id === catId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/User  +  GET /api/User/favorites
  // Call once after login. Loads profile, follow list, and favorites together.
  // ──────────────────────────────────────────────────────────────────────────
  load(force = false): void {
    if ((this._loaded() || this._loading()) && !force) return;

    this._loading.set(true);

    forkJoin({
      user:      this.http.get<MaybeWrapped<RawUser>>(this.base),
      favorites: this.http.get<MaybeWrapped<FavoriteCategory[]>>(`${this.base}/favorites`),
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        console.error('[FollowService] load failed:', err.status, err.message);
        this._loading.set(false);
        return of(null);
      }),
    ).subscribe(result => {
      if (!result) return;

      // ── Profile ──────────────────────────────────────────────────────────
      const user = unwrap<RawUser>(result.user);
      const { userOrganizations, userCategories, ...profileFields } = user as any;
      this._profile.set(profileFields as UserProfile);

      // ── Followed orgs (from userOrganizations on the User object) ─────────
      const orgs: FollowedOrg[] = (userOrganizations ?? [])
        .map((uo: UserOrgEntry): FollowedOrg => ({
          id:      uo.organization?.id      ?? uo.organizationId ?? 0,
          name:    uo.organization?.name    ?? null,
          logoUrl: uo.organization?.logoUrl ?? null,
        }))
        .filter((o: FollowedOrg) => o.id !== 0);

      this._followed.set(orgs);

      // ── Favorites (from dedicated endpoint) ───────────────────────────────
      const raw = unwrap<FavoriteCategory[]>(result.favorites);
      this._favorites.set(Array.isArray(raw) ? raw : []);

      this._loaded.set(true);
      this._loading.set(false);
    });
  }

  /** Force re-sync from server (e.g. after page refresh or navigation). */
  reload(): void { this.load(true); }

  // ──────────────────────────────────────────────────────────────────────────
  // PUT /api/User/{id}
  // ──────────────────────────────────────────────────────────────────────────
  updateProfile(id: number, dto: UpdateUserDto): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, dto).pipe(
      tap(() => {
        const current = this._profile();
        if (current) this._profile.set({ ...current, ...dto });
      }),
      catchError(this.handleError),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/User/toggle-follow/{organizationId}
  // Optimistic update → rolls back on failure.
  // ──────────────────────────────────────────────────────────────────────────
  toggle(org: FollowedOrg): void {
    const before     = this._followed();
    const isNow      = before.some(o => o.id === org.id);
    const next       = isNow
      ? before.filter(o => o.id !== org.id)
      : [...before, { id: org.id, name: org.name, logoUrl: org.logoUrl ?? null }];

    this._followed.set(next);  // optimistic

    this.http.post(`${this.base}/toggle-follow/${org.id}`, {}).pipe(
      catchError((err: HttpErrorResponse) => {
        this._followed.set(before);  // roll back
        console.error('[FollowService] toggle-follow failed:', err.status, err.message);
        return of(null);
      }),
    ).subscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/User/favorites
  // ──────────────────────────────────────────────────────────────────────────
  loadFavorites(): Observable<FavoriteCategory[]> {
    return this.http.get<MaybeWrapped<FavoriteCategory[]>>(`${this.base}/favorites`).pipe(
      map(res => {
        const cats = unwrap<FavoriteCategory[]>(res);
        const list = Array.isArray(cats) ? cats : [];
        this._favorites.set(list);
        return list;
      }),
      catchError((err: HttpErrorResponse) => {
        console.error('[FollowService] loadFavorites failed:', err.status, err.message);
        return of([] as FavoriteCategory[]);
      }),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/User/add-favorites   body: number[]
  // ──────────────────────────────────────────────────────────────────────────
  addFavorites(categoryIds: number[]): Observable<void> {
    if (!categoryIds.length) return of(undefined);

    // Optimistic: add stubs immediately; real names arrive on next loadFavorites()
    const before = this._favorites();
    const newIds = categoryIds.filter(id => !before.some(c => c.id === id));
    this._favorites.set([...before, ...newIds.map(id => ({ id, name: null }))]);

    return this.http.post<void>(`${this.base}/add-favorites`, categoryIds).pipe(
      catchError((err: HttpErrorResponse) => {
        this._favorites.set(before);  // roll back
        console.error('[FollowService] addFavorites failed:', err.status, err.message);
        return throwError(() => err);
      }),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /api/User/remove-favorite/{categoryId}
  // ──────────────────────────────────────────────────────────────────────────
  removeFavorite(categoryId: number): Observable<void> {
    const before = this._favorites();
    this._favorites.set(before.filter(c => c.id !== categoryId));  // optimistic

    return this.http.delete<void>(`${this.base}/remove-favorite/${categoryId}`).pipe(
      catchError((err: HttpErrorResponse) => {
        this._favorites.set(before);  // roll back
        console.error('[FollowService] removeFavorite failed:', err.status, err.message);
        return throwError(() => err);
      }),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Clear on logout
  // ──────────────────────────────────────────────────────────────────────────
  clear(): void {
    this._profile.set(null);
    this._followed.set([]);
    this._favorites.set([]);
    this._loaded.set(false);
    this._loading.set(false);
  }

  // ── Private ───────────────────────────────────────────────────────────────
  private handleError(err: HttpErrorResponse): Observable<never> {
    const msg = err.error?.message
      ?? (Array.isArray(err.error?.errors) ? err.error.errors.join(', ') : null)
      ?? err.message ?? 'An error occurred';
    console.error('[FollowService]', err.status, msg);
    return throwError(() => ({ error: { message: msg } }));
  }
}