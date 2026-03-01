// src/app/core/models/event.model.ts
export interface Event {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  description: string;
  latitude?: number;
  longitude?: number;
  city: string;
  region: string;
  name_of_place?: string;
  street?: string;
  online_url?: string;
  event_img_url?: string;
  event_type: EventType;
  organizationId: number;
  organization?: any;
  categoryId: number;
  category?: any;
  userEvents?: any[];
  tickets?: any[];
}

export enum EventType {
  InPerson = 0,
  Online = 1,
}

export interface CreateEventDto {
  title: string;
  start_time: string;
  end_time: string;
  description: string;
  city: string;
  region: string;
  name_of_place?: string;
  street?: string;
  online_url?: string;
  event_img_url?: string;
  event_type: number;
  organizationId: number;
  categoryId: number;
}

// ✅ FIXED: Added organizationId
export interface UpdateEventDto {
  title: string;
  start_time: string;
  end_time: string;
  description: string;
  city?: string | null;
  region?: string | null;
  name_of_place?: string | null;
  street?: string | null;
  online_url?: string | null;
  event_img_url?: string | null;
  event_type: number;
  organizationId: number; // ✅ Added this!
  categoryId: number;
}

export interface ServiceResponse<T> {
  data: T;
  success: boolean;
  message: string | null;
  errors: string[] | null;
}
