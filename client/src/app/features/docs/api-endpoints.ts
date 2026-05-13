export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface ParamDef {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface PathParamDef {
  name: string;
  placeholder: string;
  description: string;
}

export interface ErrorDef {
  status: number;
  description: string;
}

export type EndpointAuthType = 'none' | 'bearer' | 'apiKey' | 'bearer_or_apiKey';

export interface BodyExampleDef {
  title: string;
  json: string;
}

export interface EndpointDef {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  auth: EndpointAuthType;
  pathParams?: PathParamDef[];
  queryParams?: ParamDef[];
  bodyParams?: ParamDef[];
  responseExample: string;
  errorCodes: ErrorDef[];
  curlExample: string;
  bodyExamples?: BodyExampleDef[];
  tryItDisabledReason?: string;
  tryBody?: string;
  tryQuery?: string;
}

export interface EndpointGroup {
  id: string;
  title: string;
  description?: string;
  endpoints: EndpointDef[];
}

export interface WebhookEventRef {
  key: string;
  description: string;
}

export const WEBHOOK_EVENTS: WebhookEventRef[] = [
  { key: 'message', description: 'Mensagem recebida de um contato (texto, mídia, etc.).' },
  { key: 'message_update', description: 'Confirmações de entrega ou leitura e atualizações de status.' },
  { key: 'qr', description: 'QR code atualizado ou renovado para pareamento.' },
  { key: 'connected', description: 'Instância conectada com sucesso ao WhatsApp.' },
  { key: 'disconnected', description: 'Conexão perdida; o payload pode conter dicas de reconexão.' },
];

export const WEBHOOK_PAYLOAD_EXAMPLES: { event: string; json: string }[] = [
  {
    event: 'message',
    json: `{
  "event": "message",
  "instance": "minha-instancia",
  "data": { "...": "payload normalizado da mensagem via Baileys" }
}`,
  },
  {
    event: 'connected',
    json: `{
  "event": "connected",
  "instance": "minha-instancia",
  "data": { "phoneNumber": "5511999999999" }
}`,
  },
];

const SEND_MESSAGE_BODY_EXAMPLES: BodyExampleDef[] = [
  {
    title: 'text',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "text",
  "text": { "body": "Hello from Papagai!" }
}`,
  },
  {
    title: 'image by URL',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "image",
  "image": {
    "link": "https://example.com/photo.jpg",
    "caption": "Photo by URL"
  }
}`,
  },
  {
    title: 'image base64',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "image",
  "image": {
    "data": "<base64-jpeg>",
    "mimetype": "image/jpeg",
    "caption": "Inline photo"
  }
}`,
  },
  {
    title: 'audio URL and voice note',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "audio",
  "audio": {
    "link": "https://example.com/audio.ogg",
    "ptt": true
  }
}`,
  },
  {
    title: 'audio base64',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "audio",
  "audio": {
    "data": "<base64-ogg>",
    "mimetype": "audio/ogg",
    "ptt": false
  }
}`,
  },
  {
    title: 'video URL',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "video",
  "video": {
    "link": "https://example.com/video.mp4",
    "caption": "Video by URL"
  }
}`,
  },
  {
    title: 'video base64',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "video",
  "video": {
    "data": "<base64-mp4>",
    "mimetype": "video/mp4",
    "caption": "Inline video"
  }
}`,
  },
  {
    title: 'document URL',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "document",
  "document": {
    "link": "https://example.com/report.pdf",
    "filename": "report.pdf",
    "caption": "Monthly report"
  }
}`,
  },
  {
    title: 'document base64',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "document",
  "document": {
    "data": "<base64-pdf>",
    "mimetype": "application/pdf",
    "filename": "report.pdf"
  }
}`,
  },
  {
    title: 'sticker URL',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "sticker",
  "sticker": { "link": "https://example.com/sticker.webp" }
}`,
  },
  {
    title: 'sticker base64',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "sticker",
  "sticker": {
    "data": "<base64-webp>",
    "mimetype": "image/webp"
  }
}`,
  },
  {
    title: 'location',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "location",
  "location": {
    "latitude": -23.5505,
    "longitude": -46.6333,
    "name": "Sao Paulo"
  }
}`,
  },
  {
    title: 'reaction',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "reaction",
  "reaction": {
    "message_id": "BAE5...",
    "emoji": "👍"
  }
}`,
  },
  {
    title: 'interactive buttons',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Choose an option" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "yes", "title": "Yes" } },
        { "type": "reply", "reply": { "id": "no", "title": "No" } }
      ]
    }
  }
}`,
  },
  {
    title: 'contacts',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "contacts",
  "contacts": [
    {
      "name": { "formatted_name": "Support Bot" },
      "phones": [{ "phone": "5511888888888", "type": "WORK" }]
    }
  ]
}`,
  },
];

export const API_ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    id: 'auth',
    title: 'Autenticação',
    description: 'Obtenha e valide tokens de acesso JWT.',
    endpoints: [
      {
        id: 'auth-register',
        method: 'POST',
        path: '/api/auth/register',
        title: 'Registrar',
        description:
          'Cria um novo usuário quando o registro está habilitado e APP_KEY confere. Retorna um JWT para uso imediato.',
        auth: 'none',
        bodyParams: [
          { name: 'name', type: 'string', required: true, description: 'Nome de exibição (1–255 caracteres).' },
          { name: 'email', type: 'string', required: true, description: 'Endereço de e-mail único.' },
          { name: 'password', type: 'string', required: true, description: 'Senha (8–128 caracteres).' },
          { name: 'appKey', type: 'string', required: true, description: 'Deve corresponder ao APP_KEY do servidor quando o registro está habilitado.' },
        ],
        responseExample: `{
  "user": { "id": "…", "name": "…", "email": "…" },
  "accessToken": "eyJhbGciOiJIUzI1NiIs…"
}`,
        errorCodes: [
          { status: 403, description: 'Registro desabilitado ou chave de aplicação inválida.' },
          { status: 409, description: 'E-mail já cadastrado.' },
          { status: 400, description: 'Falha de validação.' },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/auth/register" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Dev","email":"dev@example.com","password":"suasenha","appKey":"SUA_APP_KEY"}'`,
        tryBody: '{\n  "name": "Dev",\n  "email": "dev@example.com",\n  "password": "suasenha",\n  "appKey": "SUA_APP_KEY"\n}',
      },
      {
        id: 'auth-login',
        method: 'POST',
        path: '/api/auth/login',
        title: 'Login',
        description: 'Troca e-mail e senha por um JWT. Expiração padrão de 24 horas.',
        auth: 'none',
        bodyParams: [
          { name: 'email', type: 'string', required: true, description: 'E-mail cadastrado.' },
          { name: 'password', type: 'string', required: true, description: 'Senha da conta.' },
        ],
        responseExample: `{
  "user": { "id": "…", "name": "…", "email": "…" },
  "accessToken": "eyJhbGciOiJIUzI1NiIs…"
}`,
        errorCodes: [
          { status: 401, description: 'E-mail ou senha inválidos.' },
          { status: 400, description: 'Falha de validação.' },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"voce@example.com","password":"suasenha"}'`,
        tryBody: '{\n  "email": "voce@example.com",\n  "password": "suasenha"\n}',
      },
      {
        id: 'auth-me',
        method: 'GET',
        path: '/api/auth/me',
        title: 'Usuário atual',
        description: 'Retorna o usuário autenticado a partir de Authorization: Bearer ou X-Api-Key.',
        auth: 'bearer_or_apiKey',
        responseExample: `{
  "id": "uuid",
  "name": "Dev",
  "email": "dev@example.com"
}`,
        errorCodes: [
          { status: 401, description: 'Token ausente ou inválido.' },
        ],
        curlExample: `# Authorization: Bearer
curl -sS "$BASE/api/auth/me" \\
  -H "Authorization: Bearer $TOKEN"

# X-Api-Key
curl -sS "$BASE/api/auth/me" \\
  -H "X-Api-Key: $API_KEY"`,
      },
      {
        id: 'auth-apikeys-create',
        method: 'POST',
        path: '/api/auth/apikeys',
        title: 'Criar API key de conta',
        description:
          'Cria uma API key no escopo da conta. Salve o campo key no momento da criação: ele não é retornado novamente. Use permissionsTemplate com read_only, operator, instance_manager ou account_admin; ou permissions explícitas (nunca os dois juntos).',
        auth: 'bearer_or_apiKey',
        bodyParams: [
          { name: 'name', type: 'string', required: true, description: 'Nome legível da chave (1-255 caracteres).' },
          { name: 'expiresAt', type: 'string (ISO 8601)', required: false, description: 'Data de expiração opcional. Omitido = sem expiração.' },
          { name: 'permissionsTemplate', type: '"read_only" | "operator" | "instance_manager" | "account_admin"', required: false, description: 'Template padrão de permissões para chave de conta. Exclusivo com permissions.' },
          { name: 'permissions', type: 'string[]', required: false, description: 'Permissões explícitas para chave de conta. Exclusivo com permissionsTemplate.' },
        ],
        responseExample: `{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Integração CRM",
  "prefix": "ppg_acct_7xKqR3mNpL9v",
  "key": "ppg_acct_7xKqR3mNpL9vBsYtFgHjWcEu",
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "enabled": true,
  "createdAt": "2026-04-10T08:30:00.000Z",
  "permissions": [
    "auth:me:read",
    "instances:list",
    "instances:status:read",
    "instances:contacts:read",
    "instances:chats:read",
    "instances:chats:write",
    "instances:messages:send",
    "instances:webhook:write",
    "instances:metrics:read",
    "instances:events:read"
  ]
}`,
        errorCodes: [
          { status: 400, description: 'Requisição inválida (por exemplo: permissions e permissionsTemplate enviados juntos).' },
          { status: 401, description: 'Não autorizado.' },
        ],
        curlExample: `# Authorization: Bearer
curl -sS -X POST "$BASE/api/auth/apikeys" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Integração CRM","permissionsTemplate":"operator"}'

# X-Api-Key (use uma chave com auth:apikeys:manage, como account_admin)
curl -sS -X POST "$BASE/api/auth/apikeys" \\
  -H "X-Api-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Integração CRM","permissionsTemplate":"operator"}'`,
        tryBody: '{\n  "name": "Integração CRM",\n  "permissionsTemplate": "operator"\n}',
      },
      {
        id: 'auth-apikeys-list',
        method: 'GET',
        path: '/api/auth/apikeys',
        title: 'Listar API keys de conta',
        description: 'Lista API keys de conta sem retornar o valor plaintext da key. O campo permissions omitido/null indica acesso total no escopo da conta.',
        auth: 'bearer_or_apiKey',
        responseExample: `[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Integração CRM",
    "prefix": "ppg_acct_7xKqR3mNpL9v",
    "expiresAt": "2027-01-01T00:00:00.000Z",
    "enabled": true,
    "createdAt": "2026-04-10T08:30:00.000Z",
    "lastUsedAt": "2026-04-10T09:00:00.000Z",
    "permissions": ["instances:list", "instances:status:read"]
  },
  {
    "id": "f9e8d7c6-b5a4-3210-fedc-ba9876543210",
    "name": "Admin interno",
    "prefix": "ppg_acct_1kLmNoPqR2s",
    "enabled": true,
    "createdAt": "2026-04-01T12:00:00.000Z"
  }
]`,
        errorCodes: [
          { status: 401, description: 'Não autorizado.' },
        ],
        curlExample: `# Authorization: Bearer
curl -sS "$BASE/api/auth/apikeys" \\
  -H "Authorization: Bearer $TOKEN"

# X-Api-Key
curl -sS "$BASE/api/auth/apikeys" \\
  -H "X-Api-Key: $API_KEY"`,
      },
      {
        id: 'auth-apikeys-delete',
        method: 'DELETE',
        path: '/api/auth/apikeys/:id',
        title: 'Revogar API key de conta',
        description: 'Revoga uma API key de conta pelo identificador.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'id', placeholder: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'ID da API key.' }],
        responseExample: `{
  "status": 204,
  "body": null
}`,
        errorCodes: [
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'API key não encontrada.' },
        ],
        curlExample: `# Authorization: Bearer
curl -sS -X DELETE "$BASE/api/auth/apikeys/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \\
  -H "Authorization: Bearer $TOKEN"

# X-Api-Key
curl -sS -X DELETE "$BASE/api/auth/apikeys/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \\
  -H "X-Api-Key: $API_KEY"`,
      },
      {
        id: 'auth-apikeys-templates',
        method: 'GET',
        path: '/api/auth/apikeys/templates',
        title: 'Listar templates de permissões',
        description: 'Retorna templates padrão de permissões para criação de API keys de conta. IDs disponíveis: read_only, operator, instance_manager e account_admin.',
        auth: 'bearer_or_apiKey',
        responseExample: `{
  "templates": [
    {
      "id": "read_only",
      "name": "Read-only",
      "description": "Can read profile, instances, status, contacts, chats, metrics, and events.",
      "permissions": [
        "auth:me:read",
        "instances:list",
        "instances:status:read",
        "instances:contacts:read",
        "instances:chats:read",
        "instances:metrics:read",
        "instances:events:read"
      ]
    },
    {
      "id": "operator",
      "name": "Operator",
      "description": "Read-only plus send messages, mark chats as read, and update webhooks.",
      "permissions": [
        "auth:me:read",
        "instances:list",
        "instances:status:read",
        "instances:contacts:read",
        "instances:chats:read",
        "instances:metrics:read",
        "instances:events:read",
        "instances:chats:write",
        "instances:messages:send",
        "instances:webhook:write"
      ]
    },
    {
      "id": "instance_manager",
      "name": "Instance manager",
      "description": "Operator plus create/delete instances and manage instance-scoped keys.",
      "permissions": [
        "auth:me:read",
        "instances:list",
        "instances:status:read",
        "instances:contacts:read",
        "instances:chats:read",
        "instances:metrics:read",
        "instances:events:read",
        "instances:chats:write",
        "instances:messages:send",
        "instances:webhook:write",
        "instances:create",
        "instances:delete",
        "instances:apikeys:manage"
      ]
    },
    {
      "id": "account_admin",
      "name": "Account admin",
      "description": "Instance manager plus manage account-scoped API keys.",
      "permissions": [
        "auth:me:read",
        "instances:list",
        "instances:status:read",
        "instances:contacts:read",
        "instances:chats:read",
        "instances:metrics:read",
        "instances:events:read",
        "instances:chats:write",
        "instances:messages:send",
        "instances:webhook:write",
        "instances:create",
        "instances:delete",
        "instances:apikeys:manage",
        "auth:apikeys:manage"
      ]
    }
  ]
}`,
        errorCodes: [
          { status: 401, description: 'Não autorizado.' },
        ],
        curlExample: `# Authorization: Bearer
curl -sS "$BASE/api/auth/apikeys/templates" \\
  -H "Authorization: Bearer $TOKEN"

# X-Api-Key
curl -sS "$BASE/api/auth/apikeys/templates" \\
  -H "X-Api-Key: $API_KEY"`,
      },
    ],
  },
  {
    id: 'instances',
    title: 'Instâncias',
    description: 'Crie e gerencie instâncias do WhatsApp. Todas as rotas aceitam Authorization: Bearer ou X-Api-Key.',
    endpoints: [
      {
        id: 'instances-create',
        method: 'POST',
        path: '/api/instances/create',
        title: 'Criar instância',
        description:
          'Inicia uma nova instância com nome definido. URL de webhook, cabeçalhos, flag de habilitação e lista de eventos são opcionais. Sem URL, os webhooks ficam desabilitados.',
        auth: 'bearer_or_apiKey',
        bodyParams: [
          { name: 'name', type: 'string', required: true, description: 'Nome da instância (3–30 caracteres).' },
          { name: 'webhook', type: 'string', required: false, description: 'URL do webhook (opcional).' },
          { name: 'webhookHeaders', type: 'object', required: false, description: 'Mapa de cabeçalhos HTTP enviados junto ao webhook.' },
          { name: 'webhookEnabled', type: 'boolean', required: false, description: 'Relevante apenas quando a URL do webhook está definida.' },
          { name: 'webhookEvents', type: 'string[]', required: false, description: 'Subconjunto de: message, message_update, qr, connected, disconnected.' },
        ],
        responseExample: `{
  "success": true,
  "instance": "meu-papagai",
  "message": "🦜 Papagai meu-papagai criado com sucesso! …"
}`,
        errorCodes: [
          { status: 400, description: 'Nome duplicado, erro de validação ou erro do servidor.' },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/instances/create" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"meu-papagai","webhook":"https://example.com/hook"}'`,
        tryBody: '{\n  "name": "meu-papagai",\n  "webhook": "https://example.com/hook"\n}',
      },
      {
        id: 'instances-list',
        method: 'GET',
        path: '/api/instances',
        title: 'Listar instâncias',
        description: 'Lista todas as instâncias com estado de conexão, início de uptime, webhookEnabled e configuração de webhook aninhada.',
        auth: 'bearer_or_apiKey',
        responseExample: `{
  "total": 1,
  "instances": [
    {
      "name": "meu-papagai",
      "connected": true,
      "startTime": 1710000000000,
      "webhookEnabled": true,
      "webhook": {
        "url": "https://example.com/hook",
        "headers": {},
        "enabled": true,
        "events": ["message", "message_update", "qr", "connected", "disconnected"]
      }
    }
  ],
  "message": "🦜 Você tem 1 papagai"
}`,
        errorCodes: [{ status: 401, description: 'Não autorizado.' }],
        curlExample: `curl -sS "$BASE/api/instances" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'instances-status',
        method: 'GET',
        path: '/api/instances/:name/status',
        title: 'Status da instância',
        description: 'Status em tempo real incluindo espelho da configuração de webhook.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        responseExample: `{
  "name": "meu-papagai",
  "connected": true,
  "startTime": "2025-01-01T12:00:00.000Z",
  "uptime": 3600000,
  "phoneNumber": "5511999999999",
  "webhook": {
    "url": "https://example.com/hook",
    "headers": {},
    "enabled": true,
    "events": ["message", "qr"]
  }
}`,
        errorCodes: [
          { status: 404, description: 'Instância não encontrada.' },
          { status: 401, description: 'Não autorizado.' },
        ],
        curlExample: `curl -sS "$BASE/api/instances/meu-papagai/status" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'instances-metrics',
        method: 'GET',
        path: '/api/instances/:name/metrics',
        title: 'Métricas da instância',
        description: 'Retorna contadores em memória para mensagens enviadas, recebidas, conversas ativas e status do webhook.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        responseExample: `{
  "instance": "meu-papagai",
  "metrics": {
    "messagesSent": 10,
    "messagesReceived": 25,
    "activeConversations": 5,
    "webhookEnabled": true
  }
}`,
        errorCodes: [
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'Instância não encontrada.' },
        ],
        curlExample: `curl -sS "$BASE/api/instances/meu-papagai/metrics" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'instances-qr',
        method: 'GET',
        path: '/api/instances/:name/qr',
        title: 'QR / estado de conexão',
        description: 'Endpoint de polling para dados de imagem QR, estado conectando ou conectado.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        responseExample: `{
  "status": "qr",
  "instance": "meu-papagai",
  "qr": "…",
  "qrImageData": "data:image/png;base64,…",
  "message": "🦜 Escaneie o QR code…"
}`,
        errorCodes: [{ status: 404, description: 'Instância não encontrada.' }],
        curlExample: `curl -sS "$BASE/api/instances/meu-papagai/qr" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'instances-delete',
        method: 'DELETE',
        path: '/api/instances/:name',
        title: 'Desconectar / remover instância',
        description: 'Encerra a sessão e remove a instância do registro do servidor.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        responseExample: `{
  "message": "🦜 Papagai meu-papagai foi dormir. Até logo!",
  "instance": "meu-papagai"
}`,
        errorCodes: [{ status: 404, description: 'Instância não encontrada.' }],
        curlExample: `curl -sS -X DELETE "$BASE/api/instances/meu-papagai" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'instances-apikeys-create',
        method: 'POST',
        path: '/api/instances/:name/apikeys',
        title: 'Criar API key da instância',
        description: 'Cria uma API key com escopo restrito à instância. O valor key só é retornado na criação. Chaves de instância não aceitam permissions nem permissionsTemplate.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        bodyParams: [
          { name: 'name', type: 'string', required: true, description: 'Nome legível da chave (1-255 caracteres).' },
          { name: 'expiresAt', type: 'string (ISO 8601)', required: false, description: 'Data de expiração opcional. Omitido = sem expiração.' },
        ],
        responseExample: `{
  "id": "9b1deb4d-3b7d-4f7f-8f5f-0c9d99c01111",
  "name": "Automação instância A",
  "prefix": "ppg_inst_3aBcDeFgHiJk",
  "key": "ppg_inst_3aBcDeFgHiJkLmNoPqRsTuV",
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "enabled": true,
  "createdAt": "2026-04-10T10:15:00.000Z"
}`,
        errorCodes: [
          { status: 400, description: 'Requisição inválida (ex.: envio de permissions ou permissionsTemplate).' },
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'Instância não encontrada.' },
        ],
        curlExample: `# Authorization: Bearer
curl -sS -X POST "$BASE/api/instances/meu-papagai/apikeys" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Automação instância A","expiresAt":"2027-01-01T00:00:00Z"}'

# X-Api-Key
curl -sS -X POST "$BASE/api/instances/meu-papagai/apikeys" \\
  -H "X-Api-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Automação instância A","expiresAt":"2027-01-01T00:00:00Z"}'`,
        tryBody: '{\n  "name": "Automação instância A",\n  "expiresAt": "2027-01-01T00:00:00Z"\n}',
      },
      {
        id: 'instances-apikeys-list',
        method: 'GET',
        path: '/api/instances/:name/apikeys',
        title: 'Listar API keys da instância',
        description: 'Lista API keys vinculadas à instância sem retornar plaintext da key.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        responseExample: `[
  {
    "id": "9b1deb4d-3b7d-4f7f-8f5f-0c9d99c01111",
    "name": "Automação instância A",
    "prefix": "ppg_inst_3aBcDeFgHiJk",
    "expiresAt": "2027-01-01T00:00:00.000Z",
    "enabled": true,
    "createdAt": "2026-04-10T10:15:00.000Z",
    "lastUsedAt": "2026-04-10T11:00:00.000Z"
  }
]`,
        errorCodes: [
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'Instância não encontrada.' },
        ],
        curlExample: `# Authorization: Bearer
curl -sS "$BASE/api/instances/meu-papagai/apikeys" \\
  -H "Authorization: Bearer $TOKEN"

# X-Api-Key
curl -sS "$BASE/api/instances/meu-papagai/apikeys" \\
  -H "X-Api-Key: $API_KEY"`,
      },
      {
        id: 'instances-apikeys-delete',
        method: 'DELETE',
        path: '/api/instances/:name/apikeys/:id',
        title: 'Revogar API key da instância',
        description: 'Revoga uma API key de instância pelo identificador.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          { name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' },
          { name: 'id', placeholder: '9b1deb4d-3b7d-4f7f-8f5f-0c9d99c01111', description: 'ID da API key.' },
        ],
        responseExample: `{
  "status": 204,
  "body": null
}`,
        errorCodes: [
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'API key não encontrada.' },
        ],
        curlExample: `# Authorization: Bearer
curl -sS -X DELETE "$BASE/api/instances/meu-papagai/apikeys/9b1deb4d-3b7d-4f7f-8f5f-0c9d99c01111" \\
  -H "Authorization: Bearer $TOKEN"

# X-Api-Key
curl -sS -X DELETE "$BASE/api/instances/meu-papagai/apikeys/9b1deb4d-3b7d-4f7f-8f5f-0c9d99c01111" \\
  -H "X-Api-Key: $API_KEY"`,
      },
    ],
  },
  {
    id: 'messages',
    title: 'Mensagens',
    description: 'Envie mensagens WhatsApp no formato compatível com a API Meta.',
    endpoints: [
      {
        id: 'messages-send',
        method: 'POST',
        path: '/api/instances/:name/messages',
        title: 'Enviar mensagem',
        description:
          'Envia uma mensagem pela instância indicada. O body segue o estilo da Meta Cloud API (type + payload). Mídias aceitam link HTTPS ou data base64 com mimetype; quando data e link existem, data é usada.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        bodyParams: [
          { name: 'to', type: 'string', required: true, description: 'JID ou número do destinatário aceito pelo gateway.' },
          { name: 'type', type: 'string', required: true, description: 'Ex.: text, image, audio, video, document, sticker, location, contacts, reaction, interactive.' },
          { name: 'text', type: 'object', required: false, description: 'Para type text: { body: string }' },
          { name: 'image | video', type: 'object', required: false, description: '{ link } ou { data, mimetype }, com caption opcional.' },
          { name: 'audio', type: 'object', required: false, description: '{ link } ou { data, mimetype }, com ptt opcional para voice note.' },
          { name: 'document', type: 'object', required: false, description: '{ link } ou { data, mimetype }, com filename e caption opcionais.' },
          { name: 'sticker', type: 'object', required: false, description: '{ link } ou { data, mimetype } para sticker WebP.' },
          { name: 'location', type: 'object', required: false, description: '{ latitude, longitude, name? }.' },
          { name: 'reaction', type: 'object', required: false, description: '{ message_id, emoji }.' },
          { name: 'interactive', type: 'object', required: false, description: 'Payload interativo compatível com botões/listas.' },
          { name: 'contacts', type: 'object[]', required: false, description: 'Lista de contatos no formato Meta.' },
        ],
        responseExample: `{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "5511999999999", "wa_id": "5511999999999" }],
  "messages": [{ "id": "…" }]
}`,
        errorCodes: [
          { status: 400, description: 'Falha no envio, instância inválida ou erro do WhatsApp.' },
          { status: 401, description: 'Não autorizado.' },
          { status: 422, description: 'Falha de validação, como mídia sem link/data ou base64 inválido.' },
        ],
        curlExample: `# Text
curl -sS -X POST "$BASE/api/instances/meu-papagai/messages" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"5511999999999@s.whatsapp.net","type":"text","text":{"body":"Olá!"}}'

# Base64 image
curl -sS -X POST "$BASE/api/instances/meu-papagai/messages" \\
  -H "X-Api-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"5511999999999@s.whatsapp.net","type":"image","image":{"data":"<base64-jpeg>","mimetype":"image/jpeg","caption":"Inline photo"}}'

# URL document
curl -sS -X POST "$BASE/api/instances/meu-papagai/messages" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"5511999999999@s.whatsapp.net","type":"document","document":{"link":"https://example.com/report.pdf","filename":"report.pdf"}}'`,
        bodyExamples: SEND_MESSAGE_BODY_EXAMPLES,
        tryBody: '{\n  "to": "5511999999999@s.whatsapp.net",\n  "type": "text",\n  "text": { "body": "Olá da API!" }\n}',
      },
      {
        id: 'messages-upload',
        method: 'POST',
        path: '/api/instances/:name/upload',
        title: 'Upload de mídia',
        description:
          'Recebe multipart/form-data com campo file e retorna uma URL assinada para uso posterior em payloads de mídia por link. O composer do painel usa base64 inline; este endpoint é para integrações externas.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        bodyParams: [
          { name: 'file', type: 'binary', required: true, description: 'Arquivo de até 16 MB. Tipos aceitos: JPEG, PNG, WebP, GIF, MP4, OGG, MPEG e AAC.' },
        ],
        responseExample: `{
  "url": "http://localhost:3000/uploads/meu-papagai/7d9f-file.jpg?token=..."
}`,
        errorCodes: [
          { status: 400, description: 'Arquivo ausente ou tipo não permitido.' },
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'Instância não encontrada.' },
          { status: 413, description: 'Arquivo maior que 16 MB.' },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/instances/meu-papagai/upload" \\
  -H "Authorization: Bearer $TOKEN" \\
  -F "file=@./photo.jpg"`,
        tryItDisabledReason: 'Upload multipart/form-data não é executado pelo Try It. Use o curl manual acima.',
      },
    ],
  },
  {
    id: 'contacts',
    title: 'Contatos e conversas',
    description: 'Leia contatos e metadados de conversas de uma instância conectada.',
    endpoints: [
      {
        id: 'contact-info',
        method: 'GET',
        path: '/api/instances/:name/contact/:number',
        title: 'Dados do contato',
        description: 'Busca metadados de contato para um número na instância indicada.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          { name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' },
          { name: 'number', placeholder: '5511999999999', description: 'Número de telefone ou fragmento JID.' },
        ],
        responseExample: `{
  "phoneNumber": "5511999999999",
  "pushName": "Nome do Contato"
}`,
        errorCodes: [{ status: 400, description: 'Falha na busca.' }],
        curlExample: `curl -sS "$BASE/api/instances/meu-papagai/contact/5511999999999" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'chats-list',
        method: 'GET',
        path: '/api/instances/:name/chats',
        tryQuery: 'include_messages=false',
        title: 'Listar conversas',
        description: 'Retorna as conversas da instância. Use include_messages=true para incluir mensagens recentes.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        queryParams: [
          { name: 'include_messages', type: 'string', required: false, description: 'Use o valor "true" para incluir mensagens.' },
        ],
        responseExample: `{
  "instance": "meu-papagai",
  "total": 3,
  "chats": []
}`,
        errorCodes: [{ status: 400, description: 'Falha ao carregar conversas.' }],
        curlExample: `curl -sS "$BASE/api/instances/meu-papagai/chats?include_messages=false" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'chat-messages',
        method: 'GET',
        path: '/api/instances/:name/chats/:chatId/messages',
        tryQuery: 'limit=100',
        title: 'Listar mensagens da conversa',
        description: 'Retorna o histórico recente de uma conversa. chatId aceita número puro ou JID completo; limit é limitado entre 1 e 500.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          { name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' },
          { name: 'chatId', placeholder: '5511999999999', description: 'Número puro ou JID completo da conversa.' },
        ],
        queryParams: [
          { name: 'limit', type: 'number', required: false, description: 'Quantidade de mensagens (1-500, padrão 100).' },
        ],
        responseExample: `{
  "instance": "meu-papagai",
  "chatId": "5511999999999@s.whatsapp.net",
  "total": 1,
  "messages": [
    {
      "id": "msg-1",
      "fromMe": false,
      "timestamp": 1710000000000,
      "type": "text",
      "body": "Hello"
    }
  ]
}`,
        errorCodes: [
          { status: 400, description: 'chatId inválido ou falha ao carregar mensagens.' },
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'Instância não encontrada.' },
        ],
        curlExample: `curl -sS "$BASE/api/instances/meu-papagai/chats/5511999999999/messages?limit=100" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'chat-read',
        method: 'POST',
        path: '/api/instances/:name/chats/:chatId/read',
        title: 'Marcar conversa como lida',
        description: 'Zera o contador de não lidas para a conversa informada.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          { name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' },
          { name: 'chatId', placeholder: '5511999999999', description: 'Número puro ou JID completo da conversa.' },
        ],
        responseExample: `{
  "ok": true
}`,
        errorCodes: [
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'Instância não encontrada.' },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/instances/meu-papagai/chats/5511999999999/read" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'instance-events',
        method: 'GET',
        path: '/api/instances/:name/events',
        title: 'Stream de eventos da instância',
        description:
          'Abre um stream SSE com eventos chat_updated, chat_read, history_synced e heartbeat a cada 25 segundos. Mantenha a conexão aberta e reconecte em falhas de rede.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        responseExample: `event: chat_updated
data: {
  "type": "chat_updated",
  "chatId": "5511999999999@s.whatsapp.net",
  "timestamp": 1710000000000,
  "source": "incoming",
  "chat": { "...": "ChatSummary" },
  "message": { "...": "StoredMessage" }
}

event: heartbeat
data: { "type": "heartbeat", "timestamp": 1710000025000 }`,
        errorCodes: [
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'Instância não encontrada.' },
        ],
        curlExample: `curl -N "$BASE/api/instances/meu-papagai/events" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Accept: text/event-stream"`,
        tryItDisabledReason: 'Streams SSE ficam abertos continuamente. Use curl -N ou EventSource/fetch-event-source no cliente.',
      },
    ],
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    description: 'Configure webhooks de saída e teste receptores.',
    endpoints: [
      {
        id: 'webhook-patch',
        method: 'PATCH',
        path: '/api/instances/:name/webhook',
        title: 'Atualizar configuração de webhook',
        description:
          'Atualização parcial de URL, cabeçalhos, flag de habilitação e eventos permitidos. Os nomes dos eventos devem estar na lista de permitidos.',
        auth: 'bearer_or_apiKey',
        pathParams: [{ name: 'name', placeholder: 'meu-papagai', description: 'Nome da instância.' }],
        bodyParams: [
          { name: 'webhookUrl', type: 'string', required: false, description: 'Nova URL do webhook.' },
          { name: 'webhookHeaders', type: 'object', required: false, description: 'Substitui o mapa de cabeçalhos.' },
          { name: 'enabled', type: 'boolean', required: false, description: 'Liga/desliga a entrega de webhooks.' },
          { name: 'events', type: 'string[]', required: false, description: 'Permitidos: message, message_update, qr, connected, disconnected.' },
        ],
        responseExample: `{
  "instance": "meu-papagai",
  "webhook": {
    "url": "https://example.com/hook",
    "headers": { "X-Secret": "abc" },
    "enabled": true,
    "events": ["message", "connected"]
  }
}`,
        errorCodes: [
          { status: 400, description: 'Nomes de eventos inválidos ou requisição mal formada.' },
          { status: 404, description: 'Instância não encontrada.' },
        ],
        curlExample: `curl -sS -X PATCH "$BASE/api/instances/meu-papagai/webhook" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"enabled":true,"events":["message","connected"]}'`,
        tryBody: '{\n  "enabled": true,\n  "events": ["message", "connected", "disconnected"]\n}',
      },
      {
        id: 'webhook-test-receiver',
        method: 'POST',
        path: '/webhook-test',
        title: 'Receptor de teste de webhook (dev)',
        description:
          'Endpoint echo sem autenticação para testes locais. O Papagai registra o body no log; útil com ngrok ou redes do Docker Compose.',
        auth: 'none',
        responseExample: `{
  "received": true,
  "timestamp": 1710000000000,
  "message": "Webhook recebido com sucesso"
}`,
        errorCodes: [],
        curlExample: `curl -sS -X POST "$BASE/webhook-test" \\
  -H "Content-Type: application/json" \\
  -d '{"ola":"mundo"}'`,
        tryBody: '{\n  "ola": "mundo"\n}',
      },
    ],
  },
];
