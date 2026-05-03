// src/app/features/user-dashboard/eventora-ai/eventora-ai.ts
// Floating chatbot widget (embedded in UserDashboard shell, not a routed page.)
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { toast } from 'ngx-sonner';
import { Router } from '@angular/router';

import { AiChatService } from '@core/services/ai-chat.service';

/** Paths the AI returns as absolute URLs — route inside SPA. */
const USER_APP_PREFIX = '/user-dashboard';

function pathnameForInAppRouting(pathname: string, search: string, hash: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (!path.startsWith(USER_APP_PREFIX)) return null;
  return path + search + hash;
}

type ChatBubble =
  | { role: 'user'; text: string }
  | { role: 'assistant'; htmlSafe: SafeHtml };

@Component({
  selector: 'app-eventora-ai-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

    :host {
      position: fixed;
      bottom: 1.25rem;
      right: 1rem;
      left: auto;
      top: auto;
      z-index: 100;
      pointer-events: none;
      font-family: 'Plus Jakarta Sans', sans-serif;
      --ea-bg: #0a0a0f;
      --ea-bg2: #111116;
      --ea-gold: #F0B429;
      --ea-gold-dim: rgba(240, 180, 41, .12);
      --ea-gold-brd: rgba(240, 180, 41, .28);
      --ea-text: #F2EEE6;
      --ea-muted: rgba(242, 238, 230, .5);
      --ea-border: rgba(242, 238, 230, .1);
      --ea-fd: 'Bebas Neue', sans-serif;
      --ea-fm: 'DM Mono', monospace;
    }

    @media (max-width: 767px) {
      :host { right: .75rem; bottom: calc(.75rem + env(safe-area-inset-bottom, 0)); }
    }

    .ea-stack {
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: .65rem;
    }

    .ea-backdrop {
      pointer-events: auto;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, .45);
      backdrop-filter: blur(2px);
      z-index: 1;
      animation: eaFade .2s ease both;
    }
    @keyframes eaFade {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .ea-panel {
      pointer-events: auto;
      position: relative;
      z-index: 2;
      width: min(calc(100vw - 1.75rem), 400px);
      height: min(72vh, 560px);
      max-height: min(72vh, 560px);
      display: flex;
      flex-direction: column;
      background: var(--ea-bg);
      border-radius: 20px;
      border: 1px solid var(--ea-border);
      box-shadow:
        0 24px 48px rgba(0, 0, 0, .45),
        0 0 0 1px rgba(242,238,230,.03) inset;
      overflow: hidden;
      animation: eaPop .26s cubic-bezier(.22, 1, .36, 1) both;
    }
    @keyframes eaPop {
      from { opacity: 0; transform: translateY(14px) scale(.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .ea-headbar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .5rem;
      padding: .75rem 1rem .65rem;
      border-bottom: 1px solid var(--ea-border);
      background: linear-gradient(180deg, rgba(240,180,41,.06) 0%, transparent 100%);
    }
    .ea-headbar__titles { min-width: 0; }
    .ea-headbar__badge {
      display: inline-flex;
      font-family: var(--ea-fm);
      font-size: .52rem;
      letter-spacing: .14em;
      text-transform: uppercase;
      padding: .2rem .45rem;
      border-radius: 999px;
      background: var(--ea-gold-dim);
      border: 1px solid var(--ea-gold-brd);
      color: var(--ea-gold);
    }
    .ea-headbar__title {
      font-family: var(--ea-fd);
      font-size: 1rem;
      letter-spacing: .06em;
      margin: .2rem 0 0;
      color: var(--ea-text);
    }
    .ea-headbar__hint {
      font-size: .68rem;
      color: var(--ea-muted);
      margin: .2rem 0 0;
      line-height: 1.4;
      display: block;
      max-width: 15rem;
    }
    .ea-headbar__min {
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid var(--ea-border);
      background: rgba(242,238,230,.03);
      color: var(--ea-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color .15s, border-color .15s;
    }
    .ea-headbar__min:hover {
      color: var(--ea-text);
      border-color: var(--ea-gold-brd);
    }

    .ea-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: .75rem 1rem 0;
      -webkit-overflow-scrolling: touch;
    }

    .ea-thread {
      display: flex;
      flex-direction: column;
      gap: .65rem;
      padding-bottom: .5rem;
    }

    .ea-row { display: flex; }
    .ea-row--user { justify-content: flex-end; }
    .ea-row--assistant { justify-content: flex-start; }

    .ea-bubble {
      max-width: calc(100% - .5rem);
      padding: .55rem .75rem;
      border-radius: 14px;
      font-size: .82rem;
      line-height: 1.52;
      word-break: break-word;
    }

    .ea-bubble--user {
      background: var(--ea-gold-dim);
      border: 1px solid var(--ea-gold-brd);
      color: var(--ea-text);
      border-bottom-right-radius: 5px;
    }

    .ea-bubble--assistant {
      background: var(--ea-bg2);
      border: 1px solid var(--ea-border);
      border-bottom-left-radius: 5px;
      color: var(--ea-text);
    }

    .ea-md ::ng-deep :first-child { margin-top: 0; }
    .ea-md ::ng-deep :last-child { margin-bottom: 0; }
    .ea-md ::ng-deep p { margin: .4rem 0; }
    .ea-md ::ng-deep ul, .ea-md ::ng-deep ol {
      margin: .4rem 0;
      padding-left: 1.15rem;
    }
    .ea-md ::ng-deep li { margin: .2rem 0; }
    .ea-md ::ng-deep code {
      font-family: var(--ea-fm);
      font-size: .76em;
      padding: .1rem .32rem;
      border-radius: 5px;
      background: rgba(242,238,230,.06);
      border: 1px solid var(--ea-border);
    }
    .ea-md ::ng-deep pre {
      margin: .5rem 0;
      padding: .5rem .7rem;
      border-radius: 8px;
      background: #000;
      border: 1px solid var(--ea-border);
      overflow-x: auto;
    }
    .ea-md ::ng-deep pre code {
      padding: 0;
      border: none;
      background: none;
      font-size: .74rem;
      white-space: pre;
    }
    .ea-md ::ng-deep a {
      color: var(--ea-gold);
      text-underline-offset: 2px;
    }
    .ea-md ::ng-deep strong { font-weight: 600; color: var(--ea-text); }

    .ea-typing {
      display: inline-flex;
      align-items: center;
      gap: .28rem;
      font-family: var(--ea-fm);
      font-size: .65rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--ea-muted);
    }
    .ea-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--ea-gold);
      opacity: .35;
      animation: eaBlink 1.15s ease-in-out infinite both;
    }
    .ea-dot:nth-child(2) { animation-delay: .16s; }
    .ea-dot:nth-child(3) { animation-delay: .32s; }
    @keyframes eaBlink {
      0%, 60%, 100% { opacity: .22; transform: scale(.82); }
      30% { opacity: .95; transform: scale(1); }
    }

    .ea-empty {
      text-align: center;
      padding: 1rem .5rem 1.25rem;
      border: 1px dashed var(--ea-border);
      border-radius: 12px;
      color: var(--ea-muted);
      font-size: .78rem;
    }
    .ea-empty__ideas {
      margin-top: .65rem;
      display: flex;
      flex-wrap: wrap;
      gap: .4rem;
      justify-content: center;
    }
    .ea-chip {
      font-family: var(--ea-fm);
      font-size: .58rem;
      letter-spacing: .05em;
      text-transform: uppercase;
      padding: .35rem .55rem;
      border-radius: 999px;
      border: 1px solid var(--ea-border);
      background: transparent;
      color: var(--ea-muted);
      cursor: pointer;
      transition: border-color .15s, color .15s;
    }
    .ea-chip:hover {
      border-color: var(--ea-gold-brd);
      color: var(--ea-gold);
    }

    .ea-composer {
      flex-shrink: 0;
      padding: .65rem .75rem calc(.85rem + env(safe-area-inset-bottom, 0));
      border-top: 1px solid var(--ea-border);
      background: linear-gradient(180deg, transparent 0%, var(--ea-bg) 28%);
    }
    .ea-composer__inner {
      display: flex;
      gap: .5rem;
      align-items: flex-end;
      padding: .5rem .62rem;
      border-radius: 12px;
      border: 1px solid var(--ea-border);
      background: var(--ea-bg2);
    }
    .ea-area {
      flex: 1;
      min-height: 38px;
      max-height: 112px;
      resize: vertical;
      background: transparent;
      border: none;
      outline: none;
      color: var(--ea-text);
      font-family: inherit;
      font-size: .81rem;
      line-height: 1.42;
    }
    .ea-area::placeholder { color: rgba(242,238,230,.25); }

    .ea-send {
      flex-shrink: 0;
      padding: .45rem .75rem;
      border-radius: 9px;
      border: 1px solid var(--ea-gold-brd);
      background: var(--ea-gold-dim);
      color: var(--ea-gold);
      font-weight: 600;
      font-size: .74rem;
      cursor: pointer;
      transition: opacity .15s;
    }
    .ea-send:disabled { opacity: .35; cursor: not-allowed; }
    .ea-send:not(:disabled):hover { opacity: .93; }

    .ea-launch {
      pointer-events: auto;
      position: relative;
      z-index: 3;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      border: 2px solid var(--ea-gold-brd);
      background: linear-gradient(145deg, var(--ea-gold-dim), rgba(240,180,41,.06));
      color: var(--ea-gold);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 12px 32px rgba(0, 0, 0, .35);
      transition: transform .18s cubic-bezier(.2,.8,.4,1), box-shadow .18s;
    }
    .ea-launch:hover {
      transform: scale(1.04);
      box-shadow: 0 14px 36px rgba(240,180,41,.08);
    }
    .ea-launch--open {
      background: rgba(242,238,230,.06);
      border-color: var(--ea-border);
      color: var(--ea-muted);
    }
    .ea-launch--open:hover { color: var(--ea-text); }
  `],
  template: `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>

    <div class="ea-stack">
      @if (panelOpen()) {
        <div class="ea-backdrop" (click)="closePanel()" aria-hidden="true"></div>
      }

      @if (panelOpen()) {
        <div id="ea-chat-dialog" class="ea-panel" role="dialog" aria-labelledby="ea-chat-title">
          <div class="ea-headbar">
            <div class="ea-headbar__titles">
              <span class="ea-headbar__badge">Assistant</span>
              <div id="ea-chat-title" class="ea-headbar__title">Eventora AI</div>
              <span class="ea-headbar__hint">Events listings only · links open here</span>
            </div>
            <button type="button" class="ea-headbar__min"
                    (click)="closePanel()" aria-label="Close chat">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 12H5"/>
              </svg>
            </button>
          </div>

          <div class="ea-scroll" #scrollRoot>
            @if (messages().length === 0 && !loading()) {
              <div class="ea-empty" role="status">
                Quick prompts
                <div class="ea-empty__ideas">
                  @for (q of starters; track q) {
                    <button type="button" class="ea-chip" (click)="useStarter(q)">{{ q }}</button>
                  }
                </div>
              </div>
            }

            <div class="ea-thread" aria-live="polite">
              @for (m of messages(); track $index) {
                <div class="ea-row" [class.ea-row--user]="m.role === 'user'"
                     [class.ea-row--assistant]="m.role === 'assistant'">
                  @if (m.role === 'user') {
                    <div class="ea-bubble ea-bubble--user">{{ m.text }}</div>
                  } @else {
                    <div class="ea-bubble ea-bubble--assistant ea-md"
                         [innerHTML]="m.htmlSafe"
                         (click)="onAssistantMarkdownClick($event)"></div>
                  }
                </div>
              }
              @if (loading()) {
                <div class="ea-row ea-row--assistant">
                  <div class="ea-bubble ea-bubble--assistant">
                    <div class="ea-typing" aria-busy="true">
                      Searching
                      <span class="ea-dot"></span><span class="ea-dot"></span><span class="ea-dot"></span>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="ea-composer">
            <div class="ea-composer__inner">
              <textarea
                class="ea-area"
                rows="2"
                placeholder="Ask about events..."
                [value]="draft()"
                (input)="onDraft(($any($event.target).value))"
                (keydown)="onKeyDown($event)"
                [disabled]="loading()"
              ></textarea>
              <button
                type="button"
                class="ea-send"
                (click)="send()"
                [disabled]="loading() || !draftTrimmed()"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      }

      <button
        type="button"
        class="ea-launch"
        [class.ea-launch--open]="panelOpen()"
        (click)="togglePanel()"
        [attr.aria-expanded]="panelOpen()"
        aria-controls="ea-chat-dialog"
      >
        @if (!panelOpen()) {
          <svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
        } @else {
          <svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M19 9l-7 7-7-7"/>
          </svg>
        }
      </button>
    </div>
  `,
})
export class EventoraAiChatbot {
  private readonly ai = inject(AiChatService);
  private readonly domSanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly scrollRoot = viewChild<ElementRef<HTMLElement>>('scrollRoot');

  readonly panelOpen = signal(false);

  readonly messages = signal<ChatBubble[]>([]);
  readonly loading = signal(false);
  readonly draft = signal('');

  readonly starters = [
    'Any online events?',
    'Show offline events nearby',
    'What\'s coming up?',
  ];

  togglePanel(): void {
    this.panelOpen.update(open => !open);
    queueMicrotask(() => {
      if (this.panelOpen()) this.scrollToBottom();
    });
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }

  draftTrimmed(): string {
    return this.draft().trim();
  }

  onDraft(value: string): void {
    this.draft.set(value);
  }

  useStarter(q: string): void {
    this.draft.set(q);
    this.send();
  }

  onKeyDown(ev: KeyboardEvent): void {
    if (ev.key !== 'Enter' || ev.shiftKey) return;
    ev.preventDefault();
    this.send();
  }

  onAssistantMarkdownClick(ev: MouseEvent): void {
    if (ev.defaultPrevented || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;

    const a = (ev.target as HTMLElement | null)?.closest?.('a[href]');
    if (!a || !('href' in a)) return;

    const href = String((a as HTMLAnchorElement).getAttribute?.('href') ?? '');
    let url: URL;
    try {
      url = new URL(href, window.location.origin);
    } catch {
      return;
    }

    const inAppUrl = pathnameForInAppRouting(url.pathname, url.search, url.hash);
    if (!inAppUrl) return;

    ev.preventDefault();
    this.closePanel();
    void this.router.navigateByUrl(inAppUrl);
  }

  private toAssistantHtml(markdown: string): SafeHtml {
    const html = marked(markdown, { async: false }) as string;
    const safe = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['a', 'p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'title'],
    });
    return this.domSanitizer.bypassSecurityTrustHtml(safe);
  }

  send(): void {
    const msg = this.draftTrimmed();
    if (!msg || this.loading()) return;

    this.messages.update(xs => [...xs, { role: 'user', text: msg }]);
    this.draft.set('');
    this.loading.set(true);
    this.scheduleScroll();

    this.ai
      .ask({ message: msg })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: reply => {
          this.loading.set(false);
          const htmlSafe = this.toAssistantHtml(reply);
          this.messages.update(xs => [...xs, { role: 'assistant', htmlSafe }]);
          this.scheduleScroll();
        },
        error: (err: Error) => {
          this.loading.set(false);
          toast.error(err?.message || 'Something went wrong');
          this.scheduleScroll();
        },
      });
  }

  private scheduleScroll(): void {
    queueMicrotask(() => this.scrollToBottom());
  }

  private scrollToBottom(): void {
    const el = this.scrollRoot()?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }
}
