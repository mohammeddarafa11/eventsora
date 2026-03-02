import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Event,
  CreateEventDto,
  UpdateEventDto,
  ServiceResponse,
} from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly baseURL = 'https://eventora.runasp.net/api/Event';

  constructor(private http: HttpClient) {}

  // Helper to map snake_case API response to camelCase interface
  private mapEvent(event: any): Event {
    return {
      ...event,
      city: event.city,
      region: event.region,
      street: event.street,
      nameOfPlace: event.name_of_place,
    };
  }

  private mapEvents(data: any[]): Event[] {
    return data.map(e => this.mapEvent(e));
  }

  getAllEvents(): Observable<Event[]> {
    return this.http.get<ServiceResponse<any[]>>(this.baseURL).pipe(
      map(r => {
        if (r.success) return this.mapEvents(r.data);
        throw { error: { message: r.message || 'Failed to fetch events' } };
      }),
      catchError(this.handleError)
    );
  }

  getEventById(id: number): Observable<Event> {
    return this.http.get<ServiceResponse<any>>(`${this.baseURL}/${id}`).pipe(
      map(r => {
        if (r.success) return this.mapEvent(r.data);
        throw { error: { message: r.message || 'Failed to fetch event' } };
      }),
      catchError(this.handleError)
    );
  }

  getEventsByOrganization(organizationId: number): Observable<Event[]> {
    const params = new HttpParams().set('organizationId', organizationId.toString());
    return this.http
      .get<ServiceResponse<any[]>>(`${this.baseURL}/organization`, { params })
      .pipe(
        map(r => {
          if (r.success) return this.mapEvents(r.data);
          throw { error: { message: r.message || 'Failed to fetch events' } };
        }),
        catchError(this.handleError)
      );
  }

  getEventsByCategory(categoryId: number): Observable<Event[]> {
    const params = new HttpParams().set('categoryId', categoryId.toString());
    return this.http
      .get<ServiceResponse<any[]>>(`${this.baseURL}/Category`, { params })
      .pipe(
        map(r => {
          if (r.success) return this.mapEvents(r.data);
          throw { error: { message: r.message || 'Failed to fetch events' } };
        }),
        catchError(this.handleError)
      );
  }

  createEvent(dto: CreateEventDto): Observable<Event> {
    return this.http.post<ServiceResponse<any>>(this.baseURL, dto).pipe(
      map(r => {
        if (r.success) return this.mapEvent(r.data);
        throw { error: { message: r.message || 'Failed to create event' } };
      }),
      catchError(this.handleError)
    );
  }

  updateEvent(id: number, dto: UpdateEventDto): Observable<Event> {
    return this.http
      .put<ServiceResponse<any>>(`${this.baseURL}/${id}`, dto)
      .pipe(
        map(r => {
          if (r.success) return this.mapEvent(r.data);
          throw { error: { message: r.message || 'Failed to update event' } };
        }),
        catchError(this.handleError)
      );
  }

  deleteEvent(id: number): Observable<any> {
    return this.http.delete<ServiceResponse<any>>(`${this.baseURL}/${id}`).pipe(
      map(r => {
        if (r.success) return r.data;
        throw { error: { message: r.message || 'Failed to delete event' } };
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred';
    if (error.error instanceof ErrorEvent) {
      message = error.error.message;
    } else if (error.error?.message) {
      message = error.error.message;
    } else if (Array.isArray(error.error?.errors) && error.error.errors.length) {
      message = error.error.errors.join(', ');
    } else if (error.message) {
      message = error.message;
    }
    console.error('[EventService]', error.status, message);
    return throwError(() => ({ error: { message } }));
  }
}