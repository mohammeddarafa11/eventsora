// src/app/core/models/membership.model.ts

// Matches backend: Pending=0, Approved=1, Rejected=2, Banned=3
export enum MembershipStatus {
 Pending  = 0,
 Approved = 1,
 Rejected = 2,
 Banned   = 3,
}

// ── Flat DTO returned by GET /pending-requests ────────────────────────────────
export interface PendingRequest {
 userId:      number;
 userName:    string;
 email:       string;
 requestDate: string;
}

// ── Nested shape inside GET /api/Organization/{id} -> data.memberships ────────
export interface MemberUser {
 id:           number;
 firstName?:   string | null;
 lastName?:    string | null;
 email?:       string | null;
 logoUrl?:     string | null;
 coverUrl?:    string | null;
 city?:        string | null;
 region?:      string | null;
 phoneNumber?: string | null;
 role?:        string | null;
}

export interface OrgMembership {
 userId:         number;
 user?:          MemberUser | null;
 organizationId: number;
 status:         MembershipStatus;
 requestDate:    string;
 joinDate?:      string | null;
}

export interface ProcessRequestDto {
 userId:         number;
 organizationId: number;
 isApproved:     boolean;
}