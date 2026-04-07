import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { filter, map, startWith } from 'rxjs/operators';
import { AuthService } from '../core/auth/auth.service';
import { API_ENDPOINT_GROUPS, EndpointGroup } from '../features/docs/api-endpoints';
import { DocsNavigationService } from '../features/docs/docs-navigation.service';
import { getAvatarColor } from '../shared/avatar-colors';
import { HeaderActionsService } from '../shared/header-actions.service';
import {
  LucideAngularModule,
  LayoutGrid,
  FileText,
  ChevronDown,
  ChevronLeft,
  LogOut,
  Menu,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-angular';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: flex; height: 100vh; overflow: hidden; }

    .sidebar {
      width: 15rem;
      min-width: 15rem;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--color-surface-container-lowest);
      border-right: 1px solid var(--color-outline-variant);
      overflow-y: auto;
      transition: width var(--duration-normal) var(--ease-out), min-width var(--duration-normal) var(--ease-out);
    }
    .sidebar.collapsed {
      width: 4rem;
      min-width: 4rem;
    }

    .sidebar-brand {
      padding: 1.25rem 1.25rem 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 900;
      font-size: 0.9rem;
      letter-spacing: 0.12em;
      color: var(--color-on-surface);
      font-family: 'Geist', sans-serif;
      flex-shrink: 0;
    }
    .sidebar-brand img { width: 28px; height: 28px; flex-shrink: 0; }
    .sidebar.collapsed .sidebar-brand { justify-content: center; padding: 1.25rem 0 0.75rem; }
    .sidebar.collapsed .sidebar-brand span { display: none; }

    .nav-section { padding: 0.5rem 0.75rem; flex: 1; }

    .nav-item, .nav-item-toggle {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border-radius: var(--radius-lg);
      margin-bottom: 0.25rem;
      text-decoration: none;
      color: var(--color-on-surface-variant);
      font-weight: 200;
      font-size: 0.875rem;
      transition: background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default);
      position: relative;
      cursor: pointer;
    }
    .nav-item-toggle { background: transparent; border: none; width: 100%; text-align: left; font-family: 'Figtree', sans-serif; }
    .nav-item:hover, .nav-item-toggle:hover { background: var(--color-surface-container); color: var(--color-on-surface); }
    .nav-item.active, .nav-item-toggle.active {
      background: var(--color-surface-container);
      border: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface);
      font-weight: 700;
      box-shadow: var(--shadow-sm);
    }

    .nav-icon { width: 1.25rem; height: 1.25rem; opacity: 0.8; flex-shrink: 0; }
    .toggle-chevron {
      margin-left: auto;
      flex-shrink: 0;
      transition: transform var(--duration-fast) var(--ease-default);
      color: var(--color-outline-variant);
    }
    .toggle-chevron.open { transform: rotate(180deg); }

    .submenu {
      padding: 0.25rem 0 0.25rem 1rem;
      overflow: hidden;
      max-height: 0;
      transition: max-height var(--duration-normal) var(--ease-out);
    }
    .submenu.open {
      max-height: 60vh;
      overflow-y: auto;
    }
    .submenu-group-title {
      font-size: 0.6875rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-on-surface-variant);
      padding: 0.5rem 0.5rem 0.25rem;
      margin-top: 0.25rem;
    }
    .submenu-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3125rem 0.5rem;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 200;
      color: var(--color-on-surface-variant);
      text-decoration: none;
      transition: background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default);
      background: transparent;
      border: none;
      width: 100%;
      text-align: left;
      font-family: 'Figtree', sans-serif;
    }
    .submenu-item:hover {
      background: var(--color-surface-container-low);
      color: var(--color-on-surface);
    }
    .method-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.0625rem 0.3125rem;
      border-radius: var(--radius-sm);
      font-size: 0.625rem;
      font-weight: 500;
      letter-spacing: 0.03em;
      flex-shrink: 0;
      min-width: 2.5rem;
      justify-content: center;
    }
    .badge-get    { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
    .badge-post   { background: var(--color-primary-container);   color: var(--color-on-primary-container); }
    .badge-patch  { background: var(--color-warning-bg);          color: var(--color-method-patch); }
    .badge-delete { background: var(--color-error-container);     color: var(--color-on-error-container); }
    .submenu-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Collapsed: hide labels, chevrons, submenu */
    .sidebar.collapsed .nav-item span,
    .sidebar.collapsed .nav-item-toggle span,
    .sidebar.collapsed .toggle-chevron,
    .sidebar.collapsed .submenu,
    .sidebar.collapsed .user-details,
    .sidebar.collapsed .logout-arrow { display: none; }
    .sidebar.collapsed .nav-item,
    .sidebar.collapsed .nav-item-toggle { justify-content: center; padding: 0.625rem; }
    .sidebar.collapsed .user-footer-row { justify-content: center; padding: 0.625rem 0; }

    .sidebar-footer {
      padding: 1rem 0.75rem;
      border-top: 1px solid var(--color-outline-variant);
    }

    .user-footer-row {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.625rem 0.5rem;
      border-radius: var(--radius-md);
      cursor: default;
      transition: background var(--duration-fast) var(--ease-default);
    }
    .user-footer-row:hover { background: var(--color-surface-container); }

    .avatar {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 400;
      flex-shrink: 0;
    }

    .user-details { flex: 1; overflow: hidden; min-width: 0; }
    .user-name {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .user-email {
      font-size: 0.6875rem;
      font-weight: 400;
      color: var(--color-on-surface-variant);
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
      color: var(--color-outline-variant);
      display: flex;
      align-items: center;
      border-radius: var(--radius-sm);
      transition: color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default);
    }
    .logout-arrow:hover { color: var(--color-on-surface); background: var(--color-surface-container); }

    /* Header actions */
    .header-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }
    .action-btn {
      font-family: var(--font-sans);
      font-size: 0.875rem;
      cursor: pointer;
      border-radius: var(--radius-lg);
      transition: opacity var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default);
    }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .gradient-btn {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border: none;
      padding: 0.375rem 0.875rem;
      font-weight: 500;
    }
    .gradient-btn:not(:disabled):hover { opacity: 0.88; }
    .cancel-btn {
      background: transparent;
      color: var(--color-on-surface);
      border: 1px solid var(--color-outline-variant);
      padding: 0.375rem 0.875rem;
      font-weight: 400;
    }
    .cancel-btn:not(:disabled):hover { border-color: var(--color-outline); }
    .negative-btn {
      background: var(--color-error-bg);
      color: var(--color-error);
      border: 1px solid var(--color-error-container);
      padding: 0.375rem 0.875rem;
      font-weight: 500;
    }
    .negative-btn:not(:disabled):hover { background: var(--color-error-container); }
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      background: transparent;
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-md);
      color: var(--color-on-surface-variant);
      padding: 0;
    }
    .icon-btn:not(:disabled):hover { background: var(--color-surface-container-low); color: var(--color-primary); }

    /* Main content */
    .main { flex: 1; overflow-y: auto; background: var(--tui-background-base); display: flex; flex-direction: column; }

    /* Header */
    .page-header-bar {
      height: var(--header-height);
      min-height: var(--header-height);
      display: flex;
      align-items: stretch;
      background: var(--color-surface-container-lowest);
      border-bottom: 1px solid var(--color-outline-variant);
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
      flex-shrink: 0;
    }

    /* Content section */
    .header-content-section {
      flex: 1;
      display: flex;
      align-items: center;
      padding: 0 1.25rem;
      gap: 0.625rem;
    }

    .header-sidebar-toggle {
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-on-surface-variant);
      padding: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      flex-shrink: 0;
      transition: background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default);
    }
    .header-sidebar-toggle:hover {
      background: var(--color-surface-container);
      color: var(--color-on-surface);
    }

    .page-header-title {
      font-size: 1.125rem;
      font-weight: 700;
      margin: 0;
      color: var(--color-on-surface);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: 'Geist', sans-serif;
    }
    .page-header-sep {
      color: var(--color-outline-variant);
      font-weight: 200;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8125rem;
      font-weight: 300;
      color: var(--color-on-surface-variant);
      text-decoration: none;
      transition: color var(--duration-fast) var(--ease-default);
    }
    .back-link:hover { color: var(--color-on-surface); }

    /* Mobile */
    .mobile-header {
      display: none;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: var(--color-surface-container-lowest);
      border-bottom: 1px solid var(--color-outline-variant);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .hamburger {
      border: none; background: transparent; cursor: pointer; padding: 0.25rem;
      color: var(--color-on-surface); display: flex; align-items: center;
    }
    .mobile-brand { font-size: 1.25rem; font-weight: 700; color: var(--color-on-surface); }

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
        transition: transform var(--duration-normal) var(--ease-out);
      }
      .sidebar.open { transform: translateX(0); }
      .sidebar-overlay {
        display: block;
        position: fixed;
        inset: 0;
        background: var(--color-overlay);
        z-index: 99;
      }
      .main { width: 100%; }
    }
  `],
  template: `
    <!-- Mobile top bar -->
    <div class="mobile-header">
      <button class="hamburger" (click)="toggleSidebar()" aria-label="Abrir menu" type="button">
        <lucide-icon [img]="icons.Menu" [size]="20" aria-hidden="true" />
      </button>
      <span class="mobile-brand">PAPAGAI</span>
    </div>

    @if (sidebarOpen()) {
      <div class="sidebar-overlay" (click)="closeSidebar()"></div>
    }

    <aside class="sidebar" [class.open]="sidebarOpen()" [class.collapsed]="sidebarCollapsed()">
      <div class="sidebar-brand">
        <img src="/parrot.svg" alt="" aria-hidden="true" />
      </div>

      <nav class="nav-section">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item" title="Instâncias" (click)="closeSidebar()">
          <lucide-icon [img]="icons.LayoutGrid" [size]="20" class="nav-icon" aria-hidden="true" />
          <span>Instâncias</span>
        </a>

        <button type="button" class="nav-item-toggle" title="API Docs" [class.active]="isDocsActive()" (click)="toggleDocsSubmenu()">
          <lucide-icon [img]="icons.FileText" [size]="20" class="nav-icon" aria-hidden="true" />
          <span>API Docs</span>
          <lucide-icon [img]="icons.ChevronDown" [size]="14" class="toggle-chevron" [class.open]="docsSubmenuOpen()" aria-hidden="true" />
        </button>

        <div class="submenu" [class.open]="docsSubmenuOpen()">
          @for (group of endpointGroups; track group.id) {
            <div class="submenu-group-title">{{ group.title }}</div>
            @for (endpoint of group.endpoints; track endpoint.id) {
              <button type="button" class="submenu-item" (click)="navigateToEndpoint(endpoint.id)">
                <span class="method-badge badge-{{ endpoint.method.toLowerCase() }}" [attr.aria-label]="endpoint.method">
                  {{ endpoint.method }}
                </span>
                <span class="submenu-label">{{ endpoint.title }}</span>
              </button>
            }
          }
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-footer-row">
          <div class="avatar" aria-hidden="true"
               [style.background]="getAvatarStyle(user()?.name ?? '').bg"
               [style.color]="getAvatarStyle(user()?.name ?? '').text">{{ initials() }}</div>
          <div class="user-details">
            <div class="user-name">{{ user()?.name }}</div>
            <div class="user-email">{{ user()?.email }}</div>
          </div>
          <button type="button" class="logout-arrow" (click)="logout()" aria-label="Sair">
            <lucide-icon [img]="icons.LogOut" [size]="16" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>

    <main class="main">
      <div class="page-header-bar">
        <!-- Content section: collapse/expand button + page title -->
        <div class="header-content-section">
          <button type="button" class="header-sidebar-toggle" (click)="toggleCollapse()"
                  [title]="sidebarCollapsed() ? 'Expandir menu' : 'Recolher menu'"
                  [attr.aria-label]="sidebarCollapsed() ? 'Expandir menu lateral' : 'Recolher menu lateral'">
            @if (sidebarCollapsed()) {
              <lucide-icon [img]="icons.PanelLeftOpen" [size]="18" aria-hidden="true" />
            } @else {
              <lucide-icon [img]="icons.PanelLeftClose" [size]="18" aria-hidden="true" />
            }
          </button>
          <h1 class="page-header-title">
            @if (isInstancePage()) {
              <a routerLink="/dashboard" class="back-link">
                <lucide-icon [img]="icons.ChevronLeft" [size]="16" aria-hidden="true" />
                Voltar
              </a>
              <span class="page-header-sep">|</span>
            }
            {{ pageTitle() }}
          </h1>
          @if (headerActions.actions().length) {
            <div class="header-actions">
              @for (action of headerActions.actions(); track action.id) {
                <button
                  type="button"
                  [class]="actionClass(action.variant)"
                  [disabled]="action.disabled?.() ?? false"
                  (click)="action.onClick()"
                >{{ action.label }}</button>
              }
            </div>
          }
        </div>
      </div>
      <router-outlet />
    </main>
  `
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly docsNav = inject(DocsNavigationService);
  readonly headerActions = inject(HeaderActionsService);

  readonly icons = { LayoutGrid, FileText, ChevronDown, ChevronLeft, LogOut, Menu, PanelLeftOpen, PanelLeftClose };

  readonly user = this.auth.currentUser;
  readonly sidebarOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
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

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly pageTitle = computed(() => {
    const url = this.currentUrl();
    if (url.startsWith('/instances/')) {
      const name = url.split('/')[2];
      return name ? `Instância: ${decodeURIComponent(name)}` : 'Instância';
    }
    if (url.startsWith('/docs')) return 'API Docs';
    if (url.startsWith('/dashboard')) return 'Instâncias';
    return 'Papagai';
  });

  readonly isInstancePage = computed(() => this.currentUrl().startsWith('/instances/'));

  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationStart),
      takeUntilDestroyed(),
    ).subscribe(() => this.headerActions.clearActions());
  }

  actionClass(variant: string): string {
    const map: Record<string, string> = {
      primary:   'action-btn gradient-btn',
      secondary: 'action-btn cancel-btn',
      negative:  'action-btn negative-btn',
      'icon-only': 'action-btn icon-btn',
    };
    return map[variant] ?? 'action-btn';
  }

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
  closeSidebar(): void { this.sidebarOpen.set(false); }
  toggleCollapse(): void { this.sidebarCollapsed.update(v => !v); }
  toggleDocsSubmenu(): void {
    const willOpen = !this.docsSubmenuOpen();
    this.docsSubmenuOpen.set(willOpen);
    if (willOpen) this.router.navigate(['/docs']);
  }

  readonly initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  });

  getAvatarStyle(name: string): { bg: string; text: string } {
    return getAvatarColor(name);
  }

  logout(): void {
    this.auth.logout();
  }

  navigateToEndpoint(id: string): void {
    this.docsNav.navigate(id);
    setTimeout(() => {
      this.document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
}
