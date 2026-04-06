# EasyChat → Taiga UI 5.0 Migration: Components Reference

Focused reference for constraints, colors, CSS tokens, sizing, loading states, skeletons, and sidebar.
Companion to [UI_GUIDELINES_MIGRATION.md](./UI_GUIDELINES_MIGRATION.md).

---

## Design Tokens (`tokens.css` → CSS variables)

All CSS custom properties from `src/styles/tokens.css` map 1:1 into the Angular app's `styles.scss`.
No translation needed — keep the same variable names and override Taiga's defaults where they conflict.

### Layout tokens

```scss
:root {
  --header-height: 64px;
  --content-max-width: 1280px;
  --page-padding: 2rem;            // --space-8
  --chat-sidebar-width: 320px;
  --chat-panel-width: 288px;
  --leads-sidebar-width: 256px;
  --form-max-width: 360px;
}
```

### Spacing scale

```scss
:root {
  --space-1:  0.25rem;  //  4px
  --space-2:  0.5rem;   //  8px
  --space-3:  0.75rem;  // 12px
  --space-4:  1rem;     // 16px
  --space-5:  1.25rem;  // 20px
  --space-6:  1.5rem;   // 24px
  --space-8:  2rem;     // 32px
  --space-10: 2.5rem;   // 40px
  --space-12: 3rem;     // 48px
  --space-16: 4rem;     // 64px
}
```

### Border radius scale

```scss
:root {
  --radius-sm:   0.25rem;   // rounded-sm  →  4px
  --radius-md:   0.5rem;    // rounded-md  →  8px
  --radius-lg:   0.75rem;   // rounded-lg  → 12px
  --radius-xl:   1rem;      // rounded-xl  → 16px
  --radius-2xl:  1.5rem;    // rounded-2xl → 24px
  --radius-full: 9999px;    // rounded-full

  // Taiga override — aligns Taiga's internal radius to the scale above
  --tui-radius: var(--radius-lg);
}
```

### Shadow scale

```scss
:root {
  --shadow-sm: 0 1px 2px rgba(20,20,19,.05);
  --shadow-md: 0 4px 6px -1px rgba(20,20,19,.08), 0 2px 4px -2px rgba(20,20,19,.06);
  --shadow-lg: 0 10px 15px -3px rgba(20,20,19,.08), 0 4px 6px -4px rgba(20,20,19,.06);
  --shadow-xl: 0 20px 25px -5px rgba(20,20,19,.10), 0 8px 10px -6px rgba(20,20,19,.08);
}
```

### Motion tokens

```scss
:root {
  --duration-instant: 100ms;
  --duration-fast:    150ms;
  --duration-normal:  250ms;
  --duration-slow:    400ms;
  --duration-slower:  600ms;

  --ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-out:     cubic-bezier(0, 0, 0.2, 1);
  --ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-bounce:  cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

### Z-index scale

```scss
:root {
  --z-dropdown: 1000;
  --z-sticky:   1100;
  --z-modal:    1200;
  --z-tooltip:  1300;
  --z-toast:    1400;
}
```

---

## Color Tokens

### MD3 palette → `styles.scss`

```scss
:root {
  // Primary (green)
  --color-primary:              #006a2d;
  --color-primary-container:    #6bff8f;
  --color-on-primary:           #ceffd0;
  --color-on-primary-container: #005f28;

  // Secondary (blue)
  --color-secondary:              #006286;
  --color-secondary-container:    #9bdaff;
  --color-on-secondary:           #e7f5ff;
  --color-on-secondary-container: #004d6a;

  // Tertiary (purple)
  --color-tertiary:              #8126cf;
  --color-tertiary-container:    #ce9bff;
  --color-on-tertiary:           #fbefff;
  --color-on-tertiary-container: #4a0080;

  // Error (red)
  --color-error:              #b31b25;
  --color-error-container:    #fb5151;
  --color-on-error:           #ffefee;
  --color-on-error-container: #570008;

  // Surface scale
  --color-surface:                   #f5f7f9;
  --color-surface-container-lowest:  #ffffff;
  --color-surface-container-low:     #eef1f3;
  --color-surface-container:         #e5e9eb;
  --color-surface-container-high:    #dfe3e6;
  --color-surface-container-highest: #d9dde0;

  // Text
  --color-on-surface:         #2c2f31;
  --color-on-surface-variant: #595c5e;

  // Borders
  --color-outline:         #747779;
  --color-outline-variant: #abadaf;

  // Semantic aliases (used by toast, status badges)
  --color-success-bg: #f4f6ef;
  --color-warning-bg: #fdf3ee;
  --color-error-bg:   #fef2f2;
  --color-info-bg:    #f0f6fb;

  // Taiga overrides — map Taiga's system onto the MD3 palette
  --tui-background-accent-1:       var(--color-primary);
  --tui-background-accent-1-hover: var(--color-primary-container);
  --tui-background-accent-2:       var(--color-secondary);
  --tui-background-accent-2-hover: var(--color-secondary-container);
  --tui-status-negative:           var(--color-error);
  --tui-status-negative-pale:      var(--color-error-container);
  --tui-background-base:           var(--color-surface);
  --tui-background-base-alt:       var(--color-surface-container-lowest);
  --tui-background-neutral-1:      var(--color-surface-container-low);
  --tui-background-neutral-2:      var(--color-surface-container);
  --tui-text-primary:              var(--color-on-surface);
  --tui-text-secondary:            var(--color-on-surface-variant);
  --tui-border-normal:             var(--color-outline-variant);
  --tui-border-focus:              var(--color-secondary);
}
```

### WhatsApp status badge colors

| Status | bg | border | text |
|---|---|---|---|
| `CONNECTED` | `--color-primary-container` | `--color-primary` at 30% | `--color-on-primary-container` |
| `CONNECTING` | `--color-warning-bg` | `#d97757` at 30% | `#d97757` + `animate-pulse` |
| `DISCONNECTED` | `--color-error-container` | `--color-error` at 30% | `--color-on-error-container` |

---

## Component Size Constraints

### Button

| Size | Height | Padding | Font | Radius | Taiga `size` |
|---|---|---|---|---|---|
| `sm` | `2rem` (32px) | `px: 0.75rem` | `0.75rem` | `--radius-md` | `"s"` |
| `default` | `2.5rem` (40px) | `px: 1rem` | `0.875rem` | `--radius-lg` | `"m"` |
| `lg` | `3rem` (48px) | `px: 1.5rem` | `1rem` | `--radius-lg` | `"l"` |
| `icon` | `2.5rem × 2.5rem` | — | — | `--radius-lg` | `tuiIconButton "m"` |

Loading state: replaces content with `Loader2` at `h-4 w-4 animate-spin` + `mr-2` when not `icon` size. In Taiga use `[loading]="true"` on `[tuiButton]`.

### Input / Textfield

| Property | Value |
|---|---|
| Height | `2.5rem` (40px) — size `m` |
| Horizontal padding | `0.75rem` (12px) |
| Border | `1px solid --color-outline-variant` |
| Border radius | `--radius-xl` (16px) |
| Focus border | `--color-secondary` |
| Icon slot width | `2.5rem` — absolute inset-left |
| Error text | `0.75rem`, `--color-error` |

In Taiga: `<tui-textfield size="m">` matches height. Set `--tui-radius: var(--radius-xl)` per-component if needed.

### Avatar

| Size | Dimensions | Font size | Taiga `size` |
|---|---|---|---|
| `sm` | `2rem × 2rem` (32px) | `0.75rem` | `"s"` |
| `default` | `2.5rem × 2.5rem` (40px) | `0.875rem` | `"m"` |
| `lg` | `3rem × 3rem` (48px) | `1rem` | `"l"` |

Color cycling (deterministic by initials charcode mod 5):
1. `bg-primary-container` / `text-on-primary-container`
2. `bg-secondary-container` / `text-on-secondary-container`
3. `bg-tertiary-container` / `text-on-tertiary-container`
4. `bg-error-container` / `text-on-error-container`
5. `bg-surface-container-high` / `text-on-surface`

```typescript
// Angular equivalent
function getAvatarColor(initials: string): { bg: string; text: string } {
  const COLORS = [
    { bg: 'primary-container',   text: 'on-primary-container' },
    { bg: 'secondary-container', text: 'on-secondary-container' },
    { bg: 'tertiary-container',  text: 'on-tertiary-container' },
    { bg: 'error-container',     text: 'on-error-container' },
    { bg: 'surface-container-high', text: 'on-surface' },
  ];
  const code = [...initials].reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[code % COLORS.length];
}
```

### Spinner

| Size | Dimensions | Tailwind / CSS |
|---|---|---|
| `sm` | `1rem × 1rem` (16px) | `h-4 w-4` |
| `default` | `1.5rem × 1.5rem` (24px) | `h-6 w-6` |
| `lg` | `2rem × 2rem` (32px) | `h-8 w-8` |

Base classes: `animate-spin rounded-full border-2 border-outline-variant border-t-primary`

In Taiga: `<tui-loader size="s|m|l" />` — override color with `--tui-background-accent-1`.

---

## Loading — Toast with Icon (Sonner-style)

The current implementation is a custom `ToastProvider` using `motion/react`, not Sonner. Behavior:

- **Position:** `fixed bottom-4 right-4 z-[--z-toast]`
- **Stack direction:** column, `gap-2`, newest on top
- **Entry:** `opacity 0 → 1`, `x +60px → 0`, `scale 0.95 → 1` — spring (`stiffness: 500, damping: 35`)
- **Exit:** reverse of entry
- **Progress bar:** `absolute bottom-0 left-0 h-[2px] bg-white/30` animates `width: 100% → 0%` over `duration` ms
- **Click to dismiss**
- **Auto-dismiss:** 3 000 ms default

### Toast type → background color

| Type | Background |
|---|---|
| `success` | `--color-green` (`#788c5d`) |
| `error` | `bg-red-500` (`#ef4444`) |
| `warning` | `bg-amber-500` (`#f59e0b`) |
| `info` | `--color-blue` (`#6a9bcc`) |

Text: always `text-white text-sm`.
Shape: `rounded-lg px-4 py-3 shadow-lg`.

### Angular migration

```typescript
// toast.service.ts
import { Injectable, inject } from '@angular/core';
import { TuiAlertService } from '@taiga-ui/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly alerts = inject(TuiAlertService);

  success(message: string): void {
    this.alerts.open(message, {
      appearance: 'positive',
      autoClose: 3000,
    }).subscribe();
  }

  error(message: string): void {
    this.alerts.open(message, {
      appearance: 'negative',
      autoClose: 5000,
    }).subscribe();
  }

  warning(message: string): void {
    this.alerts.open(message, {
      appearance: 'warning',
      autoClose: 4000,
    }).subscribe();
  }

  info(message: string): void {
    this.alerts.open(message, {
      appearance: 'info',
      autoClose: 3000,
    }).subscribe();
  }
}
```

For a **loading toast** (persists until dismissed):

```typescript
import { Subject } from 'rxjs';

showLoadingToast(message: string): Subject<void> {
  const dismiss$ = new Subject<void>();
  this.alerts.open(message, {
    appearance: 'info',
    autoClose: false,         // stays open
    closeable: false,
  }).pipe(takeUntil(dismiss$)).subscribe();
  return dismiss$;            // caller calls dismiss$.next() to close
}
```

---

## Loading Skeleton

Base skeleton: shimmer gradient animating `background-position` from `-200%` to `+200%` over 2s.

```scss
// Angular equivalent of the Skeleton component
.ec-skeleton {
  border-radius: var(--radius-md);
  background: linear-gradient(
    90deg,
    rgba(20,20,19,.05) 0%,
    rgba(20,20,19,.10) 50%,
    rgba(20,20,19,.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s linear infinite;
}

@keyframes shimmer {
  from { background-position: -200% 0; }
  to   { background-position:  200% 0; }
}
```

### Skeleton variants → Angular components

**`StatCardSkeleton`** — `border border-dark/10 rounded-xl p-5 shadow-sm bg-white`

```html
<div class="ec-stat-card-skeleton">
  <div class="ec-stat-card-skeleton__header">
    <div class="ec-skeleton" style="height:1rem; width:7rem;"></div>
    <div class="ec-skeleton" style="height:2.25rem; width:2.25rem; border-radius:var(--radius-lg)"></div>
  </div>
  <div class="ec-skeleton" style="height:2rem; width:5rem; margin-bottom:.25rem"></div>
  <div class="ec-skeleton" style="height:.75rem; width:4rem"></div>
</div>
```

**`CardSkeleton`** — avatar + 3 text lines

```html
<div class="ec-card-skeleton">
  <div class="ec-skeleton" style="height:2.5rem; width:2.5rem; border-radius:50%; flex-shrink:0"></div>
  <div style="flex:1; display:flex; flex-direction:column; gap:.5rem">
    <div class="ec-skeleton" style="height:1rem; width:10rem"></div>
    <div class="ec-skeleton" style="height:.75rem; width:16rem"></div>
    <div class="ec-skeleton" style="height:.75rem; width:8rem"></div>
  </div>
</div>
```

**`TableRowSkeleton`** — `n` cells, first cell wider

```html
<!-- columns input, default 4 -->
<tr class="ec-table-row-skeleton">
  @for (col of columns; track $index) {
    <td style="padding: .75rem 1rem">
      <div class="ec-skeleton" [style.width]="$index === 0 ? '8rem' : '5rem'" style="height:1rem"></div>
    </td>
  }
</tr>
```

**`ChatMessageSkeleton`** — bubble with optional avatar

```html
<div class="ec-message-skeleton" [class.ec-message-skeleton--me]="fromMe">
  @if (!fromMe) {
    <div class="ec-skeleton ec-message-skeleton__avatar"></div>
  }
  <div class="ec-message-skeleton__body">
    <div class="ec-skeleton" [style.width]="fromMe ? '12rem' : '16rem'" style="height:2.5rem; border-radius:var(--radius-xl)"></div>
    <div class="ec-skeleton" style="height:.75rem; width:3rem"></div>
  </div>
</div>
```

```scss
.ec-message-skeleton {
  display: flex;
  justify-content: flex-start;
  margin-bottom: .75rem;
  gap: .5rem;

  &--me { justify-content: flex-end; }

  &__avatar {
    height: 2rem;
    width: 2rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: .25rem;
    max-width: 60%;
  }

  &--me &__body { align-items: flex-end; }
}
```

In Taiga use `[tuiSkeleton]="isLoading"` on the real element where it wraps a single block. For multi-row/complex layouts, use the custom `ec-skeleton` class directly.

---

## Sidebar

### Dimensions & structure

| State | Width | Transition |
|---|---|---|
| Expanded | `16rem` (256px) | `transition-[width] duration-200 ease-out` |
| Collapsed | `4rem` (64px) | same |

Base: `bg-surface-container-low border-r border-outline-variant h-full flex flex-col flex-shrink-0 overflow-hidden`

Three vertical regions:
1. **Label strip** — shown only when expanded: `px-3 pt-3 pb-1`, text `text-[10px] font-bold text-outline uppercase tracking-widest`
2. **Nav area** — `flex-1 overflow-y-auto px-2 pt-1 space-y-0.5`
3. **User card** — `mt-auto p-2`

### Nav item states

```
Base (both):     flex items-center rounded-lg font-semibold transition-all text-sm
Expanded:        gap-3 px-3 py-2
Collapsed:       justify-center px-2 py-2
Active:          bg-surface-container border border-outline-variant text-on-surface font-bold shadow-sm
Inactive hover:  hover:bg-surface-container hover:text-on-surface
Inactive:        text-on-surface-variant
```

Icons: `h-4 w-4` (Lucide). Hidden labels when collapsed (`title` attr for tooltip).

### Settings separator

```
pt-2 mt-2 border-t border-outline-variant
```

Settings item is the only item below the separator. Same nav item classes as primary nav.

### User card (bottom)

```
bg-surface-container border border-outline-variant rounded-xl p-2 flex items-center
Expanded: gap-2
Collapsed: justify-center
```

Contents (expanded only):
- `Avatar` size `sm`
- Name: `font-bold text-xs text-on-surface truncate`
- Role: `text-[10px] font-bold uppercase text-on-surface-variant`
- Logout button: `ghost icon h-7 w-7` — shows `Loader2 h-3.5 w-3.5 animate-spin` when pending

### Angular migration

```typescript
// sidebar.component.ts
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { UiStore } from '@/store/ui.store';
import { AuthService } from '@/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ec-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TuiButton, TuiIcon],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  readonly ui = inject(UiStore);
  readonly auth = inject(AuthService);

  readonly navItems = [
    { label: 'Dashboard',    href: '/dashboard',    icon: '@tui.layout-dashboard' },
    { label: 'Chat',         href: '/chat',          icon: '@tui.message-square'   },
    { label: 'Disparador',   href: '/disparador',    icon: '@tui.send'             },
    { label: 'Agendador',    href: '/agendador',     icon: '@tui.calendar'         },
    { label: 'Leads',        href: '/leads',         icon: '@tui.users'            },
    { label: 'Templates',    href: '/templates',     icon: '@tui.file-text'        },
  ];

  readonly settingsItem = { label: 'Configurações', href: '/configuracoes', icon: '@tui.settings' };
}
```

```html
<!-- sidebar.component.html -->
<aside
  class="ec-sidebar"
  [class.ec-sidebar--collapsed]="!ui.sidebarOpen()"
>
  @if (ui.sidebarOpen()) {
    <div class="ec-sidebar__label">Menu</div>
  }

  <nav class="ec-sidebar__nav">
    <ul>
      @for (item of navItems; track item.href) {
        <li>
          <a
            [routerLink]="item.href"
            routerLinkActive="ec-sidebar__link--active"
            class="ec-sidebar__link"
            [title]="item.label"
          >
            <tui-icon [icon]="item.icon" class="ec-sidebar__icon" />
            @if (ui.sidebarOpen()) {
              <span>{{ item.label }}</span>
            }
          </a>
        </li>
      }
    </ul>

    <div class="ec-sidebar__separator">
      <ul>
        <li>
          <a
            [routerLink]="settingsItem.href"
            routerLinkActive="ec-sidebar__link--active"
            class="ec-sidebar__link"
            [title]="settingsItem.label"
          >
            <tui-icon [icon]="settingsItem.icon" class="ec-sidebar__icon" />
            @if (ui.sidebarOpen()) {
              <span>{{ settingsItem.label }}</span>
            }
          </a>
        </li>
      </ul>
    </div>
  </nav>

  <div class="ec-sidebar__user" [class.ec-sidebar__user--collapsed]="!ui.sidebarOpen()">
    <div [tuiAvatar]="auth.user()?.initials ?? '?'" size="s"></div>
    @if (ui.sidebarOpen()) {
      <div class="ec-sidebar__user-info">
        <p class="ec-sidebar__user-name">{{ auth.user()?.name }}</p>
        <p class="ec-sidebar__user-role">ADMIN DO SISTEMA</p>
      </div>
      <button
        tuiIconButton
        appearance="ghost"
        size="xs"
        [loading]="auth.isLoggingOut()"
        iconStart="@tui.log-out"
        (click)="auth.logout()"
        title="Sair"
      ></button>
    }
  </div>
</aside>
```

```scss
// sidebar.component.scss
.ec-sidebar {
  width: 16rem;
  background: var(--color-surface-container-low);
  border-right: 1px solid var(--color-outline-variant);
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  transition: width var(--duration-normal) var(--ease-out);

  &--collapsed { width: 4rem; }

  &__label {
    padding: .75rem .75rem .25rem;
    font-size: .625rem;        // 10px
    font-weight: 700;
    color: var(--color-outline);
    text-transform: uppercase;
    letter-spacing: .12em;
  }

  &__nav {
    flex: 1;
    overflow-y: auto;
    padding: .25rem .5rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;             // space-y-0.5
  }

  &__link {
    display: flex;
    align-items: center;
    border-radius: var(--radius-lg);
    font-weight: 600;
    font-size: .875rem;
    transition: background var(--duration-fast), color var(--duration-fast);
    color: var(--color-on-surface-variant);
    text-decoration: none;
    padding: .5rem .75rem;
    gap: .75rem;

    .ec-sidebar--collapsed & {
      justify-content: center;
      padding: .5rem;
    }

    &:hover {
      background: var(--color-surface-container);
      color: var(--color-on-surface);
    }

    &--active {
      background: var(--color-surface-container);
      border: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface);
      font-weight: 700;
      box-shadow: var(--shadow-sm);
    }
  }

  &__icon { width: 1rem; height: 1rem; flex-shrink: 0; }

  &__separator {
    padding-top: .5rem;
    margin-top: .5rem;
    border-top: 1px solid var(--color-outline-variant);
  }

  &__user {
    margin-top: auto;
    padding: .5rem;
    display: flex;
    align-items: center;
    gap: .5rem;
    background: var(--color-surface-container);
    border: 1px solid var(--color-outline-variant);
    border-radius: var(--radius-xl);
    margin: auto .5rem .5rem;

    &--collapsed { justify-content: center; }
  }

  &__user-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  &__user-name {
    font-weight: 700;
    font-size: .75rem;
    color: var(--color-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__user-role {
    font-size: .625rem;    // 10px
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-on-surface-variant);
  }
}
```

### Header — sidebar brand section

The header mirrors the sidebar width with `transition-[width] duration-200 ease-out`:

| State | Width | Content |
|---|---|---|
| Expanded | `16rem` — `px-4 justify-start` | Logo mark (`w-7 h-7`) + `"EASYCHAT"` wordmark |
| Collapsed | `4rem` — `justify-center` | Toggle button (`PanelLeftOpen h-4 w-4`) |

Toggle button classes: `p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors`

Header height: `4rem` (64px) — `h-16 flex items-stretch border-b border-outline-variant bg-white flex-shrink-0`
