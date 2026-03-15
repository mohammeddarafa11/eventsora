// src/app/core/models/meetup.model.ts

export enum MeetupLocationType {
 Offline = 0,
 Online  = 1,
}

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

export interface Meetup {
 id:                   number;
 title:                string | null;
 start_Time:           string;
 end_Time:             string;
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
}

// ── DTOs sent to the API ──────────────────────────────────────────────────

export interface CreateMeetupDto {
 title:                string;
 start_Time:           string; // ISO 8601
 end_Time:             string; // ISO 8601
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

// ── API envelope ──────────────────────────────────────────────────────────

export interface ServiceResponse<T> {
 data:    T;
 success: boolean;
 message: string | null;
 errors:  string[] | null;
}