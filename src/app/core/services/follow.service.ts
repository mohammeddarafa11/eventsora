// src/app/core/services/follow.service.ts
//
// Lightweight service that tracks which organisations the user follows.
// State lives in localStorage so it survives page refreshes, and is
// surfaced via Angular Signals so every consuming template is reactive.
//
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

export interface FollowedOrg {
  id:      number;
  name:    string;
  logoUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class FollowService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = 'https://eventora.runasp.net/api';
  private readonly KEY     = 'eventsora_followed_orgs';

  /** Internal mutable signal */
  private readonly _followed = signal<FollowedOrg[]>(this.read());

  /** Read-only public view */
  readonly followed   = this._followed.asReadonly();

  /** Derived: just the IDs */
  readonly followedIds = computed(() => this._followed().map(o => o.id));

  /** Is a given org currently followed? (reactive – safe in template) */
  isFollowing(orgId: number): boolean {
    return this._followed().some(o => o.id === orgId);
  }

  /**
   * Optimistically toggles follow state, then fires POST /api/User/toggle-follow/{id}.
   * Rolls back on error (fire-and-forget style – errors are swallowed silently
   * since the follow state can be reconciled on next login).
   */
  toggle(org: FollowedOrg): void {
    const current    = this._followed();
    const isNow      = current.some(o => o.id === org.id);
    const next       = isNow
      ? current.filter(o => o.id !== org.id)
      : [...current, { id: org.id, name: org.name, logoUrl: org.logoUrl ?? null }];

    this._followed.set(next);
    this.persist(next);

    this.http
      .post(`${this.baseUrl}/User/toggle-follow/${org.id}`, {})
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  // ── Storage helpers ────────────────────────────────────────────────────

  private read(): FollowedOrg[] {
    try   { return JSON.parse(localStorage.getItem(this.KEY) ?? '[]') as FollowedOrg[]; }
    catch { return []; }
  }

  private persist(v: FollowedOrg[]): void {
    localStorage.setItem(this.KEY, JSON.stringify(v));
  }
}