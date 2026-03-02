// src/app/core/models/event.model.ts

// ─── Enums ────────────────────────────────────────────────────────────────────

/** event_location_type: 0 = Online, 1 = Offline/InPerson */
export enum EventLocationType {
  Online  = 0,
  Offline = 1,
}

/** event_type: 0 = Public, 1 = Private */
export enum EventType {
  Public  = 0,
  Private = 1,
}

/** TicketTier: 0 = Standard, 1 = VIP, 2 = Premium */
export enum TicketTier {
  Standard = 0,
  VIP      = 1,
  Premium  = 2,
}

// ─── Core model ───────────────────────────────────────────────────────────────

export interface Event {
  id:                  number;
  title:               string;
  start_time:          string;
  end_time:            string;
  description:         string;
  latitude?:           number | null;
  longitude?:          number | null;
  city?:               string | null;
  region?:             string | null;
  street?:             string | null;
  nameOfPlace?:        string | null;
  online_url?:         string | null;
  event_img_url?:      string | null;
  event_location_type: EventLocationType;  // 0=Online, 1=Offline
  event_type:          EventType;          // 0=Public, 1=Private
  organizationId:      number;
  organization?:       Organization | null;
  categoryId:          number;
  category?:           Category | null;
  eventTickets?:       EventTicket[] | null;
}

// ─── Related models ───────────────────────────────────────────────────────────

export interface Organization {
  id:           number;
  name?:        string | null;
  city?:        string | null;
  region?:      string | null;
  bio?:         string | null;
  email?:       string | null;
  logoUrl?:     string | null;
  coverUrl?:    string | null;
  phoneNumber?: string | null;
  status?:      number;
}

export interface Category {
  id:    number;
  name?: string | null;
}

export interface EventTicket {
  id:               number;
  eventId:          number;
  ticketTemplateId: number;
  ticketTemplate?:  TicketTemplate | null;
  totalQuantity:    number;
  soldQuantity:     number;
  actualPrice:      number;
}

export interface TicketTemplate {
  id:             number;
  name?:          string | null;
  description?:   string | null;
  tier:           TicketTier;
  defaultPrice:   number;
  organizationId: number;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateEventDto {
  title:               string;
  start_time:          string;
  end_time:            string;
  description:         string;
  city?:               string | null;
  region?:             string | null;
  street?:             string | null;
  name_of_place?:      string | null;
  online_url?:         string | null;
  event_img_url?:      string | null;
  event_location_type: number;
  event_type:          number;
  organizationId:      number;
  categoryId:          number;
}

export interface UpdateEventDto {
  title:               string;
  start_time:          string;
  end_time:            string;
  description:         string;
  city?:               string | null;
  region?:             string | null;
  street?:             string | null;
  name_of_place?:      string | null;
  online_url?:         string | null;
  event_img_url?:      string | null;
  event_location_type?: number;
  event_type?:          number;
  organizationId:      number;
  categoryId:          number;
}

export interface CreateEventWithTicketsDto {
  title:               string;
  start_time:          string;
  end_time:            string;
  description:         string;
  city?:               string | null;
  region?:             string | null;
  street?:             string | null;
  name_of_place?:      string | null;
  online_url?:         string | null;
  event_img_url?:      string | null;
  event_location_type: number;
  event_type:          number;
  organizationId:      number;
  categoryId:          number;
  tickets?:            EventTicketDto[] | null;
}

export interface EventTicketDto {
  templateId:    number;
  quantity:      number;
  priceOverride: number;
}

export interface ServiceResponse<T> {
  data:    T;
  success: boolean;
  message: string | null;
  errors:  string[] | null;
}