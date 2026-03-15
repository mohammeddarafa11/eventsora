// src/app/core/services/darkmode.service.ts
import { isPlatformBrowser } from '@angular/common';
import {
  DOCUMENT,
  Injectable,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';

export enum EThemeModes {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}
export type ThemeOptions =
  | EThemeModes.LIGHT
  | EThemeModes.DARK
  | EThemeModes.SYSTEM;

@Injectable({ providedIn: 'root' })
export class DarkModeService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private themeSignal = signal<ThemeOptions>(EThemeModes.SYSTEM);
  private darkModeQuery?: MediaQueryList;
  private handleThemeChange = (event: MediaQueryListEvent) =>
    this.updateMode(event.matches);

  readonly theme = computed(() => this.themeSignal());

  constructor() {
    if (this.isBrowser) {
      this.initTheme();
    }
  }

  ngOnDestroy(): void {
    this.handleSystemChanges(false);
  }

  initTheme(): void {
    if (!this.isBrowser) return;

    const stored = this.getStoredTheme();
    this.applyTheme(stored ?? EThemeModes.SYSTEM);
  }

  // FIXED: Toggle theme properly
  toggleTheme(): void {
    if (!this.isBrowser) return;

    const current = this.getCurrentTheme();

    // If currently SYSTEM, switch based on actual current mode
    if (current === EThemeModes.SYSTEM) {
      this.darkModeQuery ??= this.getDarkModeQuery();
      const isCurrentlyDark = this.darkModeQuery?.matches ?? false;
      this.applyTheme(isCurrentlyDark ? EThemeModes.LIGHT : EThemeModes.DARK);
      return;
    }

    // Toggle between LIGHT and DARK
    this.applyTheme(
      current === EThemeModes.DARK ? EThemeModes.LIGHT : EThemeModes.DARK,
    );
  }

  // NEW: Set specific theme
  setTheme(theme: ThemeOptions): void {
    if (!this.isBrowser) return;
    this.applyTheme(theme);
  }

  private applyTheme(theme: ThemeOptions): void {
    if (!this.isBrowser) return;

    localStorage.setItem('theme', theme);
    this.themeSignal.set(theme);
    this.handleSystemChanges(false);

    this.darkModeQuery ??= this.getDarkModeQuery();
    this.updateMode(this.isDarkMode());

    if (theme === EThemeModes.SYSTEM) {
      this.handleSystemChanges(true);
    }
  }

  private getStoredTheme(): ThemeOptions | undefined {
    if (!this.isBrowser) return undefined;
    try {
      const value = localStorage.getItem('theme');
      return (Object.values(EThemeModes) as ThemeOptions[]).includes(
        value as any,
      )
        ? (value as ThemeOptions)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private isDarkMode(): boolean {
    if (!this.isBrowser) return false;

    try {
      const stored = localStorage.getItem('theme');
      if (stored === EThemeModes.DARK) return true;
      if (stored === EThemeModes.LIGHT) return false;
      if (stored === EThemeModes.SYSTEM) {
        return this.darkModeQuery?.matches ?? false;
      }
      // Default to system preference if no stored theme
      return this.darkModeQuery?.matches ?? false;
    } catch {
      return this.darkModeQuery?.matches ?? false;
    }
  }

  getCurrentTheme(): ThemeOptions {
    return this.themeSignal();
  }

  getThemeMode(isDarkMode: boolean): EThemeModes.LIGHT | EThemeModes.DARK {
    return isDarkMode ? EThemeModes.DARK : EThemeModes.LIGHT;
  }

  // NEW: Get actual current mode (not just setting)
  isCurrentlyDark(): boolean {
    return this.isDarkMode();
  }

  private updateMode(isDarkMode: boolean): void {
    const themeMode = this.getThemeMode(isDarkMode);
    const html = this.document.documentElement;
    html.classList.toggle('dark', isDarkMode);
    html.setAttribute('data-theme', themeMode);
    html.style.colorScheme = themeMode;
  }

  private getDarkModeQuery(): MediaQueryList | undefined {
    return this.isBrowser
      ? this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)')
      : undefined;
  }

  private handleSystemChanges(addListener: boolean): void {
    const query = this.darkModeQuery;
    if (!query || !this.isBrowser) return;

    if (addListener) {
      query.addEventListener('change', this.handleThemeChange);
    } else {
      query.removeEventListener('change', this.handleThemeChange);
    }
  }
}
