import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { filter, map, startWith } from 'rxjs/operators';
import { AuthService } from '../core/auth/auth.service';
import { API_ENDPOINT_GROUPS, EndpointGroup } from '../features/docs/api-endpoints';
import { DocsNavigationService } from '../features/docs/docs-navigation.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: flex; height: 100vh; overflow: hidden; }

    .sidebar {
      width: 15rem;
      min-width: 15rem;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-right: 1px solid #e5e7eb;
      overflow-y: auto;
    }

    .sidebar-brand {
      padding: 1.25rem 1.25rem 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      font-size: 0.9rem;
      letter-spacing: 0.12em;
      color: #111827;
    }
    .sidebar-brand img { width: 28px; height: 28px; flex-shrink: 0; }

    .parrot-mascot {
      display: flex;
      justify-content: center;
      padding: 0.75rem 0 0.25rem;
      opacity: 0.9;
    }
    .parrot-mascot img { width: 60px; height: 60px; }

    .nav-section { padding: 0.5rem 0.75rem; flex: 1; }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border-radius: 0.625rem;
      margin-bottom: 0.25rem;
      text-decoration: none;
      color: #6b7280;
      font-weight: 200;
      font-size: 0.875rem;
      transition: all 0.2s ease;
      position: relative;
      cursor: pointer;
    }
    .nav-item:hover {
      background: #f9fafb;
      color: #374151;
    }
    .nav-item.active {
      background: #eff6ff;
      border-left: 3px solid #2563eb;
      color: #1d4ed8;
      font-weight: 400;
    }

    .nav-icon { width: 1.25rem; height: 1.25rem; opacity: 0.8; flex-shrink: 0; }

    .nav-item-toggle {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border-radius: 0.625rem;
      margin-bottom: 0.25rem;
      text-decoration: none;
      color: #6b7280;
      font-weight: 200;
      font-size: 0.875rem;
      transition: all 0.2s ease;
      position: relative;
      cursor: pointer;
      background: transparent;
      border: none;
      width: 100%;
      text-align: left;
      font-family: 'Lexend', sans-serif;
    }
    .nav-item-toggle:hover {
      background: #f9fafb;
      color: #374151;
    }
    .nav-item-toggle.active {
      background: #eff6ff;
      border-left: 3px solid #2563eb;
      color: #1d4ed8;
      font-weight: 400;
    }
    .toggle-chevron {
      margin-left: auto;
      flex-shrink: 0;
      transition: transform 0.2s ease;
      color: #9ca3af;
    }
    .toggle-chevron.open { transform: rotate(180deg); }

    .submenu {
      padding: 0.25rem 0 0.25rem 1rem;
      overflow: hidden;
      max-height: 0;
      transition: max-height 0.25s ease;
    }
    .submenu.open {
      max-height: 40vh;
      overflow-y: auto;
    }
    .submenu-group-title {
      font-size: 0.6875rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9ca3af;
      padding: 0.5rem 0.5rem 0.25rem;
      margin-top: 0.25rem;
    }
    .submenu-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3125rem 0.5rem;
      border-radius: 0.375rem;
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 200;
      color: #6b7280;
      text-decoration: none;
      transition: background 0.15s ease, color 0.15s ease;
      background: transparent;
      border: none;
      width: 100%;
      text-align: left;
      font-family: 'Lexend', sans-serif;
    }
    .submenu-item:hover {
      background: #f0f9ff;
      color: #1d4ed8;
    }
    .method-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.0625rem 0.3125rem;
      border-radius: 0.25rem;
      font-size: 0.625rem;
      font-weight: 500;
      letter-spacing: 0.03em;
      flex-shrink: 0;
      min-width: 2.5rem;
      justify-content: center;
    }
    .badge-get    { background: #dbeafe; color: #1e40af; }
    .badge-post   { background: #dcfce7; color: #166534; }
    .badge-patch  { background: #fef3c7; color: #92400e; }
    .badge-delete { background: #fee2e2; color: #991b1b; }
    .submenu-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .sidebar-footer {
      padding: 1rem 0.75rem;
      border-top: 1px solid #e5e7eb;
    }

    .user-footer-row {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.625rem 0.5rem;
      border-radius: 0.5rem;
      cursor: default;
      transition: background 0.15s ease;
    }
    .user-footer-row:hover {
      background: #f9fafb;
    }

    .avatar {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      background: var(--papagai-gradient-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 0.875rem;
      font-weight: 400;
      flex-shrink: 0;
    }

    .user-details { flex: 1; overflow: hidden; min-width: 0; }
    .user-name {
      font-size: 0.8125rem;
      font-weight: 500;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .user-email {
      font-size: 0.6875rem;
      font-weight: 400;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 0.0625rem;
    }

    .logout-arrow {
      flex-shrink: 0;
      background: transparent;
      border: none;
      padding: 0.25rem;
      cursor: pointer;
      color: #9ca3af;
      display: flex;
      align-items: center;
      border-radius: 0.25rem;
      transition: color 0.15s ease, background 0.15s ease;
    }
    .logout-arrow:hover { color: #374151; background: #f3f4f6; }

    .main { flex: 1; overflow-y: auto; background: var(--tui-background-base); }

    .mobile-header {
      display: none;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid #e5e7eb;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .hamburger {
      border: none; background: transparent; cursor: pointer; padding: 0.25rem;
      color: var(--tui-text-primary);
    }
    .mobile-brand { font-size: 1.25rem; font-weight: 700; color: #111827; }

    @media (max-width: 767px) {
      :host { flex-direction: column; }
      .mobile-header { display: flex; }
      .sidebar {
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        z-index: 100;
        width: 15rem;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
      }
      .sidebar.open {
        transform: translateX(0);
      }
      .sidebar-overlay {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.3);
        z-index: 99;
      }
      .main { width: 100%; }
    }
  `],
  template: `
    <!-- Mobile top bar -->
    <div class="mobile-header">
      <button class="hamburger" (click)="toggleSidebar()" aria-label="Abrir menu" type="button">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
        </svg>
      </button>
      <span class="mobile-brand">PAPAGAI</span>
    </div>

    @if (sidebarOpen()) {
      <div class="sidebar-overlay" (click)="closeSidebar()"></div>
    }

    <aside class="sidebar" [class.open]="sidebarOpen()">
      <div class="sidebar-brand">
        <img src="/parrot.svg" alt="" aria-hidden="true" />
        PAPAGAI
      </div>

      <nav class="nav-section">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
          <svg class="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/>
          </svg>
          Instâncias
        </a>

        <button type="button" class="nav-item-toggle" [class.active]="isDocsActive()" (click)="toggleDocsSubmenu()">
          <svg class="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
          </svg>
          API Docs
          <svg class="toggle-chevron" [class.open]="docsSubmenuOpen()" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        <div class="submenu" [class.open]="docsSubmenuOpen()">
          @for (group of endpointGroups; track group.id) {
            <div class="submenu-group-title">{{ group.title }}</div>
            @for (endpoint of group.endpoints; track endpoint.id) {
              <button
                type="button"
                class="submenu-item"
                (click)="navigateToEndpoint(endpoint.id)">
                <span class="method-badge badge-{{ endpoint.method.toLowerCase() }}" [attr.aria-label]="endpoint.method">
                  {{ endpoint.method }}
                </span>
                <span class="submenu-label">{{ endpoint.title }}</span>
              </button>
            }
          }
        </div>
      </nav>

      <div class="parrot-mascot">
        <img src="/parrot.svg" alt="Papagai" width="60" height="60" />
      </div>

      <div class="sidebar-footer">
        <div class="user-footer-row">
          <div class="avatar" aria-hidden="true">{{ initials() }}</div>
          <div class="user-details">
            <div class="user-name">{{ user()?.name }}</div>
            <div class="user-email">{{ user()?.email }}</div>
          </div>
          <button type="button" class="logout-arrow" (click)="logout()" aria-label="Sair">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <main class="main">
      <router-outlet />
    </main>
  `
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly docsNav = inject(DocsNavigationService);

  readonly user = this.auth.currentUser;
  readonly sidebarOpen = signal(false);
  readonly docsSubmenuOpen = signal(this.router.url.startsWith('/docs'));

  readonly endpointGroups: EndpointGroup[] = API_ENDPOINT_GROUPS;
  readonly isDocsActive = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.router.url.startsWith('/docs'))
    ),
    { initialValue: this.router.url.startsWith('/docs') }
  );

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
  closeSidebar(): void { this.sidebarOpen.set(false); }
  toggleDocsSubmenu(): void {
    const willOpen = !this.docsSubmenuOpen();
    this.docsSubmenuOpen.set(willOpen);
    if (willOpen) this.router.navigate(['/docs']);
  }

  readonly initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  });

  logout(): void {
    this.auth.logout();
  }

  navigateToEndpoint(id: string): void {
    this.docsNav.navigate(id);
    // Scroll after a tick to let the card expand
    setTimeout(() => {
      this.document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
}
