// src/app/features/events/pipes/filter-events.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { Event as EventModel, EventLocationType, EventType } from '@core/models/event.model';

export type EventLocationFilter   = 'all' | 'online' | 'inperson';
export type EventStatusFilter     = 'all' | 'upcoming' | 'past';
export type EventVisibilityFilter = 'all' | 'public'  | 'private';

export interface EventFilters {
  search:      string;
  status:      EventStatusFilter;
  eventType:   EventLocationFilter;   // filter by location format
  visibility:  EventVisibilityFilter;
  categoryId:  number | null;
  dateFrom?:   Date | null;
  dateTo?:     Date | null;
}

export const DEFAULT_FILTERS: EventFilters = {
  search:     '',
  status:     'all',
  eventType:  'all',
  visibility: 'all',
  categoryId: null,
  dateFrom:   null,
  dateTo:     null,
};

@Pipe({
  name: 'filterEvents',
  standalone: true,
  pure: false,
})
export class FilterEventsPipe implements PipeTransform {
  transform(events: EventModel[], filters: EventFilters): EventModel[] {
    if (!events?.length) return [];

    return events.filter(event => {

      // ── Text search ─────────────────────────────────────────────────────
      if (filters.search.trim()) {
        const s = filters.search.toLowerCase();
        const hit =
          event.title?.toLowerCase().includes(s) ||
          event.description?.toLowerCase().includes(s) ||
          event.city?.toLowerCase().includes(s) ||
          event.region?.toLowerCase().includes(s) ||
          event.category?.name?.toLowerCase().includes(s);
        if (!hit) return false;
      }

      // ── Status (upcoming / past) ─────────────────────────────────────────
      const now   = new Date();
      const start = new Date(event.start_time);
      if (filters.status === 'upcoming' && start <= now) return false;
      if (filters.status === 'past'     && start >  now) return false;

      // ── Location type (online / in-person) ──────────────────────────────
      // Backend: EventLocationType.Online = 1, Offline = 0
      if (filters.eventType === 'online'   && event.event_location_type !== EventLocationType.Online)  return false;
      if (filters.eventType === 'inperson' && event.event_location_type !== EventLocationType.Offline) return false;

      // ── Visibility (public / private) ────────────────────────────────────
      if (filters.visibility === 'public'  && event.event_type !== EventType.Public)  return false;
      if (filters.visibility === 'private' && event.event_type !== EventType.Private) return false;

      // ── Category ─────────────────────────────────────────────────────────
      if (filters.categoryId !== null && event.categoryId !== filters.categoryId) return false;

      // ── Date range ───────────────────────────────────────────────────────
      if (filters.dateFrom && start < filters.dateFrom) return false;
      if (filters.dateTo   && start > filters.dateTo)   return false;

      return true;
    });
  }
}