// src/app/core/models/user-membership.model.ts

import { MembershipStatus } from './membership.model';

export { MembershipStatus };

export interface OrgSummary {
  id:       number;
  name?:    string | null;
  logoUrl?: string | null;
  coverUrl?:string | null;
  city?:    string | null;
  region?:  string | null;
  bio?:     string | null;
  email?:   string | null;
  status?:  number;          // 0 = Pending | 1 = Approved | 2 = Rejected (org approval by admin)
}

export interface UserOrgMembership {
  userId:         number;
  organizationId: number;
  status:         MembershipStatus;
  requestDate:    string;
  joinDate?:      string | null;
  organization?:  OrgSummary | null;
}