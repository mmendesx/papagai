import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'instances/:name',
        loadComponent: () =>
          import('./features/instance-detail/instance-detail.component').then(
            (m) => m.InstanceDetailComponent,
          ),
      },
      {
        path: 'instances/:name/chats',
        loadComponent: () =>
          import('./features/instance-detail/instance-chats.component').then(
            (m) => m.InstanceChatsComponent,
          ),
      },
      {
        path: 'instances/:name/settings',
        loadComponent: () =>
          import('./features/instance-detail/instance-settings.component').then(
            (m) => m.InstanceSettingsComponent,
          ),
      },
      {
        path: 'docs',
        loadComponent: () =>
          import('./features/docs/docs-page.component').then((m) => m.DocsPageComponent),
      },
      {
        path: 'apikeys',
        loadComponent: () =>
          import('./features/apikeys/apikeys.component').then((m) => m.ApikeysComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
