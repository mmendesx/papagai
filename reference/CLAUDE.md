# CLAUDE.md

> Fonte única de verdade para agentes de IA e desenvolvedores.
> Leia **inteiro** antes de gerar código.

---

## Projeto

| Chave       | Valor                                                         |
|-------------|---------------------------------------------------------------|
| Nome        | `[nome-do-projeto]`                                           |
| Tipo        | SPA — Angular 19 + TypeScript 5.6                             |
| Backend     | Kotlin + Spring Boot (REST, SSE, WebSocket, AI Agents)        |
| UI Kit      | Taiga UI v4 (`@taiga-ui/core`, `@taiga-ui/kit`, addons)      |
| Markdown    | ngx-markdown v19 + Prism.js (syntax highlight)                |
| Pkg manager | npm                                                           |

---

## Estrutura

```
src/app/
├── core/                       # Singletons globais
│   ├── auth/                   # AuthService, authGuard, authInterceptor
│   ├── http/                   # ApiService, errorInterceptor
│   ├── streaming/              # SseService, WebSocketService
│   └── config/                 # app.config.ts, environments
├── features/                   # Módulos de domínio (standalone)
│   └── [feature]/
│       ├── components/
│       ├── services/
│       ├── models/             # interfaces, types, as const
│       ├── store/              # signal store da feature
│       └── [feature].routes.ts
├── shared/                     # Reutilizável entre features
│   ├── components/             # Wrappers Taiga UI customizados, se necessário
│   ├── directives/
│   ├── pipes/
│   └── utils/
├── layouts/                    # Shell: sidebar, header, main content
└── app.routes.ts               # Lazy loading por feature
```

**Fronteiras**: features nunca importam de outras features. Compartilhado → `shared/`. Singleton → `core/`.

---

## Angular 19 — O que usar

### Reatividade: Signals first

| Usar                              | Não usar (legado)                    |
|-----------------------------------|--------------------------------------|
| `signal()`, `computed()`, `effect()` | `BehaviorSubject` para estado local |
| `input()`, `output()`, `model()` | `@Input()`, `@Output()`             |
| `viewChild()`, `viewChildren()`  | `@ViewChild()`, `@ViewChildren()`   |
| `toSignal()`, `toObservable()`   | `async` pipe para dados de signal   |
| `inject()`                       | Constructor injection                |
| Standalone components             | NgModules                            |
| `@if`, `@for`, `@switch`, `@let` | `*ngIf`, `*ngFor`, `[ngSwitch]`     |
| `@defer`                         | Manual lazy no template              |

### Data fetching

| Cenário                    | API                                                   |
|----------------------------|-------------------------------------------------------|
| GET reativo (signal-based) | `httpResource()` — wrapper reativo do HttpClient       |
| GET com RxJS operators     | `rxResource()` — loader retorna Observable             |
| GET com Promise            | `resource()` — loader retorna Promise                  |
| POST, PUT, DELETE          | `HttpClient` direto                                    |
| Stream SSE                 | `EventSource` nativo + signals (ver seção streaming)   |
| Bidirecional real-time     | `WebSocket` nativo + signals (ver seção streaming)     |

### Padrão de componente

```typescript
@Component({
  standalone: true,
  selector: 'app-user-card',
  imports: [TuiButton, TuiAvatar, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (user(); as u) {
      <tui-avatar [src]="u.avatar" />
      <span>{{ displayName() }}</span>
      <button tuiButton (click)="selected.emit(u.id)">Selecionar</button>
    }
  `,
})
export class UserCardComponent {
  user = input.required<User>();
  displayName = computed(() => `${this.user().firstName} ${this.user().lastName}`);
  selected = output<string>();
}
```

---

## Taiga UI — Regras de uso

### Setup obrigatório

`TuiRoot` deve envolver toda a aplicação (provê overlays, dialogs, hints).

```typescript
// app.config.ts
import { provideAnimations } from '@angular/platform-browser/animations';
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    NG_EVENT_PLUGINS,
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideMarkdown(),
  ],
};
```

### Pacotes Taiga UI

| Pacote               | Uso                                                |
|----------------------|----------------------------------------------------|
| `@taiga-ui/cdk`     | Utilitários, diretivas base, tokens de DI          |
| `@taiga-ui/core`    | Fundamentais: button, dialog, hint, loader, notification |
| `@taiga-ui/kit`     | Avançados: inputs, selects, tabs, accordion, badge  |
| `@taiga-ui/icons`   | Ícones                                              |
| `@taiga-ui/layout`  | Layout: header, navigation, card-large              |
| `@taiga-ui/addon-charts`   | Gráficos e data visualization              |
| `@taiga-ui/addon-commerce` | Inputs monetários, cartão de crédito       |
| `@taiga-ui/addon-table`    | Tabelas com sorting/filtering              |

### Convenções Taiga UI

| Regra                                          | Detalhe                                  |
|------------------------------------------------|------------------------------------------|
| Importar individualmente                       | `import { TuiButton } from '@taiga-ui/core'` — nunca o pacote inteiro |
| Theming                                        | CSS custom properties (`--tui-*`)        |
| Dark mode                                      | Built-in via `TuiTheme`                  |
| Dialogs                                        | `TuiDialogService` via `inject()`        |
| Notifications                                  | `TuiAlertService` — nunca toast manual   |
| Forms                                          | Reactive Forms + wrappers Taiga          |
| Ícones                                         | `@taiga-ui/icons` exclusivamente         |

---

## ngx-markdown — Renderização de chat

### Setup

```typescript
// app.config.ts — adicionar nos providers:
provideMarkdown(),
```

```json
// angular.json — styles e scripts para Prism.js
"styles": ["node_modules/prismjs/themes/prism-tomorrow.css"],
"scripts": [
  "node_modules/prismjs/prism.js",
  "node_modules/prismjs/components/prism-typescript.min.js",
  "node_modules/prismjs/components/prism-java.min.js",
  "node_modules/prismjs/components/prism-kotlin.min.js",
  "node_modules/prismjs/components/prism-python.min.js",
  "node_modules/prismjs/components/prism-bash.min.js",
  "node_modules/prismjs/components/prism-json.min.js",
  "node_modules/prismjs/components/prism-sql.min.js"
]
```

### Uso no chatbot

```html
<markdown [data]="message.content" [prismjs]="true"></markdown>
```

Sempre `[data]` binding para conteúdo dinâmico. Nunca inline estático para respostas de chat.

---

## Streaming — Padrões

### SSE (Server-Sent Events)

```typescript
@Injectable({ providedIn: 'root' })
export class SseService {
  private destroyRef = inject(DestroyRef);
  private appRef = inject(ApplicationRef);
  private eventSource?: EventSource;
  private tickScheduled = false;

  readonly status = signal<'idle' | 'connecting' | 'streaming' | 'complete' | 'error'>('idle');
  readonly tokens = signal<string[]>([]);

  connect(url: string): void {
    this.cleanup();
    this.status.set('connecting');
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => this.status.set('streaming');

    this.eventSource.onmessage = ({ data }) => {
      const parsed = JSON.parse(data);
      if (parsed.type === 'done') {
        this.status.set('complete');
        this.cleanup();
        return;
      }
      this.tokens.update(prev => [...prev, parsed.content]);
      this.scheduleTick();
    };

    this.eventSource.onerror = () => {
      this.status.set('error');
      this.cleanup();
    };

    this.destroyRef.onDestroy(() => this.cleanup());
  }

  cleanup(): void {
    this.eventSource?.close();
    this.eventSource = undefined;
  }

  private scheduleTick(): void {
    if (!this.tickScheduled) {
      this.tickScheduled = true;
      queueMicrotask(() => {
        this.appRef.tick();
        this.tickScheduled = false;
      });
    }
  }
}
```

**`ApplicationRef.tick()` manual**: SSE/WebSocket rodam fora do Angular. Signals atualizam estado, mas o DOM só re-renderiza após tick batcheado.

### WebSocket

| Aspecto          | Padrão                                                     |
|------------------|-------------------------------------------------------------|
| Instância        | `private ws?: WebSocket` — nunca em signal                  |
| Heartbeat        | Ping/pong 30s                                               |
| Close            | `ws.close(1000)` via `DestroyRef`                           |
| Reconnect        | Backoff exponencial: 1s→2s→4s→8s→16s, máx 5               |
| Formato          | `{ type, payload, timestamp, correlationId }`               |
| Change detection | Mesmo padrão SSE: batch + `ApplicationRef.tick()`           |

---

## Chatbot — Contrato

| Aspecto           | Definição                                                |
|-------------------|----------------------------------------------------------|
| Modelo mensagem   | `{ id, role, content, timestamp, status, metadata }`     |
| Roles             | `'user' │ 'assistant' │ 'system'`                        |
| Status            | `'sending' │ 'streaming' │ 'complete' │ 'error'`        |
| Fluxo             | Enviar → add otimista → SSE open → append tokens → done → complete |
| Cancelamento      | `EventSource.close()` → status idle                      |
| Histórico         | Paginação cursor-based via `httpResource`                 |
| Retry             | Re-enviar mesma mensagem em caso de falha                 |
| Renderização      | `<markdown [data]="msg.content" [prismjs]="true" />`     |
| Auto-scroll       | Scroll on new. Pausar se usuário scrollou para cima.      |

---

## Integração backend (Spring Boot)

| Tipo       | Endpoint                       | Consumer                      |
|------------|--------------------------------|-------------------------------|
| REST       | `GET/POST/PUT/DELETE /api/v1/*`| `httpResource` / `HttpClient` |
| SSE        | `GET /api/v1/chat/stream`      | `SseService`                  |
| WebSocket  | `ws://host/ws/[channel]`       | `WebSocketService`            |
| Health     | `GET /actuator/health`         | Check na inicialização        |

### SSE event shape

```
event: message
data: {"type":"token","content":"Hello"}

event: message
data: {"type":"done","metadata":{"tokens_used":150,"model":"..."}}

event: error
data: {"type":"error","code":"RATE_LIMITED","message":"..."}
```

### WebSocket message shape

```json
{ "type": "chat.message | presence.update | notification | ping",
  "payload": {},
  "timestamp": "ISO-8601",
  "correlationId": "uuid" }
```

---

## Convenções

### TypeScript

| Regra             | Detalhe                                              |
|-------------------|------------------------------------------------------|
| Strict mode       | `strict: true`. Zero `any`. `unknown` + guards.      |
| Objetos           | `interface`. Unions → `type`.                        |
| Return types      | Explícito em exports.                                |
| Enums             | `as const` satisfies. Sem TS enums.                  |
| Null handling      | `strictNullChecks`. Sem `!` assertion.               |

### Nomenclatura

| Entidade         | Padrão               | Exemplo                       |
|------------------|-----------------------|-------------------------------|
| Component        | `PascalCase`          | `ChatWindowComponent`         |
| Service          | `PascalCase + Service`| `ChatStreamService`           |
| Interface/Type   | `PascalCase`          | `ChatMessage`, `StreamEvent`  |
| Constante        | `UPPER_SNAKE_CASE`    | `MAX_RECONNECT_ATTEMPTS`      |
| Arquivo          | `kebab-case`          | `chat-window.component.ts`    |
| Rotas            | `[feature].routes.ts` | `chat.routes.ts`              |

### Limites

| Alvo         | Máx linhas | Ação                                  |
|--------------|----------:|----------------------------------------|
| Component    | 200       | Extrair subcomponents                  |
| Service      | 150       | Dividir por responsabilidade           |
| Template     | 80        | Extrair componentes filhos             |

---

## Testes

| Aspecto      | Ferramenta / Regra                        |
|--------------|-------------------------------------------|
| Framework    | Karma + Jasmine                           |
| Estratégia   | Testar comportamento, não implementação   |
| HTTP mock    | `provideHttpClientTesting()`              |
| SSE/WS       | Mock manual do `EventSource`/`WebSocket`  |
| Cobertura    | Features: 80%. Core/shared: 90%.         |

---

## Tratamento de erros

| Camada       | Estratégia                                |
|--------------|-------------------------------------------|
| API          | `errorInterceptor` → `TuiAlertService`   |
| Streams      | Reconnect + `TuiAlertService` para transientes |
| Forms        | Reactive Forms validators + Taiga inline errors |
| Boundaries   | `@defer` com `@error` block + fallback UI |

---

## Dependências aprovadas

| Categoria     | Pacote                                              |
|---------------|-----------------------------------------------------|
| Core          | @angular/core, @angular/common, @angular/router     |
| HTTP          | @angular/common/http                                |
| Forms         | @angular/forms                                      |
| UI Kit        | @taiga-ui/cdk, @taiga-ui/core, @taiga-ui/kit, @taiga-ui/icons, @taiga-ui/layout |
| UI Addons     | @taiga-ui/addon-charts, @taiga-ui/addon-table (conforme necessidade) |
| Events        | @taiga-ui/event-plugins (obrigatório para Taiga UI) |
| Markdown      | ngx-markdown, prismjs                               |
| Validação     | zod                                                 |
| RxJS interop  | @angular/core/rxjs-interop                          |
| Date          | date-fns                                            |
| Animations    | @angular/animations                                 |
| Testes        | karma, jasmine                                      |

Fora desta lista → aprovação do time.

---

## Git

| Aspecto    | Regra                                              |
|------------|---------------------------------------------------|
| Branches   | `feature/`, `fix/`, `chore/`, `refactor/`         |
| Commits    | Conventional: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:` |
| PR size    | < 400 linhas                                       |

---

## Regras invioláveis

1. Sem cross-feature imports.
2. Sem `any` — `unknown` + type guards.
3. Sem `*ngIf`/`*ngFor` — usar `@if`/`@for`/`@switch`.
4. Sem `@Input()`/`@Output()` — usar `input()`, `output()`, `model()`.
5. Sem constructor injection — usar `inject()`.
6. Sem NgModules — tudo standalone.
7. Sem estado derivado em signal mutável — usar `computed()`.
8. Sem URLs hardcoded — environment variables.
9. Sem `.env`, keys ou tokens no git.
10. Sem conexões vazando — SSE `close()` + WS `close(1000)` em `DestroyRef`.
11. Sem loading/error states faltando.
12. Sem `console.log` em produção.
13. Sem misturar UI kits — Taiga UI é o único.
14. Sem modal/toast manual — `TuiDialogService` e `TuiAlertService`.