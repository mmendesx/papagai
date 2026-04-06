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

export interface EndpointDef {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  auth: 'none' | 'jwt';
  pathParams?: PathParamDef[];
  queryParams?: ParamDef[];
  bodyParams?: ParamDef[];
  responseExample: string;
  errorCodes: ErrorDef[];
  curlExample: string;
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
  { key: 'message', description: 'Incoming message from a contact (text, media, etc.).' },
  { key: 'message_update', description: 'Delivery or read receipts and similar status updates.' },
  { key: 'qr', description: 'QR code string updated or refreshed for pairing.' },
  { key: 'connected', description: 'Instance successfully connected to WhatsApp.' },
  { key: 'disconnected', description: 'Connection lost; payload may include reconnect hints.' },
];

export const WEBHOOK_PAYLOAD_EXAMPLES: { event: string; json: string }[] = [
  {
    event: 'message',
    json: `{
  "event": "message",
  "instance": "my-instance",
  "data": { "...": "normalized message payload from Baileys" }
}`,
  },
  {
    event: 'connected',
    json: `{
  "event": "connected",
  "instance": "my-instance",
  "data": { "phoneNumber": "5511999999999" }
}`,
  },
];

export const API_ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    id: 'auth',
    title: 'Authentication',
    description: 'Obtain and validate JWT access tokens.',
    endpoints: [
      {
        id: 'auth-register',
        method: 'POST',
        path: '/api/auth/register',
        title: 'Register',
        description:
          'Creates a new user when registration is enabled and APP_KEY matches. Returns a JWT for immediate use.',
        auth: 'none',
        bodyParams: [
          { name: 'name', type: 'string', required: true, description: 'Display name (1–255 chars).' },
          { name: 'email', type: 'string', required: true, description: 'Unique email address.' },
          { name: 'password', type: 'string', required: true, description: 'Password (8–128 chars).' },
          { name: 'appKey', type: 'string', required: true, description: 'Must match server APP_KEY when registration is enabled.' },
        ],
        responseExample: `{
  "user": { "id": "…", "name": "…", "email": "…" },
  "accessToken": "eyJhbGciOiJIUzI1NiIs…"
}`,
        errorCodes: [
          { status: 403, description: 'Registration disabled or invalid app key (see response code field).' },
          { status: 409, description: 'Email already registered.' },
          { status: 400, description: 'Validation failed.' },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/auth/register" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Dev","email":"dev@example.com","password":"yourpassword","appKey":"YOUR_APP_KEY"}'`,
        tryBody: '{\n  "name": "Dev",\n  "email": "dev@example.com",\n  "password": "yourpassword",\n  "appKey": "YOUR_APP_KEY"\n}',
      },
      {
        id: 'auth-login',
        method: 'POST',
        path: '/api/auth/login',
        title: 'Login',
        description: 'Exchanges email and password for a JWT. Default expiry is 24 hours.',
        auth: 'none',
        bodyParams: [
          { name: 'email', type: 'string', required: true, description: 'Registered email.' },
          { name: 'password', type: 'string', required: true, description: 'Account password.' },
        ],
        responseExample: `{
  "user": { "id": "…", "name": "…", "email": "…" },
  "accessToken": "eyJhbGciOiJIUzI1NiIs…"
}`,
        errorCodes: [
          { status: 401, description: 'Invalid email or password.' },
          { status: 400, description: 'Validation failed.' },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com","password":"yourpassword"}'`,
        tryBody: '{\n  "email": "you@example.com",\n  "password": "yourpassword"\n}',
      },
      {
        id: 'auth-me',
        method: 'GET',
        path: '/api/auth/me',
        title: 'Current user',
        description: 'Returns the authenticated user from the JWT.',
        auth: 'jwt',
        responseExample: `{
  "id": "uuid",
  "name": "Dev",
  "email": "dev@example.com"
}`,
        errorCodes: [
          { status: 401, description: 'Missing or invalid token.' },
        ],
        curlExample: `curl -sS "$BASE/api/auth/me" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
    ],
  },
  {
    id: 'instances',
    title: 'Instances',
    description: 'Create and manage WhatsApp instances. All routes require JWT.',
    endpoints: [
      {
        id: 'instances-create',
        method: 'POST',
        path: '/api/instances/create',
        title: 'Create instance',
        description:
          'Starts a new named instance. Optional webhook URL, headers, enabled flag, and event list. Without a URL, webhooks stay disabled.',
        auth: 'jwt',
        bodyParams: [
          { name: 'name', type: 'string', required: true, description: 'Instance name (3–30 chars).' },
          { name: 'webhook', type: 'string', required: false, description: 'Webhook URL (optional).' },
          { name: 'webhookHeaders', type: 'object', required: false, description: 'String map of outbound webhook headers.' },
          { name: 'webhookEnabled', type: 'boolean', required: false, description: 'Only meaningful when webhook URL is set.' },
          { name: 'webhookEvents', type: 'string[]', required: false, description: 'Subset of: message, message_update, qr, connected, disconnected.' },
        ],
        responseExample: `{
  "success": true,
  "instance": "my-papagai",
  "message": "🦜 Papagai my-papagai criado com sucesso! …"
}`,
        errorCodes: [
          { status: 400, description: 'Duplicate name, validation error, or server error message.' },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/instances/create" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"my-papagai","webhook":"https://example.com/hook"}'`,
        tryBody: '{\n  "name": "my-papagai",\n  "webhook": "https://example.com/hook"\n}',
      },
      {
        id: 'instances-list',
        method: 'GET',
        path: '/api/instances',
        title: 'List instances',
        description: 'Lists all instances with connection state, uptime start, webhookEnabled, and nested webhook config.',
        auth: 'jwt',
        responseExample: `{
  "total": 1,
  "instances": [
    {
      "name": "my-papagai",
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
        errorCodes: [{ status: 401, description: 'Unauthorized.' }],
        curlExample: `curl -sS "$BASE/api/instances" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'instances-status',
        method: 'GET',
        path: '/api/instances/:name/status',
        title: 'Instance status',
        description: 'Runtime status including webhook configuration mirror.',
        auth: 'jwt',
        pathParams: [{ name: 'name', placeholder: 'my-papagai', description: 'Instance name.' }],
        responseExample: `{
  "name": "my-papagai",
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
          { status: 404, description: 'Instance not found.' },
          { status: 401, description: 'Unauthorized.' },
        ],
        curlExample: `curl -sS "$BASE/api/instances/my-papagai/status" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'instances-qr',
        method: 'GET',
        path: '/api/instances/:name/qr',
        title: 'QR / connection state',
        description: 'Polling endpoint for QR image data, connecting, or connected state.',
        auth: 'jwt',
        pathParams: [{ name: 'name', placeholder: 'my-papagai', description: 'Instance name.' }],
        responseExample: `{
  "status": "qr",
  "instance": "my-papagai",
  "qr": "…",
  "qrImageData": "data:image/png;base64,…",
  "message": "🦜 Escaneie o QR code…"
}`,
        errorCodes: [{ status: 404, description: 'Instance not found.' }],
        curlExample: `curl -sS "$BASE/api/instances/my-papagai/qr" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'instances-delete',
        method: 'DELETE',
        path: '/api/instances/:name',
        title: 'Disconnect / remove instance',
        description: 'Ends the session and removes the instance from the server registry.',
        auth: 'jwt',
        pathParams: [{ name: 'name', placeholder: 'my-papagai', description: 'Instance name.' }],
        responseExample: `{
  "message": "🦜 Papagai my-papagai foi dormir. Até logo!",
  "instance": "my-papagai"
}`,
        errorCodes: [{ status: 404, description: 'Instance not found.' }],
        curlExample: `curl -sS -X DELETE "$BASE/api/instances/my-papagai" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
    ],
  },
  {
    id: 'messages',
    title: 'Messages',
    description: 'Send WhatsApp messages in Meta-compatible shape.',
    endpoints: [
      {
        id: 'messages-send',
        method: 'POST',
        path: '/api/instances/:name/messages',
        title: 'Send message',
        description: 'Sends a message from the given instance. Body follows Meta Cloud API style (type + payload).',
        auth: 'jwt',
        pathParams: [{ name: 'name', placeholder: 'my-papagai', description: 'Instance name.' }],
        bodyParams: [
          { name: 'to', type: 'string', required: true, description: 'Recipient JID or number as accepted by the gateway.' },
          { name: 'type', type: 'string', required: true, description: 'e.g. text, image, audio, video, document, sticker, location, contacts, reaction, interactive.' },
          { name: 'text', type: 'object', required: false, description: 'For type text: { body: string }' },
          { name: 'image', type: 'object', required: false, description: 'Media payload per transformer.' },
        ],
        responseExample: `{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "5511999999999", "wa_id": "5511999999999" }],
  "messages": [{ "id": "…" }]
}`,
        errorCodes: [{ status: 400, description: 'Send failed or invalid payload.' }],
        curlExample: `curl -sS -X POST "$BASE/api/instances/my-papagai/messages" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"5511999999999@s.whatsapp.net","type":"text","text":{"body":"Hello"}}'`,
        tryBody: '{\n  "to": "5511999999999@s.whatsapp.net",\n  "type": "text",\n  "text": { "body": "Hello from API" }\n}',
      },
    ],
  },
  {
    id: 'contacts',
    title: 'Contacts & chats',
    description: 'Read contacts and conversation metadata from a connected instance.',
    endpoints: [
      {
        id: 'contact-info',
        method: 'GET',
        path: '/api/instances/:name/contact/:number',
        title: 'Contact info',
        description: 'Looks up contact metadata for a number on the given instance.',
        auth: 'jwt',
        pathParams: [
          { name: 'name', placeholder: 'my-papagai', description: 'Instance name.' },
          { name: 'number', placeholder: '5511999999999', description: 'Phone number or JID fragment.' },
        ],
        responseExample: `{
  "phoneNumber": "5511999999999",
  "pushName": "Contact Name"
}`,
        errorCodes: [{ status: 400, description: 'Lookup failed.' }],
        curlExample: `curl -sS "$BASE/api/instances/my-papagai/contact/5511999999999" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'chats-list',
        method: 'GET',
        path: '/api/instances/:name/chats',
        tryQuery: 'include_messages=false',
        title: 'List chats',
        description: 'Returns chats for the instance. Set query include_messages=true to embed recent messages.',
        auth: 'jwt',
        pathParams: [{ name: 'name', placeholder: 'my-papagai', description: 'Instance name.' }],
        queryParams: [
          { name: 'include_messages', type: 'string', required: false, description: 'Use value "true" to include messages.' },
        ],
        responseExample: `{
  "instance": "my-papagai",
  "total": 3,
  "chats": []
}`,
        errorCodes: [{ status: 400, description: 'Failed to load chats.' }],
        curlExample: `curl -sS "$BASE/api/instances/my-papagai/chats?include_messages=false" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
    ],
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    description: 'Configure outbound webhooks and test receivers.',
    endpoints: [
      {
        id: 'webhook-patch',
        method: 'PATCH',
        path: '/api/instances/:name/webhook',
        title: 'Update webhook settings',
        description:
          'Partial update of URL, headers, enabled flag, and allowed events. Event names must be from the allowlist.',
        auth: 'jwt',
        pathParams: [{ name: 'name', placeholder: 'my-papagai', description: 'Instance name.' }],
        bodyParams: [
          { name: 'webhookUrl', type: 'string', required: false, description: 'New webhook URL.' },
          { name: 'webhookHeaders', type: 'object', required: false, description: 'Replace headers map.' },
          { name: 'enabled', type: 'boolean', required: false, description: 'Master on/off for delivery.' },
          { name: 'events', type: 'string[]', required: false, description: 'Allowed: message, message_update, qr, connected, disconnected.' },
        ],
        responseExample: `{
  "instance": "my-papagai",
  "webhook": {
    "url": "https://example.com/hook",
    "headers": { "X-Secret": "abc" },
    "enabled": true,
    "events": ["message", "connected"]
  }
}`,
        errorCodes: [
          { status: 400, description: 'Invalid event names or bad request.' },
          { status: 404, description: 'Instance not found.' },
        ],
        curlExample: `curl -sS -X PATCH "$BASE/api/instances/my-papagai/webhook" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"enabled":true,"events":["message","connected"]}'`,
        tryBody: '{\n  "enabled": true,\n  "events": ["message", "connected", "disconnected"]\n}',
      },
      {
        id: 'webhook-test-receiver',
        method: 'POST',
        path: '/webhook-test',
        title: 'Webhook test receiver (dev)',
        description:
          'Unauthenticated echo endpoint for local testing. Papagai logs the body; useful with ngrok or compose networking.',
        auth: 'none',
        responseExample: `{
  "received": true,
  "timestamp": 1710000000000,
  "message": "Webhook received successfully"
}`,
        errorCodes: [],
        curlExample: `curl -sS -X POST "$BASE/webhook-test" \\
  -H "Content-Type: application/json" \\
  -d '{"hello":"world"}'`,
        tryBody: '{\n  "hello": "world"\n}',
      },
    ],
  },
];
