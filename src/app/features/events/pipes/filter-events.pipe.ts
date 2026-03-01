// src/app/features/events/pipes/filter-events.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { Event as EventModel, EventType } from '@core/models/event.model';

export type EventTypeFilter = 'all' | 'online' | 'inperson';
export type EventStatusFilter = 'all' | 'upcoming' | 'past';

export interface EventFilters {
  search: string;
  eventType: EventTypeFilter;
  status: EventStatusFilter;
  categoryId: number | null;
  /** Date object or null */
  dateFrom: Date | null;
  dateTo:   Date | null;
}

export const DEFAULT_FILTERS: EventFilters = {
  search:     '',
  eventType:  'all',
  status:     'all',
  categoryId: null,
  dateFrom:   null,
  dateTo:     null,
};

@Pipe({
  name: 'filterEvents',
  standalone: true,
  pure: true,
})
export class FilterEventsPipe implements PipeTransform {
  transform(events: EventModel[], filters: EventFilters): EventModel[] {
    if (!events?.length) return [];

    const now = new Date();
    const search = filters.search.trim().toLowerCase();

    return events.filter((event) => {
      // --- Search ---
      if (search) {
        const inTitle = event.title?.toLowerCase().includes(search);
        const inDesc  = event.description?.toLowerCase().includes(search);
        if (!inTitle && !inDesc) return false;
      }

      // --- Event type ---
      if (filters.eventType === 'online' && event.event_type !== EventType.Online) return false;
      if (filters.eventType === 'inperson' && event.event_type !== EventType.InPerson) return false;

      // --- Status ---
      const isUpcoming = new Date(event.start_time) > now;
      if (filters.status === 'upcoming' && !isUpcoming) return false;
      if (filters.status === 'past'     &&  isUpcoming) return false;

      // --- Category ---
      if (filters.categoryId !== null && event.categoryId !== filters.categoryId) return false;

      // --- Date range ---
      const eventDate = new Date(event.start_time);
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        if (eventDate < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (eventDate > to) return false;
      }

      return true;
    });
  }
}