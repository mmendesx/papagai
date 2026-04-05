import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

const TOKEN_KEY = 'papagai_access_token';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly userSignal = signal<AuthUser | null>(null);

  readonly currentUser = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  constructor() {
    const token = this.getStoredToken();
    if (token && !this.isTokenExpired(token)) {
      void this.hydrateUser();
    }
  }

  hasValidToken(): boolean {
    const token = this.getStoredToken();
    return !!token && !this.isTokenExpired(token);
  }

  async ensureSession(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token || this.isTokenExpired(token)) {
      return false;
    }
    if (this.userSignal() !== null) {
      return true;
    }
    await this.hydrateUser();
    return this.userSignal() !== null;
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number };
      if (!payload.exp) {
        return false;
      }
      return payload.exp * 1000 < Date.now();
    } catch {
      return false;
    }
  }

  async hydrateUser(): Promise<void> {
    try {
      const me = await firstValueFrom(this.http.get<AuthUser>('/api/auth/me'));
      this.userSignal.set(me);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      this.userSignal.set(null);
    }
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>('/api/auth/login', { email, password }),
    );
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    this.userSignal.set(res.user);
  }

  async register(
    name: string,
    email: string,
    password: string,
    appKey: string,
  ): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>('/api/auth/register', {
        name,
        email,
        password,
        appKey,
      }),
    );
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    this.userSignal.set(res.user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.userSignal.set(null);
    void this.router.navigate(['/login']);
  }
}
