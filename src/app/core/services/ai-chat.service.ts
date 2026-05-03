// src/app/core/services/ai-chat.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import type { ServiceResponse } from '../models/event.model';

export interface ChatRequest {
  message: string;
}

/** Backend sometimes returns `{ reply }` instead of ServiceResponse `{ data }`. */
interface AiAskReplyBody {
  reply?: string | null;
}

type AiAskRawResponse = ServiceResponse<string | null> | AiAskReplyBody;

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly http = inject(HttpClient);
  private readonly base = 'https://eventora.runasp.net/api/AiChat';

  /** POST /api/AiChat/ask — body may be `{ reply }` or standard ServiceResponse `{ data }` */
  ask(dto: ChatRequest): Observable<string> {
    return this.http.post<AiAskRawResponse>(`${this.base}/ask`, dto).pipe(
      map(raw => this.extractAssistantText(raw)),
      catchError(this.handleError),
    );
  }

  private extractAssistantText(raw: AiAskRawResponse): string {
    if (raw == null || typeof raw !== 'object') {
      throw new Error('Unexpected response from the assistant — no reply text was found');
    }

    const loose = raw as AiAskReplyBody & Partial<ServiceResponse<string | null>>;

    if (typeof loose.reply === 'string' && loose.reply.trim().length > 0) {
      return loose.reply.trim();
    }

    if (loose.success === false) {
      throw new Error(
        loose.message || loose.errors?.filter(Boolean).join(', ') || 'Request failed',
      );
    }

    if (loose.success === true && typeof loose.data === 'string' && loose.data.trim().length > 0) {
      return loose.data.trim();
    }

    throw new Error(
      loose.message || loose.errors?.filter(Boolean).join(', ') || 'The assistant returned an empty reply',
    );
  }

  private handleError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      let errorMessage = 'An error occurred';
      if (error.error instanceof ErrorEvent) {
        errorMessage = `Error: ${error.error.message}`;
      } else {
        errorMessage =
          error.error?.message ||
          error.error?.errors?.join?.(', ') ||
          `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
      console.error(errorMessage);
      return throwError(() => new Error(errorMessage));
    }

    if (error instanceof Error) {
      console.error(error.message);
      return throwError(() => error);
    }

    console.error(error);
    return throwError(() => new Error(String(error)));
  }
}
