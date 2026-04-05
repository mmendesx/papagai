import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">Papagai</div>
        <nav>
          <a
            routerLink="/dashboard"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            >Dashboard</a
          >
        </nav>
        <div class="sidebar-footer">
          @if (user(); as u) {
            <div class="user">{{ u.name }}</div>
            <div class="email">{{ u.email }}</div>
          }
          <button tuiButton type="button" appearance="secondary" size="s" (click)="logout()">
            Log out
          </button>
        </div>
      </aside>
      <main class="main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .layout {
        display: flex;
        min-height: 100vh;
      }
      .sidebar {
        width: 14rem;
        padding: 1.25rem;
        border-right: 1px solid var(--tui-base-03);
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background: var(--tui-background-elevation-1);
      }
      .brand {
        font: var(--tui-font-text-l);
        font-weight: 600;
      }
      nav a {
        display: block;
        padding: 0.5rem 0.75rem;
        border-radius: var(--tui-radius-s);
        color: var(--tui-text-primary);
        text-decoration: none;
      }
      nav a.active {
        background: var(--tui-background-accent-1);
      }
      .sidebar-footer {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .user {
        font-weight: 600;
      }
      .email {
        font: var(--tui-font-text-s);
        color: var(--tui-text-secondary);
        word-break: break-all;
      }
      .main {
        flex: 1;
        padding: 1.5rem;
        overflow: auto;
      }
    `,
  ],
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.currentUser;

  logout(): void {
    this.auth.logout();
  }
}
