// src/app/core/models/meetup.model.ts

export enum MeetupLocationType {
  Offline = 0,
  Online  = 1,
}

// ── Nested sub-objects (used by allMeetups / single GET) ─────────────────────

export interface MeetupCategory {
  id:   number;
  name: string | null;
}

export interface MeetupManager {
  id:        number;
  firstName: string | null;
  lastName:  string | null;
  email:     string | null;
  logoUrl:   string | null;
  coverUrl?: string | null;
}

export interface MeetupParticipant {
  meetupId: number;
  userId:   number;
  user?: {
    id:        number;
    firstName: string | null;
    lastName:  string | null;
    email:     string | null;
    logoUrl?:  string | null;
  } | null;
}

// ── Canonical Meetup model used everywhere in the app ────────────────────────

export interface Meetup {
  id:                   number;
  title:                string | null;
  start_Time:           string;
  end_Time:             string;
  /** Unified field — mapped from maxAttendees OR max_Participants */
  maxAttendees:         number | null;
  description:          string | null;
  latitude:             number | null;
  longitude:            number | null;
  city:                 string | null;
  region:               string | null;
  street:               string | null;
  nameOfPlace:          string | null;
  online_url:           string | null;
  meetup_img_url:       string | null;
  meetup_location_type: MeetupLocationType;
  categoryId:           number;
  category:             MeetupCategory | null;
  managerId:            number;
  manager:              MeetupManager | null;
  participants:         MeetupParticipant[] | null;
  /** Extra fields from AllDetails DTO */
  currentAttendees?:    number;
  remainingSpots?:      number | null;
  isFull?:              boolean;
}

// ── Raw shape returned by GET /api/Meetup/AllDetails ─────────────────────────
// Flat DTO — no nested objects, different field names.

export interface MeetupAllDetailsDto {
  id:                   number;
  title:                string | null;
  start_Time:           string;
  end_Time:             string;
  description:          string | null;
  max_Participants:     number | null;   // ← different from Meetup.maxAttendees
  currentAttendees:     number;
  remainingSpots:       number | null;
  isFull:               boolean;
  city:                 string | null;
  region:               string | null;
  street:               string | null;
  nameOfPlace:          string | null;
  online_url:           string | null;
  meetup_img_url:       string | null;
  meetup_location_type: MeetupLocationType;
  categoryId:           number;
  managerId:            number;
  categoryName:         string | null;  // ← flat, no nested category object
  managerName:          string | null;  // ← flat, no nested manager object
}

/**
 * Maps the flat AllDetails DTO to the canonical Meetup shape.
 * Splits "firstName lastName" from managerName.
 */
export function mapAllDetailsDto(dto: MeetupAllDetailsDto): Meetup {
  // Split "string string" → firstName + lastName
  const nameParts  = (dto.managerName ?? '').trim().split(/\s+/);
  const firstName  = nameParts[0] ?? null;
  const lastName   = nameParts.slice(1).join(' ') || null;

  return {
    id:                   dto.id,
    title:                dto.title,
    start_Time:           dto.start_Time,
    end_Time:             dto.end_Time,
    maxAttendees:         dto.max_Participants ?? null,
    description:          dto.description,
    latitude:             null,
    longitude:            null,
    city:                 dto.city,
    region:               dto.region,
    street:               dto.street,
    nameOfPlace:          dto.nameOfPlace,
    online_url:           dto.online_url,
    meetup_img_url:       dto.meetup_img_url,
    meetup_location_type: dto.meetup_location_type,
    categoryId:           dto.categoryId,
    category:             { id: dto.categoryId, name: dto.categoryName },
    managerId:            dto.managerId,
    manager:              {
      id:        dto.managerId,
      firstName,
      lastName,
      email:     null,
      logoUrl:   null,
    },
    // AllDetails does not return participants — use currentAttendees for display
    participants:         null,
    currentAttendees:     dto.currentAttendees,
    remainingSpots:       dto.remainingSpots,
    isFull:               dto.isFull,
  };
}

// ── DTOs sent to the API ──────────────────────────────────────────────────────

export interface CreateMeetupDto {
  title:                string;
  start_Time:           string;   // ISO 8601
  end_Time:             string;   // ISO 8601
  max_Participants?:    number | null;
  description?:         string | null;
  city?:                string | null;
  region?:              string | null;
  street?:              string | null;
  nameOfPlace?:         string | null;
  online_url?:          string | null;
  meetup_img_url?:      string | null;
  meetup_location_type: MeetupLocationType;
  categoryId:           number;
  managerId:            number;
}

export interface UpdateMeetupDto {
  title:                string;
  start_Time:           string;
  end_Time:             string;
  maxAttendees?:        number | null;
  description?:         string | null;
  city?:                string | null;
  region?:              string | null;
  street?:              string | null;
  nameOfPlace?:         string | null;
  online_url?:          string | null;
  meetup_img_url?:      string | null;
  meetup_location_type: MeetupLocationType;
  categoryId:           number;
  managerId:            number;
}

// ── API envelope ──────────────────────────────────────────────────────────────

export interface ServiceResponse<T> {
  data:    T;
  success: boolean;
  message: string | null;
  errors:  string[] | null;
}