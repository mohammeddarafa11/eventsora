// src/app/core/services/ticket.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export enum TicketTier {
  Standard = 0,
  VIP      = 1,
  Premium  = 2,
}

export interface TicketTemplate {
  id:             number;
  name:           string;
  description:    string;
  tier:           TicketTier;
  defaultPrice:   number;
  organizationId: number;
}

export interface EventTicket {
  id:               number;
  eventId:          number;
  ticketTemplateId: number;
  ticketTemplate?:  TicketTemplate;
  tier:             TicketTier;   // ← returned directly by the API
  totalQuantity:    number;
  soldQuantity:     number;
  actualPrice:      number;
}

export interface Booking {
  id:               number;
  ticketUniqueCode: string;
  isUsed:           boolean;
  usedAt:           string | null;
  userId:           number;
  eventTicketId:    number;
  eventTicket?:     EventTicket;
  purchaseDate:     string;
}

export interface CreateTemplateDto {
  name:           string;
  description:    string;
  tier:           TicketTier;
  defaultPrice:   number;
  organizationId: number;
}

export interface UpdateTemplateDto {
  name?:        string;
  description?: string;
  price?:       number;
}

export interface EventTicketDto {
  templateId:    number;
  quantity:      number;
  priceOverride: number;
}

export interface CreateEventWithTicketsDto {
  title:               string;
  start_time:          string;
  end_time:            string;
  description?:        string | null;
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

export interface ServiceResponse<T> {
  data:    T;
  success: boolean;
  message: string | null;
  errors:  string[] | null;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = 'https://eventora.runasp.net/api/Ticket';

  createTemplate(dto: CreateTemplateDto): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/CreateTicketTemplate`, dto)
      .pipe(catchError(this.handleError));
  }

  updateTemplate(id: number, dto: UpdateTemplateDto): Observable<void> {
    const params = new HttpParams().set('id', id.toString());
    return this.http.put<void>(`${this.baseUrl}/UpdateTicketTemplate`, dto, { params })
      .pipe(catchError(this.handleError));
  }

  deleteTemplate(id: number): Observable<void> {
    const params = new HttpParams().set('id', id.toString());
    return this.http.delete<void>(`${this.baseUrl}/DeleteTicketTemplate`, { params })
      .pipe(catchError(this.handleError));
  }

  getTemplatesByOrganization(organizationId: number): Observable<TicketTemplate[]> {
    return this.http
      .get<ServiceResponse<TicketTemplate[]>>(`${this.baseUrl}/ticketTemplates/${organizationId}`)
      .pipe(map(res => this.unwrap(res)), catchError(this.handleError));
  }

  createEventWithTickets(dto: CreateEventWithTicketsDto): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/CreateEventWithTickets`, dto)
      .pipe(catchError(this.handleError));
  }

  getEventTickets(eventId: number): Observable<EventTicket[]> {
    return this.http
      .get<ServiceResponse<EventTicket[]>>(`${this.baseUrl}/EventTickets/${eventId}`)
      .pipe(map(res => this.unwrap(res)), catchError(this.handleError));
  }

  bookTicket(eventTicketId: number): Observable<void> {
    const params = new HttpParams().set('eventTicketId', eventTicketId.toString());
    return this.http.post<void>(`${this.baseUrl}/BookTicket`, null, { params })
      .pipe(catchError(this.handleError));
  }

  getMyBookings(): Observable<Booking[]> {
    return this.http.get<ServiceResponse<Booking[]>>(`${this.baseUrl}/MyBookings`)
      .pipe(map(res => this.unwrap(res)), catchError(this.handleError));
  }

  getBooking(bookingId: number): Observable<Booking> {
    return this.http.get<ServiceResponse<Booking>>(`${this.baseUrl}/Booking/${bookingId}`)
      .pipe(map(res => this.unwrap(res)), catchError(this.handleError));
  }

  verifyTicket(ticketCode: string): Observable<Booking> {
    return this.http.get<ServiceResponse<Booking>>(`${this.baseUrl}/Verify/${ticketCode}`)
      .pipe(map(res => this.unwrap(res)), catchError(this.handleError));
  }

  private unwrap<T>(response: ServiceResponse<T>): T {
    if (!response.success) {
      const msg = response.message || response.errors?.join(', ') || 'An unknown error occurred';
      throw new Error(msg);
    }
    return response.data;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred';
    if (error.error?.message)             message = error.error.message;
    else if (error.error?.errors?.length) message = error.error.errors.join(', ');
    else if (error.status === 401)        message = 'Unauthorized. Please log in again.';
    else if (error.status === 404)        message = 'Resource not found.';
    else if (error.status === 400)        message = 'Bad request. Please check your input.';
    console.error('[TicketService]', error);
    return throwError(() => ({ error: { message } }));
  }
}