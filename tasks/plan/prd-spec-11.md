# PRD: Angular Dashboard UI for Papagai

**Spec**: tasks/specs/spec-11-angular-dashboard-ui.md

## Summary

Add a full Angular 19 SPA dashboard to the Papagai NestJS monolith with JWT authentication (Postgres-backed users, APP_KEY-gated registration) and complete WhatsApp instance management — creation, QR scanning, messaging, chat browsing, status monitoring, and deletion. The Angular app is served by NestJS via `@nestjs/serve-static` and follows the CLAUDE.md conventions (signals, standalone components, Taiga UI, OnPush).

## Behavior scenarios

### Feature: User Registration

#### Scenario: Successful registration with valid APP_KEY
  Given the server has APP_KEY set to "secret123"
  When the user submits the registration form with name "Alice", email "alice@test.com", password "Str0ng!Pass", and appKey "secret123"
  Then a new user is created in the database with hashed password
  And the response contains a JWT access token and user profile

#### Scenario: Registration rejected with invalid APP_KEY
  Given the server has APP_KEY set to "secret123"
  When the user submits the registration form with appKey "wrong-key"
  Then the server responds with 403 Forbidden
  And the UI displays an error notification "Invalid application key"

#### Scenario: Registration rejected with duplicate email
  Given a user with email "alice@test.com" already exists
  When a new user submits registration with the same email
  Then the server responds with 409 Conflict
  And the UI displays an error notification "Email already registered"

#### Scenario: Registration form validation
  Given the user is on the registration page
  When the user leaves required fields empty and attempts to submit
  Then inline validation errors appear for each empty required field
  And the submit button remains disabled

### Feature: User Login

#### Scenario: Successful login
  Given a user "alice@test.com" exists with password "Str0ng!Pass"
  When the user submits the login form with correct credentials
  Then the response contains a JWT access token
  And the user is redirected to the dashboard

#### Scenario: Login with wrong credentials
  Given a user "alice@test.com" exists
  When the user submits the login form with wrong password
  Then the server responds with 401 Unauthorized
  And the UI displays an error notification "Invalid email or password"

#### Scenario: Token stored and sent on subsequent requests
  Given the user has logged in and received a token
  When the user navigates to the dashboard
  Then the Authorization header includes "Bearer <token>" on the API request

### Feature: Route Protection

#### Scenario: Unauthenticated user redirected to login
  Given no JWT token is stored
  When the user navigates to /dashboard
  Then the user is redirected to /login

#### Scenario: Expired token triggers re-login
  Given the stored JWT token has expired
  When any API request returns 401
  Then the token is cleared from storage
  And the user is redirected to /login with a notification

### Feature: Instance List Dashboard

#### Scenario: Dashboard shows all instances
  Given 3 WhatsApp instances exist (inst-a connected, inst-b disconnected, inst-c connecting)
  When the user navigates to /dashboard
  Then all 3 instances are displayed with their name and status badge (connected/disconnected/connecting)

#### Scenario: Empty state
  Given no instances exist
  When the user navigates to /dashboard
  Then a message "No instances yet" is shown with a create button

### Feature: Create Instance

#### Scenario: Successful instance creation
  Given the user is on the dashboard
  When the user clicks "Create Instance", fills in name "my-bot", and submits
  Then a POST request is sent to /api/instances/create
  And the user is navigated to /instances/my-bot showing the QR code

#### Scenario: Instance creation with webhook
  Given the user is on the create instance dialog
  When the user fills in name "my-bot", webhook URL "https://hook.example.com", and submits
  Then the instance is created with the webhook configuration

#### Scenario: Instance creation fails with duplicate name
  Given an instance named "my-bot" already exists
  When the user tries to create another instance named "my-bot"
  Then an error notification is shown

### Feature: QR Code Scanning

#### Scenario: QR code displayed and polls
  Given instance "my-bot" is in state "qr" with a QR string
  When the user views the instance detail
  Then a QR code image is displayed
  And the page polls every 3 seconds for updated QR/status

#### Scenario: QR code transitions to connected
  Given instance "my-bot" was showing a QR code
  When the WhatsApp is scanned and status becomes "connected"
  Then the QR code is replaced with connection info (phone number, uptime)
  And polling stops

#### Scenario: Polling stops on navigation away
  Given instance "my-bot" QR polling is active
  When the user navigates to /dashboard
  Then the polling interval is cleared

### Feature: Send Message

#### Scenario: Successful text message send
  Given instance "my-bot" is connected
  When the user enters phone "5511999999999", message "Hello!", and clicks send
  Then a POST is sent to /api/instances/my-bot/messages with the Meta-format body
  And a success notification is shown

#### Scenario: Send message validation
  Given the send message form is displayed
  When the user leaves the phone number empty and clicks send
  Then an inline validation error appears on the phone field

#### Scenario: Send message to disconnected instance
  Given instance "my-bot" is disconnected
  When the user tries to send a message
  Then an error notification is shown indicating the instance is not connected

### Feature: View Chats

#### Scenario: Chat list loaded
  Given instance "my-bot" has 5 chats
  When the user navigates to the chats tab
  Then 5 chats are displayed with contact name/number

#### Scenario: Empty chat list
  Given instance "my-bot" has no chats
  When the user navigates to the chats tab
  Then a message "No chats yet" is shown

### Feature: Instance Status

#### Scenario: Status panel shows connection info
  Given instance "my-bot" is connected with phone "5511999999999" and uptime 3600000ms
  When the user views the instance detail
  Then the status panel shows "Connected", phone number "5511999999999", and formatted uptime

### Feature: Delete Instance

#### Scenario: Successful deletion with confirmation
  Given instance "my-bot" exists
  When the user clicks delete and confirms in the dialog
  Then DELETE /api/instances/my-bot is called
  And the user is redirected to /dashboard
  And a success notification is shown

#### Scenario: Deletion cancelled
  Given the user clicks delete on instance "my-bot"
  When the user clicks "Cancel" in the confirmation dialog
  Then no delete request is made
  And the user stays on the current page

### Feature: Logout

#### Scenario: User logs out
  Given the user is logged in
  When the user clicks logout
  Then the token is removed from localStorage
  And the user is redirected to /login

## Tasks

### ICT-1: Backend — User entity and database setup
- **What**: Create `User` TypeORM entity (uuid PK, name, email unique, password_hash, created_at, updated_at). Register in `AppModule`'s TypeORM entities array.
- **Where**: `src/auth/entities/user.entity.ts`, `src/app.module.ts`
- **Validated by**: Prerequisite for all auth scenarios
- **Estimate**: S

### ICT-2: Backend — AuthModule with JWT
- **What**: Create `AuthModule` importing `JwtModule.registerAsync` (secret from `JWT_SECRET` env, 24h expiry), `TypeOrmModule.forFeature([User])`. Create `AuthService` with `register()` (validate APP_KEY, hash password with bcrypt, save user, return JWT), `login()` (validate credentials, return JWT), `validateUser()`. Create `JwtAuthGuard` (CanActivate, extracts Bearer token, verifies with JwtService, attaches user to request). Add `APP_KEY` and `JWT_SECRET` to `configuration.ts`.
- **Where**: `src/auth/auth.module.ts`, `src/auth/auth.service.ts`, `src/auth/guards/jwt-auth.guard.ts`, `src/auth/dto/register.dto.ts`, `src/auth/dto/login.dto.ts`, `src/config/configuration.ts`
- **Validated by**: Successful registration, Registration rejected with invalid APP_KEY, Registration rejected with duplicate email, Successful login, Login with wrong credentials
- **Estimate**: M

### ICT-3: Backend — AuthController endpoints
- **What**: Create `AuthController` at `/api/auth` with `POST /register`, `POST /login`, `GET /me` (protected). Register guards on `/me`.
- **Where**: `src/auth/auth.controller.ts`
- **Validated by**: Successful registration, Successful login, Token stored and sent
- **Estimate**: S

### ICT-4: Backend — Move instance routes under /api prefix and add JWT guard
- **What**: Change `@Controller('instances')` to `@Controller('api/instances')`. Apply `@UseGuards(JwtAuthGuard)` at controller level. Import `AuthModule` in `InstancesModule` (or make guard global). Update webhook controller if needed.
- **Where**: `src/instances/instances.controller.ts`, `src/instances/instances.module.ts`
- **Validated by**: Unauthenticated user redirected, Expired token triggers re-login, all instance operation scenarios
- **Estimate**: S

### ICT-5: Backend — Install and configure ServeStaticModule
- **What**: Install `@nestjs/serve-static`. Add `ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'client', 'dist', 'client', 'browser'), exclude: ['/api/(.*)', '/media/(.*)'] })` to `AppModule`. Keep existing `useStaticAssets` for `/media/` or migrate to ServeStaticModule config.
- **Where**: `src/app.module.ts`, `package.json`
- **Validated by**: Angular SPA loads at root URL, API routes still work, media still served
- **Estimate**: S

### ICT-6: Frontend — Initialize Angular 19 workspace
- **What**: Run `ng new client --style=scss --routing --ssr=false --skip-tests` inside the repo root. Configure `angular.json` output path to `dist/client`. Install Taiga UI packages (`@taiga-ui/core`, `@taiga-ui/kit`, `@taiga-ui/icons`, `@taiga-ui/layout`, `@taiga-ui/cdk`, `@taiga-ui/event-plugins`). Setup `TuiRoot` in `app.component.ts`. Configure `app.config.ts` with `provideAnimations()`, `NG_EVENT_PLUGINS`, `provideHttpClient(withInterceptors([...]))`, `provideRouter(routes)`. Add Taiga UI styles to `angular.json`.
- **Where**: `client/` (new directory)
- **Validated by**: Prerequisite for all UI scenarios
- **Estimate**: M

### ICT-7: Frontend — Core auth service and interceptors
- **What**: Create `AuthService` in `client/src/app/core/auth/` — `login()`, `register()`, `logout()`, `currentUser` signal, `isAuthenticated` computed, token management in localStorage. Create `authInterceptor` (attaches Bearer header). Create `errorInterceptor` (handles 401 → redirect to login, other errors → `TuiAlertService`). Create `authGuard` (Angular route guard using `AuthService.isAuthenticated`).
- **Where**: `client/src/app/core/auth/auth.service.ts`, `client/src/app/core/auth/auth.interceptor.ts`, `client/src/app/core/auth/error.interceptor.ts`, `client/src/app/core/auth/auth.guard.ts`
- **Validated by**: Token stored and sent, Unauthenticated user redirected, Expired token triggers re-login, User logs out
- **Estimate**: M

### ICT-8: Frontend — Login page
- **What**: Create `LoginComponent` at route `/login`. Reactive form with email and password fields using Taiga UI inputs. Submit calls `AuthService.login()`. On success, navigate to `/dashboard`. On error, show `TuiAlertService` notification. Link to `/register`.
- **Where**: `client/src/app/features/login/login.component.ts`
- **Validated by**: Successful login, Login with wrong credentials
- **Estimate**: S

### ICT-9: Frontend — Registration page
- **What**: Create `RegisterComponent` at route `/register`. Reactive form with name, email, password, and appKey fields. Submit calls `AuthService.register()`. On success, navigate to `/dashboard`. On error (403, 409), show appropriate notification. Link to `/login`.
- **Where**: `client/src/app/features/register/register.component.ts`
- **Validated by**: Successful registration, Registration rejected with invalid APP_KEY, Registration rejected with duplicate email, Registration form validation
- **Estimate**: S

### ICT-10: Frontend — App shell layout
- **What**: Create `AppShellComponent` with Taiga UI layout — sidebar with navigation links (Dashboard, Logout), header with app title and user info. `<router-outlet>` for child routes. Visible only for authenticated routes.
- **Where**: `client/src/app/layouts/app-shell.component.ts`
- **Validated by**: Visual framework for all authenticated pages
- **Estimate**: S

### ICT-11: Frontend — Dashboard (instance list)
- **What**: Create `DashboardComponent` at route `/dashboard`. Uses `httpResource()` to fetch `GET /api/instances`. Displays instance cards with name, status badge (color-coded: green/red/yellow), phone number, uptime. "Create Instance" button opens a `TuiDialogService` dialog. Empty state with illustration/message when no instances.
- **Where**: `client/src/app/features/dashboard/dashboard.component.ts`
- **Validated by**: Dashboard shows all instances, Empty state
- **Estimate**: M

### ICT-12: Frontend — Create instance dialog
- **What**: Create `CreateInstanceDialogComponent` used via `TuiDialogService`. Form with name (required), webhook URL (optional), webhook headers (optional JSON). On submit, POST to `/api/instances/create`. On success, navigate to `/instances/:name`. On error, show notification.
- **Where**: `client/src/app/features/dashboard/create-instance-dialog.component.ts`
- **Validated by**: Successful instance creation, Instance creation with webhook, Instance creation fails with duplicate name
- **Estimate**: S

### ICT-13: Frontend — Instance detail page with QR polling
- **What**: Create `InstanceDetailComponent` at route `/instances/:name`. On init, fetch status and QR. If QR available, display QR image and poll every 3s using `setInterval` + signal. On status `connected`, stop polling and show connection info. Use `DestroyRef` to clean up interval. Tabs for Status, Send Message, Chats.
- **Where**: `client/src/app/features/instance-detail/instance-detail.component.ts`
- **Validated by**: QR code displayed and polls, QR code transitions to connected, Polling stops on navigation away, Status panel shows connection info
- **Estimate**: M

### ICT-14: Frontend — Send message tab
- **What**: Create `SendMessageComponent` (child of instance detail). Form with phone number and message body (both required). Submit sends POST to `/api/instances/:name/messages` with Meta-format body (`{ messaging_product: "whatsapp", to, type: "text", text: { body } }`). Success/error notifications.
- **Where**: `client/src/app/features/instance-detail/send-message.component.ts`
- **Validated by**: Successful text message send, Send message validation, Send message to disconnected instance
- **Estimate**: S

### ICT-15: Frontend — Chats tab
- **What**: Create `ChatsComponent` (child of instance detail). Fetches `GET /api/instances/:name/chats`. Displays list of chats with contact name/number and last message preview. Empty state if no chats.
- **Where**: `client/src/app/features/instance-detail/chats.component.ts`
- **Validated by**: Chat list loaded, Empty chat list
- **Estimate**: S

### ICT-16: Frontend — Delete instance with confirmation
- **What**: Add delete button to instance detail (and optionally to dashboard cards). On click, open `TuiDialogService` confirm dialog. On confirm, DELETE `/api/instances/:name`. On success, navigate to dashboard and show notification.
- **Where**: `client/src/app/features/instance-detail/instance-detail.component.ts` (or shared confirm component)
- **Validated by**: Successful deletion with confirmation, Deletion cancelled
- **Estimate**: S

### ICT-17: Frontend — Routing configuration
- **What**: Configure `app.routes.ts` with lazy-loaded routes: `/login` (public), `/register` (public), `/dashboard` (guarded), `/instances/:name` (guarded). Default redirect `/` → `/dashboard`. 404 fallback.
- **Where**: `client/src/app/app.routes.ts`
- **Validated by**: Unauthenticated user redirected, all navigation scenarios
- **Estimate**: S

### ICT-18: Build pipeline and Dockerfile update
- **What**: Add npm scripts to root `package.json`: `"build:client": "cd client && npm run build"`, `"build:all": "npm run build && npm run build:client"`. Update `Dockerfile` to install client deps and run `ng build` in the builder stage. Update `docker-compose.yml` to include `APP_KEY` and `JWT_SECRET` env vars.
- **Where**: `package.json`, `Dockerfile`, `docker-compose.yml`
- **Validated by**: App builds and runs as monolith in Docker
- **Estimate**: S

## Open questions

None — all clarifications resolved during specification.

## Dependencies

| Dependency | Status |
|------------|--------|
| Existing InstancesController | Available — needs `/api` prefix |
| Postgres (TypeORM) | Available — add User entity |
| `@nestjs/serve-static` | To install |
| `@nestjs/jwt`, `bcrypt` | To install |
| Angular CLI + Taiga UI | To install under `client/` |
