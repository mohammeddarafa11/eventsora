// src/app/shared/pipes/member-filter.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';
import { OrgMembership }       from '@core/models/membership.model';

@Pipe({
  name: 'memberSearch',
  standalone: true,
  pure: false,
})
export class MemberFilterPipe implements PipeTransform {

  transform(members: OrgMembership[], query: string): OrgMembership[] {
    if (!members?.length) return [];

    const q = query?.trim().toLowerCase();
    if (!q) return members;

    return members.filter(m => {
      const name  = this.displayName(m).toLowerCase();
      const email = (m.user?.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }

  private displayName(m: OrgMembership): string {
    const u = m.user;
    if (!u) return 'user ' + m.userId;
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'user ' + m.userId;
  }
}