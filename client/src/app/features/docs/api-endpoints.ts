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

export type EndpointAuthType =
  | 'none'
  | 'bearer'
  | 'apiKey'
  | 'bearer_or_apiKey';

/**
 * A single field entry for per-field documentation tables.
 * Use dot-path notation for nested fields, e.g. "interactive.action.buttons[].reply.id".
 */
export interface FieldDef {
  field: string;
  type: string;
  required: boolean;
  description: string;
}

export interface BodyExampleDef {
  title: string;
  json: string;
  /** Optional per-field documentation rendered alongside the JSON example. */
  fields?: FieldDef[];
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
  {
    key: 'message',
    description: 'Mensagem recebida de um contato (texto, mídia, etc.).',
  },
  {
    key: 'message_update',
    description: 'Confirmações de entrega ou leitura e atualizações de status.',
  },
  { key: 'qr', description: 'QR code atualizado ou renovado para pareamento.' },
  {
    key: 'connected',
    description: 'Instância conectada com sucesso ao WhatsApp.',
  },
  {
    key: 'disconnected',
    description: 'Conexão perdida; o payload pode conter dicas de reconexão.',
  },
];

/**
 * Error response shape emitted by HttpExceptionFilter for all HTTP errors.
 * Source: src/common/filters/http-exception.filter.ts
 *
 * Fields:
 *   statusCode  — HTTP status code (number)
 *   timestamp   — ISO 8601 string of when the error occurred
 *   path        — request path that triggered the error
 *   message     — string or string[] (class-validator returns arrays for 400/422)
 *   error       — exception name / HTTP status text
 *   code?       — optional machine-readable code when the exception carries one
 */
export interface ErrorResponseShape {
  status: number;
  title: string;
  example: string;
}

export const COMMON_ERROR_RESPONSES: ErrorResponseShape[] = [
  {
    status: 400,
    title: 'Bad Request',
    example: `{
  "statusCode": 400,
  "timestamp": "2026-06-22T12:00:00.000Z",
  "path": "/api/instances/meu-papagai/messages",
  "message": "Falha no envio ou instância inválida.",
  "error": "Bad Request"
}`,
  },
  {
    status: 401,
    title: 'Unauthorized',
    example: `{
  "statusCode": 401,
  "timestamp": "2026-06-22T12:00:00.000Z",
  "path": "/api/instances/meu-papagai/messages",
  "message": "Unauthorized",
  "error": "Unauthorized"
}`,
  },
  {
    status: 422,
    title: 'Unprocessable Entity (validação)',
    example: `{
  "statusCode": 422,
  "timestamp": "2026-06-22T12:00:00.000Z",
  "path": "/api/instances/meu-papagai/messages",
  "message": [
    "to é obrigatório",
    "type must be a valid enum value"
  ],
  "error": "Unprocessable Entity"
}`,
  },
  {
    status: 429,
    title: 'Too Many Requests',
    example: `{
  "statusCode": 429,
  "timestamp": "2026-06-22T12:00:00.000Z",
  "path": "/api/auth/login",
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}`,
  },
];

// ---------------------------------------------------------------------------
// Send-message body examples — all interactive types (button, list, cta_url, cta_copy, otp)
// are fully supported by the backend (transformer.ts INTERACTIVE_BUILDERS).
// ---------------------------------------------------------------------------
const SEND_MESSAGE_BODY_EXAMPLES: BodyExampleDef[] = [
  {
    title: 'text',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "text",
  "text": { "body": "Hello from Papagai!" }
}`,
    fields: [
      {
        field: 'to',
        type: 'string',
        required: true,
        description: 'JID do destinatário (ex.: 5511999999999@s.whatsapp.net) ou número puro.',
      },
      {
        field: 'type',
        type: '"text"',
        required: true,
        description: 'Tipo da mensagem. Deve ser "text".',
      },
      {
        field: 'text.body',
        type: 'string',
        required: true,
        description: 'Corpo da mensagem de texto. Máximo 4096 caracteres.',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"image"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'image.link',
        type: 'string (URL)',
        required: true,
        description: 'URL pública da imagem. Obrigatório quando image.data não está presente.',
      },
      {
        field: 'image.caption',
        type: 'string',
        required: false,
        description: 'Legenda opcional. Máximo 1024 caracteres.',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"image"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'image.data',
        type: 'string (base64)',
        required: true,
        description: 'Conteúdo da imagem em base64. Máximo ~16 MB. Obrigatório quando image.link não está presente.',
      },
      {
        field: 'image.mimetype',
        type: 'string',
        required: true,
        description: 'MIME type da imagem (ex.: image/jpeg, image/png). Obrigatório quando image.data está presente.',
      },
      {
        field: 'image.caption',
        type: 'string',
        required: false,
        description: 'Legenda opcional. Máximo 1024 caracteres.',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"audio"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'audio.link',
        type: 'string (URL)',
        required: true,
        description: 'URL pública do arquivo de áudio. Obrigatório quando audio.data não está presente.',
      },
      {
        field: 'audio.ptt',
        type: 'boolean',
        required: false,
        description: 'true envia como nota de voz (push-to-talk). Padrão: false.',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"audio"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'audio.data',
        type: 'string (base64)',
        required: true,
        description: 'Conteúdo do áudio em base64. Obrigatório quando audio.link não está presente.',
      },
      {
        field: 'audio.mimetype',
        type: 'string',
        required: true,
        description: 'MIME type do áudio (ex.: audio/ogg, audio/mpeg). Obrigatório quando audio.data está presente.',
      },
      {
        field: 'audio.ptt',
        type: 'boolean',
        required: false,
        description: 'true envia como nota de voz. Padrão: false.',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"video"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'video.link',
        type: 'string (URL)',
        required: true,
        description: 'URL pública do vídeo. Obrigatório quando video.data não está presente.',
      },
      {
        field: 'video.caption',
        type: 'string',
        required: false,
        description: 'Legenda opcional. Máximo 1024 caracteres.',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"video"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'video.data',
        type: 'string (base64)',
        required: true,
        description: 'Conteúdo do vídeo em base64. Obrigatório quando video.link não está presente.',
      },
      {
        field: 'video.mimetype',
        type: 'string',
        required: true,
        description: 'MIME type do vídeo (ex.: video/mp4). Obrigatório quando video.data está presente.',
      },
      {
        field: 'video.caption',
        type: 'string',
        required: false,
        description: 'Legenda opcional. Máximo 1024 caracteres.',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"document"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'document.link',
        type: 'string (URL)',
        required: true,
        description: 'URL pública do documento. Obrigatório quando document.data não está presente.',
      },
      {
        field: 'document.filename',
        type: 'string',
        required: false,
        description: 'Nome do arquivo exibido ao destinatário.',
      },
      {
        field: 'document.caption',
        type: 'string',
        required: false,
        description: 'Legenda opcional. Máximo 1024 caracteres.',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"document"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'document.data',
        type: 'string (base64)',
        required: true,
        description: 'Conteúdo do documento em base64. Obrigatório quando document.link não está presente.',
      },
      {
        field: 'document.mimetype',
        type: 'string',
        required: true,
        description: 'MIME type do documento (ex.: application/pdf). Obrigatório quando document.data está presente.',
      },
      {
        field: 'document.filename',
        type: 'string',
        required: false,
        description: 'Nome do arquivo exibido ao destinatário.',
      },
    ],
  },
  {
    title: 'sticker URL',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "sticker",
  "sticker": { "link": "https://example.com/sticker.webp" }
}`,
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"sticker"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'sticker.link',
        type: 'string (URL)',
        required: true,
        description: 'URL pública do sticker WebP. Obrigatório quando sticker.data não está presente.',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"sticker"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'sticker.data',
        type: 'string (base64)',
        required: true,
        description: 'Conteúdo do sticker em base64. Obrigatório quando sticker.link não está presente.',
      },
      {
        field: 'sticker.mimetype',
        type: 'string',
        required: true,
        description: 'MIME type do sticker. Deve ser image/webp. Obrigatório quando sticker.data está presente.',
      },
    ],
  },
  {
    title: 'location',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "location",
  "location": {
    "latitude": -23.5505,
    "longitude": -46.6333,
    "name": "Sao Paulo",
    "address": "Av. Paulista, 1000 - São Paulo, SP"
  }
}`,
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"location"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'location.latitude',
        type: 'number',
        required: true,
        description: 'Latitude em graus decimais. Intervalo: -90 a 90.',
      },
      {
        field: 'location.longitude',
        type: 'number',
        required: true,
        description: 'Longitude em graus decimais. Intervalo: -180 a 180.',
      },
      {
        field: 'location.name',
        type: 'string',
        required: false,
        description: 'Nome do local exibido acima do mapa. Máximo 255 caracteres.',
      },
      {
        field: 'location.address',
        type: 'string',
        required: false,
        description: 'Endereço exibido abaixo do nome. Máximo 255 caracteres.',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"reaction"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'reaction.message_id',
        type: 'string',
        required: true,
        description: 'ID da mensagem alvo da reação (retornado no campo messages[].id ao enviar).',
      },
      {
        field: 'reaction.emoji',
        type: 'string',
        required: true,
        description: 'Emoji Unicode da reação. Máximo 8 bytes. Envie string vazia "" para remover a reação.',
      },
    ],
  },
  // interactive: reply buttons, list picker, and cta_url/cta_copy/otp are all
  // supported by the backend (transformer.ts INTERACTIVE_BUILDERS + CTA_BUTTON_BUILDERS).
  // Native rendering is limited to WhatsApp Personal; Web/Business fall back to
  // numbered plain text appended to the body (see transformer.ts appendFallbackText).
  {
    title: 'interactive buttons',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "header": { "text": "Título opcional" },
    "body": { "text": "Escolha uma opção" },
    "footer": { "text": "Rodapé opcional" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "yes", "title": "Sim" } },
        { "type": "reply", "reply": { "id": "no", "title": "Não" } }
      ]
    }
  }
}`,
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"interactive"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'interactive.type',
        type: '"button"',
        required: true,
        description: 'Subtipo interativo. Use "button" para botões de resposta rápida.',
      },
      {
        field: 'interactive.body.text',
        type: 'string',
        required: true,
        description: 'Texto principal da mensagem exibido acima dos botões.',
      },
      {
        field: 'interactive.header.text',
        type: 'string',
        required: false,
        description: 'Título opcional exibido acima do corpo.',
      },
      {
        field: 'interactive.footer.text',
        type: 'string',
        required: false,
        description: 'Rodapé opcional exibido abaixo dos botões.',
      },
      {
        field: 'interactive.action.buttons[].type',
        type: '"reply"',
        required: true,
        description: 'Tipo do botão. Deve ser "reply".',
      },
      {
        field: 'interactive.action.buttons[].reply.id',
        type: 'string',
        required: true,
        description: 'Identificador enviado de volta quando o usuário toca o botão.',
      },
      {
        field: 'interactive.action.buttons[].reply.title',
        type: 'string',
        required: true,
        description: 'Rótulo exibido no botão. Máximo 20 caracteres recomendados.',
      },
    ],
  },
  {
    title: 'interactive list',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "interactive",
  "interactive": {
    "type": "list",
    "header": { "text": "Cardápio" },
    "body": { "text": "Escolha um item do cardápio" },
    "footer": { "text": "Horário: 11h–22h" },
    "action": {
      "button": "Ver opções",
      "sections": [
        {
          "title": "Lanches",
          "rows": [
            { "id": "x-burguer", "title": "X-Burguer", "description": "Pão, carne e queijo" },
            { "id": "x-salada",  "title": "X-Salada",  "description": "Com alface e tomate" }
          ]
        },
        {
          "title": "Bebidas",
          "rows": [
            { "id": "suco-laranja", "title": "Suco de Laranja", "description": "300 ml" }
          ]
        }
      ]
    }
  }
}`,
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"interactive"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'interactive.type',
        type: '"list"',
        required: true,
        description: 'Subtipo interativo. Use "list" para seletor de lista com seções.',
      },
      {
        field: 'interactive.body.text',
        type: 'string',
        required: true,
        description: 'Texto principal da mensagem.',
      },
      {
        field: 'interactive.header.text',
        type: 'string',
        required: false,
        description: 'Título opcional exibido acima do corpo.',
      },
      {
        field: 'interactive.footer.text',
        type: 'string',
        required: false,
        description: 'Rodapé opcional.',
      },
      {
        field: 'interactive.action.button',
        type: 'string',
        required: true,
        description: 'Rótulo do botão que abre o seletor de lista.',
      },
      {
        field: 'interactive.action.sections[].title',
        type: 'string',
        required: false,
        description: 'Título da seção exibido como separador na lista.',
      },
      {
        field: 'interactive.action.sections[].rows[].id',
        type: 'string',
        required: true,
        description: 'Identificador enviado de volta quando o usuário seleciona o item.',
      },
      {
        field: 'interactive.action.sections[].rows[].title',
        type: 'string',
        required: true,
        description: 'Rótulo principal do item de lista.',
      },
      {
        field: 'interactive.action.sections[].rows[].description',
        type: 'string',
        required: false,
        description: 'Descrição secundária exibida abaixo do título do item.',
      },
    ],
  },
  {
    title: 'interactive cta_url',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "interactive",
  "interactive": {
    "type": "cta_url",
    "header": { "text": "Oferta especial" },
    "body": { "text": "Acesse o link abaixo para ver a promoção" },
    "footer": { "text": "Válido até amanhã" },
    "action": {
      "parameters": {
        "display_text": "Ver promoção",
        "url": "https://example.com/promo"
      }
    }
  }
}`,
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"interactive"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'interactive.type',
        type: '"cta_url"',
        required: true,
        description: 'Subtipo interativo. Use "cta_url" para botão com link externo.',
      },
      {
        field: 'interactive.body.text',
        type: 'string',
        required: true,
        description: 'Texto principal da mensagem.',
      },
      {
        field: 'interactive.header.text',
        type: 'string',
        required: false,
        description: 'Título opcional exibido acima do corpo.',
      },
      {
        field: 'interactive.footer.text',
        type: 'string',
        required: false,
        description: 'Rodapé opcional.',
      },
      {
        field: 'interactive.action.parameters.display_text',
        type: 'string',
        required: true,
        description: 'Rótulo exibido no botão de link.',
      },
      {
        field: 'interactive.action.parameters.url',
        type: 'string (URL)',
        required: true,
        description: 'URL que será aberta quando o usuário tocar no botão.',
      },
    ],
  },
  {
    title: 'interactive cta_copy',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "interactive",
  "interactive": {
    "type": "cta_copy",
    "body": { "text": "Use o cupom abaixo no checkout" },
    "footer": { "text": "Cupom de uso único" },
    "action": {
      "parameters": {
        "display_text": "Copiar cupom",
        "copy_code": "PROMO10"
      }
    }
  }
}`,
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"interactive"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'interactive.type',
        type: '"cta_copy"',
        required: true,
        description: 'Subtipo interativo. Use "cta_copy" para botão que copia um código.',
      },
      {
        field: 'interactive.body.text',
        type: 'string',
        required: true,
        description: 'Texto principal da mensagem.',
      },
      {
        field: 'interactive.footer.text',
        type: 'string',
        required: false,
        description: 'Rodapé opcional.',
      },
      {
        field: 'interactive.action.parameters.display_text',
        type: 'string',
        required: true,
        description: 'Rótulo exibido no botão de cópia.',
      },
      {
        field: 'interactive.action.parameters.copy_code',
        type: 'string',
        required: true,
        description: 'Código copiado para a área de transferência ao tocar no botão.',
      },
    ],
  },
  {
    title: 'interactive otp',
    json: `{
  "to": "5511999999999@s.whatsapp.net",
  "type": "interactive",
  "interactive": {
    "type": "otp",
    "body": { "text": "Seu código de verificação chegou" },
    "action": {
      "parameters": {
        "display_text": "Copiar código",
        "copy_code": "482913"
      }
    }
  }
}`,
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"interactive"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'interactive.type',
        type: '"otp"',
        required: true,
        description:
          'Subtipo interativo para códigos OTP. Enviado nativamente como cta_copy com otp_type "copy_code".',
      },
      {
        field: 'interactive.body.text',
        type: 'string',
        required: true,
        description: 'Texto principal da mensagem.',
      },
      {
        field: 'interactive.action.parameters.display_text',
        type: 'string',
        required: true,
        description: 'Rótulo exibido no botão de cópia.',
      },
      {
        field: 'interactive.action.parameters.copy_code',
        type: 'string',
        required: true,
        description: 'Código OTP copiado ao tocar no botão.',
      },
      {
        field: 'interactive.action.parameters.url',
        type: 'string (URL)',
        required: false,
        description: 'URL opcional do comerciante (mapeada para merchant_url).',
      },
    ],
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
    fields: [
      { field: 'to', type: 'string', required: true, description: 'JID ou número do destinatário.' },
      { field: 'type', type: '"contacts"', required: true, description: 'Tipo da mensagem.' },
      {
        field: 'contacts[].name.formatted_name',
        type: 'string',
        required: true,
        description: 'Nome completo do contato a ser compartilhado.',
      },
      {
        field: 'contacts[].phones[].phone',
        type: 'string',
        required: true,
        description: 'Número de telefone do contato (com código do país).',
      },
      {
        field: 'contacts[].phones[].type',
        type: 'string',
        required: false,
        description: 'Aceito na requisição mas ignorado pelo backend — o vCard sempre gera o número como tipo CELL independente do valor enviado.',
      },
    ],
  },
  {
    title: 'template',
    json: `{
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": { "code": "pt_BR" },
    "components": []
  }
}`,
    fields: [
      { field: 'to', type: 'string', required: true, description: 'Número do destinatário (sem @s.whatsapp.net para provider wba).' },
      { field: 'type', type: '"template"', required: true, description: 'Tipo da mensagem. Suportado apenas por instâncias provider=wba.' },
      {
        field: 'template.name',
        type: 'string',
        required: true,
        description: 'Nome do template aprovado na Meta Business Manager.',
      },
      {
        field: 'template.language.code',
        type: 'string',
        required: true,
        description: 'Código BCP-47 do idioma do template, ex.: "pt_BR", "en_US".',
      },
      {
        field: 'template.components',
        type: 'object[]',
        required: false,
        description: 'Componentes do template (header, body, button) com variáveis substituídas.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Webhook payload examples — flat shape confirmed from whatsapp.service.ts.
// The payload is the WebhookData object sent directly (no nested "data" key).
// ---------------------------------------------------------------------------
export const WEBHOOK_PAYLOAD_EXAMPLES: { event: string; json: string; fields?: FieldDef[] }[] = [
  {
    event: 'message',
    json: `{
  "event": "message",
  "instance": "minha-instancia",
  "from": "5511999999999",
  "pushName": "João",
  "messageId": "BAE5F4B2D36387E3",
  "messageType": "text",
  "text": "Olá, preciso de ajuda!",
  "timestamp": 1750000000000,
  "isGroup": false,
  "groupId": null
}`,
    fields: [
      { field: 'event', type: '"message"', required: true, description: 'Tipo do evento.' },
      { field: 'instance', type: 'string', required: true, description: 'Nome da instância que recebeu a mensagem.' },
      { field: 'from', type: 'string', required: true, description: 'Número do remetente (sem sufixo @s.whatsapp.net).' },
      { field: 'pushName', type: 'string', required: true, description: 'Nome de exibição do remetente no WhatsApp.' },
      { field: 'messageId', type: 'string', required: true, description: 'ID único da mensagem no WhatsApp.' },
      { field: 'messageType', type: 'string', required: true, description: 'Tipo da mensagem: text, image, audio, voice, video, document, sticker, location, contact, button_response, reaction.' },
      { field: 'text', type: 'string', required: false, description: 'Corpo da mensagem (presente quando messageType=text).' },
      { field: 'timestamp', type: 'number', required: true, description: 'Timestamp Unix em milissegundos.' },
      { field: 'isGroup', type: 'boolean', required: true, description: 'true quando a mensagem veio de um grupo.' },
      { field: 'groupId', type: 'string | null', required: true, description: 'JID do grupo ou null para chats privados.' },
    ],
  },
  {
    event: 'message_update',
    json: `{
  "event": "message_update",
  "instance": "minha-instancia",
  "timestamp": 1750000005000,
  "updates": [
    {
      "key": { "remoteJid": "5511999999999@s.whatsapp.net", "id": "BAE5F4B2D36387E3", "fromMe": true },
      "update": { "status": 3 }
    }
  ]
}`,
    fields: [
      { field: 'event', type: '"message_update"', required: true, description: 'Tipo do evento.' },
      { field: 'instance', type: 'string', required: true, description: 'Nome da instância.' },
      { field: 'timestamp', type: 'number', required: true, description: 'Timestamp Unix em milissegundos.' },
      { field: 'updates', type: 'object[]', required: true, description: 'Array de atualizações de status do Baileys. update.status (WAMessageStatus): 1=PENDING, 2=SERVER_ACK (enviado ao servidor), 3=DELIVERY_ACK (entregue ao dispositivo), 4=READ (lido).' },
    ],
  },
  {
    event: 'qr',
    json: `{
  "event": "qr",
  "instance": "minha-instancia",
  "qr": "2@abc123...",
  "timestamp": 1750000000000
}`,
    fields: [
      { field: 'event', type: '"qr"', required: true, description: 'Tipo do evento.' },
      { field: 'instance', type: 'string', required: true, description: 'Nome da instância.' },
      { field: 'qr', type: 'string', required: true, description: 'String raw do QR code para renderização com biblioteca qrcode.' },
      { field: 'timestamp', type: 'number', required: true, description: 'Timestamp Unix em milissegundos.' },
    ],
  },
  {
    event: 'connected',
    json: `{
  "event": "connected",
  "instance": "minha-instancia",
  "phoneNumber": "5511999999999",
  "timestamp": 1750000000000
}`,
    fields: [
      { field: 'event', type: '"connected"', required: true, description: 'Tipo do evento.' },
      { field: 'instance', type: 'string', required: true, description: 'Nome da instância.' },
      { field: 'phoneNumber', type: 'string', required: true, description: 'Número de telefone vinculado à sessão conectada.' },
      { field: 'timestamp', type: 'number', required: true, description: 'Timestamp Unix em milissegundos.' },
    ],
  },
  {
    event: 'disconnected',
    json: `{
  "event": "disconnected",
  "instance": "minha-instancia",
  "reason": "Connection Failure",
  "willReconnect": true,
  "timestamp": 1750000000000
}`,
    fields: [
      { field: 'event', type: '"disconnected"', required: true, description: 'Tipo do evento.' },
      { field: 'instance', type: 'string', required: true, description: 'Nome da instância.' },
      { field: 'reason', type: 'string', required: true, description: 'Mensagem de erro do Baileys descrevendo o motivo da desconexão.' },
      { field: 'willReconnect', type: 'boolean', required: true, description: 'true quando a instância tentará reconectar automaticamente. false quando deslogada ou em conflito de sessão.' },
      { field: 'timestamp', type: 'number', required: true, description: 'Timestamp Unix em milissegundos.' },
    ],
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
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'Nome de exibição (1–255 caracteres).',
          },
          {
            name: 'email',
            type: 'string',
            required: true,
            description: 'Endereço de e-mail único.',
          },
          {
            name: 'password',
            type: 'string',
            required: true,
            description: 'Senha (8–128 caracteres).',
          },
          {
            name: 'appKey',
            type: 'string',
            required: true,
            description:
              'Deve corresponder ao APP_KEY do servidor quando o registro está habilitado.',
          },
        ],
        responseExample: `{
  "user": { "id": "…", "name": "…", "email": "…" },
  "accessToken": "eyJhbGciOiJIUzI1NiIs…"
}`,
        errorCodes: [
          {
            status: 403,
            description:
              'Registro desabilitado ou chave de aplicação inválida.',
          },
          { status: 409, description: 'E-mail já cadastrado.' },
          { status: 400, description: 'Falha de validação.' },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/auth/register" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Dev","email":"dev@example.com","password":"suasenha","appKey":"SUA_APP_KEY"}'`,
        tryBody:
          '{\n  "name": "Dev",\n  "email": "dev@example.com",\n  "password": "suasenha",\n  "appKey": "SUA_APP_KEY"\n}',
      },
      {
        id: 'auth-login',
        method: 'POST',
        path: '/api/auth/login',
        title: 'Login',
        description:
          'Troca e-mail e senha por um JWT. Expiração padrão de 24 horas.',
        auth: 'none',
        bodyParams: [
          {
            name: 'email',
            type: 'string',
            required: true,
            description: 'E-mail cadastrado.',
          },
          {
            name: 'password',
            type: 'string',
            required: true,
            description: 'Senha da conta.',
          },
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
        tryBody:
          '{\n  "email": "voce@example.com",\n  "password": "suasenha"\n}',
      },
      {
        id: 'auth-me',
        method: 'GET',
        path: '/api/auth/me',
        title: 'Usuário atual',
        description:
          'Retorna o usuário autenticado a partir de Authorization: Bearer ou X-Api-Key.',
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
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'Nome legível da chave (1-255 caracteres).',
          },
          {
            name: 'expiresAt',
            type: 'string (ISO 8601)',
            required: false,
            description: 'Data de expiração opcional. Omitido = sem expiração.',
          },
          {
            name: 'permissionsTemplate',
            type: '"read_only" | "operator" | "instance_manager" | "account_admin"',
            required: false,
            description:
              'Template padrão de permissões para chave de conta. Exclusivo com permissions.',
          },
          {
            name: 'permissions',
            type: 'string[]',
            required: false,
            description:
              'Permissões explícitas para chave de conta. Exclusivo com permissionsTemplate.',
          },
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
          {
            status: 400,
            description:
              'Requisição inválida (por exemplo: permissions e permissionsTemplate enviados juntos).',
          },
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
        tryBody:
          '{\n  "name": "Integração CRM",\n  "permissionsTemplate": "operator"\n}',
      },
      {
        id: 'auth-apikeys-list',
        method: 'GET',
        path: '/api/auth/apikeys',
        title: 'Listar API keys de conta',
        description:
          'Lista API keys de conta sem retornar o valor plaintext da key. O campo permissions omitido/null indica acesso total no escopo da conta.',
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
        errorCodes: [{ status: 401, description: 'Não autorizado.' }],
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
        pathParams: [
          {
            name: 'id',
            placeholder: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            description: 'ID da API key.',
          },
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
        description:
          'Retorna templates padrão de permissões para criação de API keys de conta. IDs disponíveis: read_only, operator, instance_manager e account_admin.',
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
        errorCodes: [{ status: 401, description: 'Não autorizado.' }],
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
    description:
      'Crie e gerencie instâncias do WhatsApp. Todas as rotas aceitam Authorization: Bearer ou X-Api-Key.',
    endpoints: [
      {
        id: 'instances-create',
        method: 'POST',
        path: '/api/instances/create',
        title: 'Criar instância',
        description:
          'Inicia uma nova instância. provider pode ser web (padrão) ou wba. Para provider wba, o bloco wba é obrigatório e credenciais sigilosas não retornam na resposta.',
        auth: 'bearer_or_apiKey',
        bodyParams: [
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'Nome da instância (3–30 caracteres).',
          },
          {
            name: 'provider',
            type: '"web" | "wba"',
            required: false,
            description: 'Padrão: web. Use wba para Meta Cloud API.',
          },
          {
            name: 'wba',
            type: 'object',
            required: false,
            description:
              'Obrigatório quando provider=wba: businessAccountId, phoneNumberId, displayPhoneNumber, accessToken; appSecret e webhookVerifyToken opcionais.',
          },
          {
            name: 'webhook',
            type: 'string',
            required: false,
            description: 'URL do webhook (opcional).',
          },
          {
            name: 'webhookHeaders',
            type: 'object',
            required: false,
            description: 'Mapa de cabeçalhos HTTP enviados junto ao webhook.',
          },
          {
            name: 'webhookEnabled',
            type: 'boolean',
            required: false,
            description:
              'Relevante apenas quando a URL do webhook está definida.',
          },
          {
            name: 'webhookEvents',
            type: 'string[]',
            required: false,
            description:
              'Subconjunto de: message, message_update, qr, connected, disconnected.',
          },
        ],
        responseExample: `{
  "success": true,
  "instance": "meu-papagai",
  "provider": "wba",
  "capabilities": {
    "qr": false,
    "sendMessages": true,
    "receiveMessages": true,
    "chatHistorySync": false,
    "contactLookup": false,
    "markRead": false,
    "templates": true
  }
}`,
        errorCodes: [
          {
            status: 400,
            description:
              'Nome duplicado, erro de validação ou erro do servidor.',
          },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/instances/create" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"meu-papagai","provider":"wba","wba":{"businessAccountId":"2233445566","phoneNumberId":"12345","displayPhoneNumber":"+55 11 99999-9999","accessToken":"EAAG..."}}'`,
        tryBody: '{\n  "name": "meu-papagai",\n  "provider": "web"\n}',
      },
      {
        id: 'instances-list',
        method: 'GET',
        path: '/api/instances',
        title: 'Listar instâncias',
        description:
          'Lista instâncias com provider e capabilities para controle de recursos por tipo de integração.',
        auth: 'bearer_or_apiKey',
        responseExample: `{
  "total": 1,
  "instances": [
    {
      "name": "meu-papagai",
      "provider": "web",
      "connected": true,
      "startTime": 1710000000000,
      "capabilities": {
        "qr": true,
        "sendMessages": true
      },
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
        description:
          'Status provider-aware: web expõe QR/conexão Baileys; wba expõe capabilities e estado de setup/health.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
        responseExample: `{
  "name": "meu-papagai",
  "provider": "wba",
  "capabilities": {
    "qr": false,
    "sendMessages": true,
    "receiveMessages": true,
    "chatHistorySync": false,
    "contactLookup": false,
    "markRead": false,
    "templates": true
  },
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
        description:
          'Retorna contadores em memória para mensagens enviadas, recebidas, conversas ativas e status do webhook.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
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
        description:
          'Endpoint de polling para QR em instâncias web. provider=wba retorna 400 (feature web-only).',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
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
        description:
          'Encerra a sessão e remove a instância do registro do servidor.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
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
        description:
          'Cria uma API key com escopo restrito à instância. O valor key só é retornado na criação. Chaves de instância não aceitam permissions nem permissionsTemplate.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
        bodyParams: [
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'Nome legível da chave (1-255 caracteres).',
          },
          {
            name: 'expiresAt',
            type: 'string (ISO 8601)',
            required: false,
            description: 'Data de expiração opcional. Omitido = sem expiração.',
          },
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
          {
            status: 400,
            description:
              'Requisição inválida (ex.: envio de permissions ou permissionsTemplate).',
          },
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
        tryBody:
          '{\n  "name": "Automação instância A",\n  "expiresAt": "2027-01-01T00:00:00Z"\n}',
      },
      {
        id: 'instances-apikeys-list',
        method: 'GET',
        path: '/api/instances/:name/apikeys',
        title: 'Listar API keys da instância',
        description:
          'Lista API keys vinculadas à instância sem retornar plaintext da key.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
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
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
          {
            name: 'id',
            placeholder: '9b1deb4d-3b7d-4f7f-8f5f-0c9d99c01111',
            description: 'ID da API key.',
          },
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
    description:
      'Envie mensagens WhatsApp no formato compatível com a API Meta.',
    endpoints: [
      {
        id: 'messages-send',
        method: 'POST',
        path: '/api/instances/:name/messages',
        title: 'Enviar mensagem',
        description:
          'Envia uma mensagem pela instância indicada. provider=web usa Baileys; provider=wba usa Meta Cloud API no mesmo endpoint. provider=wba suporta template e rejeita payloads incompatíveis.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
        bodyParams: [
          {
            name: 'to',
            type: 'string',
            required: true,
            description: 'JID ou número do destinatário aceito pelo gateway.',
          },
          {
            name: 'type',
            type: 'string',
            required: true,
            description:
              'Ex.: text, image, audio, video, document, sticker, location, contacts, reaction, interactive, template.',
          },
          {
            name: 'text',
            type: 'object',
            required: false,
            description: 'Para type text: { body: string }',
          },
          {
            name: 'image | video',
            type: 'object',
            required: false,
            description:
              '{ link } ou { data, mimetype }, com caption opcional.',
          },
          {
            name: 'audio',
            type: 'object',
            required: false,
            description:
              '{ link } ou { data, mimetype }, com ptt opcional para voice note.',
          },
          {
            name: 'document',
            type: 'object',
            required: false,
            description:
              '{ link } ou { data, mimetype }, com filename e caption opcionais.',
          },
          {
            name: 'sticker',
            type: 'object',
            required: false,
            description: '{ link } ou { data, mimetype } para sticker WebP.',
          },
          {
            name: 'location',
            type: 'object',
            required: false,
            description: '{ latitude, longitude, name?, address? }.',
          },
          {
            name: 'reaction',
            type: 'object',
            required: false,
            description: '{ message_id, emoji }.',
          },
          {
            name: 'interactive',
            type: 'object',
            required: false,
            description: 'Payload interativo: type="button", "list", "cta_url", "cta_copy" ou "otp".',
          },
          {
            name: 'contacts',
            type: 'object[]',
            required: false,
            description: 'Lista de contatos no formato Meta.',
          },
          {
            name: 'template',
            type: 'object',
            required: false,
            description:
              'Para type template: { name, language: { code }, components? }.',
          },
        ],
        responseExample: `{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "5511999999999", "wa_id": "5511999999999" }],
  "messages": [{ "id": "…" }]
}`,
        errorCodes: [
          {
            status: 400,
            description:
              'Falha no envio, instância inválida ou erro do WhatsApp.',
          },
          { status: 401, description: 'Não autorizado.' },
          {
            status: 422,
            description:
              'Falha de validação, como mídia sem link/data ou base64 inválido.',
          },
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
        tryBody:
          '{\n  "to": "5511999999999@s.whatsapp.net",\n  "type": "text",\n  "text": { "body": "Olá da API!" }\n}',
      },
      {
        id: 'messages-upload',
        method: 'POST',
        path: '/api/instances/:name/upload',
        title: 'Upload de mídia',
        description:
          'Recebe multipart/form-data com campo file e retorna uma URL assinada para uso posterior em payloads de mídia por link. O composer do painel usa base64 inline; este endpoint é para integrações externas.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
        bodyParams: [
          {
            name: 'file',
            type: 'binary',
            required: true,
            description:
              'Arquivo de até 16 MB. Tipos aceitos: JPEG, PNG, WebP, GIF, MP4, OGG, MPEG e AAC.',
          },
        ],
        responseExample: `{
  "url": "http://localhost:3000/uploads/meu-papagai/7d9f-file.jpg?token=..."
}`,
        errorCodes: [
          {
            status: 400,
            description: 'Arquivo ausente ou tipo não permitido.',
          },
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'Instância não encontrada.' },
          { status: 413, description: 'Arquivo maior que 16 MB.' },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/instances/meu-papagai/upload" \\
  -H "Authorization: Bearer $TOKEN" \\
  -F "file=@./photo.jpg"`,
        tryItDisabledReason:
          'Upload multipart/form-data não é executado pelo Try It. Use o curl manual acima.',
      },
    ],
  },
  {
    id: 'wba-webhook',
    title: 'WBA Webhook',
    description:
      'Endpoints públicos para verificação e ingestão de webhooks da Meta Cloud API.',
    endpoints: [
      {
        id: 'wba-webhook-verify',
        method: 'GET',
        path: '/api/wba/webhook',
        title: 'Verificar webhook Meta',
        description:
          'Usado pela Meta para challenge verification (hub.mode, hub.verify_token, hub.challenge).',
        auth: 'none',
        queryParams: [
          {
            name: 'hub.mode',
            type: 'string',
            required: true,
            description: 'Deve ser subscribe.',
          },
          {
            name: 'hub.verify_token',
            type: 'string',
            required: true,
            description: 'Token de verificação configurado no provider wba.',
          },
          {
            name: 'hub.challenge',
            type: 'string',
            required: true,
            description: 'Valor que deve ser retornado em caso de sucesso.',
          },
        ],
        responseExample: `"hub.challenge"`,
        errorCodes: [{ status: 403, description: 'Token inválido.' }],
        curlExample: `curl -sS "$BASE/api/wba/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=12345"`,
      },
      {
        id: 'wba-webhook-ingest',
        method: 'POST',
        path: '/api/wba/webhook',
        title: 'Receber webhook Meta',
        description:
          'Ingere mensagens e status de entrega/leitura da Meta. Valida assinatura x-hub-signature-256 quando app secret está configurado.',
        auth: 'none',
        bodyParams: [
          {
            name: 'entry',
            type: 'object[]',
            required: true,
            description:
              'Estrutura padrão de webhook da Meta com changes.field=messages.',
          },
        ],
        responseExample: `{
  "accepted": true,
  "processed": 2,
  "ignored": 0
}`,
        errorCodes: [
          {
            status: 403,
            description: 'Assinatura inválida ou ausente quando obrigatória.',
          },
        ],
        curlExample: `curl -sS -X POST "$BASE/api/wba/webhook" \\
  -H "Content-Type: application/json" \\
  -H "x-hub-signature-256: sha256=..." \\
  -d '{"object":"whatsapp_business_account","entry":[]}'`,
        tryBody:
          '{\n  "object": "whatsapp_business_account",\n  "entry": []\n}',
      },
    ],
  },
  {
    id: 'contacts',
    title: 'Contatos e conversas',
    description:
      'Leia contatos e metadados de conversas de uma instância conectada.',
    endpoints: [
      {
        id: 'contact-info',
        method: 'GET',
        path: '/api/instances/:name/contact/:number',
        title: 'Dados do contato',
        description:
          'Busca metadados de contato para um número na instância indicada.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
          {
            name: 'number',
            placeholder: '5511999999999',
            description: 'Número de telefone ou fragmento JID.',
          },
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
        description:
          'Retorna as conversas da instância. Use include_messages=true para incluir mensagens recentes.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
        queryParams: [
          {
            name: 'include_messages',
            type: 'string',
            required: false,
            description: 'Use o valor "true" para incluir mensagens.',
          },
        ],
        responseExample: `{
  "instance": "meu-papagai",
  "total": 3,
  "chats": []
}`,
        errorCodes: [
          { status: 400, description: 'Falha ao carregar conversas.' },
        ],
        curlExample: `curl -sS "$BASE/api/instances/meu-papagai/chats?include_messages=false" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'chat-messages',
        method: 'GET',
        path: '/api/instances/:name/chats/:chatId/messages',
        tryQuery: 'limit=100',
        title: 'Listar mensagens da conversa',
        description:
          'Retorna o histórico recente de uma conversa. chatId aceita número puro ou JID completo; limit é limitado entre 1 e 500.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
          {
            name: 'chatId',
            placeholder: '5511999999999',
            description: 'Número puro ou JID completo da conversa.',
          },
        ],
        queryParams: [
          {
            name: 'limit',
            type: 'number',
            required: false,
            description: 'Quantidade de mensagens (1-500, padrão 100).',
          },
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
          {
            status: 400,
            description: 'chatId inválido ou falha ao carregar mensagens.',
          },
          { status: 401, description: 'Não autorizado.' },
          { status: 404, description: 'Instância não encontrada.' },
        ],
        curlExample: `curl -sS "$BASE/api/instances/meu-papagai/chats/5511999999999/messages?limit=100" \\
  -H "Authorization: Bearer $TOKEN"`,
      },
      {
        id: 'chat-get-base64-from-media-message',
        method: 'GET',
        path: '/chat/getBase64FromMediaMessage/:name',
        title: 'Obter mídia em base64 por message ID',
        description:
          'Compatível com Evolution API. Suporta instâncias web/Baileys com mídia já armazenada localmente. Não suporta convertToMp4 nem provider wba.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
        bodyParams: [
          {
            name: 'message.key.id',
            type: 'string',
            required: true,
            description: 'ID da mensagem de mídia armazenada.',
          },
          {
            name: 'convertToMp4',
            type: 'boolean',
            required: false,
            description:
              'Aceito por compatibilidade; true retorna erro porque conversão não é suportada.',
          },
        ],
        responseExample: `{
  "mediaType": "imageMessage",
  "fileName": "1710000000000_image.jpeg",
  "mimetype": "image/jpeg",
  "size": { "fileLength": 135348 },
  "caption": "optional caption",
  "base64": "/9j/4AAQSkZJRgABAQ..."
}`,
        errorCodes: [
          {
            status: 400,
            description:
              'Message not found / non-media / mídia indisponível / conversão não suportada / provider wba não suportado.',
          },
          { status: 401, description: 'Não autorizado.' },
          { status: 403, description: 'Sem permissão para instância/rota.' },
          { status: 404, description: 'Instância não encontrada.' },
          {
            status: 422,
            description: 'Falha de validação (message.key.id obrigatório).',
          },
        ],
        curlExample: `# Authorization: Bearer
curl -sS -X GET "$BASE/chat/getBase64FromMediaMessage/meu-papagai" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"message":{"key":{"id":"3EB00C38AC4E1BA524D51E"}},"convertToMp4":false}'

# X-Api-Key
curl -sS -X GET "$BASE/chat/getBase64FromMediaMessage/meu-papagai" \\
  -H "X-Api-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message":{"key":{"id":"3EB00C38AC4E1BA524D51E"}}}'`,
        tryBody:
          '{\n  "message": {\n    "key": {\n      "id": "3EB00C38AC4E1BA524D51E"\n    }\n  },\n  "convertToMp4": false\n}',
      },
      {
        id: 'chat-read',
        method: 'POST',
        path: '/api/instances/:name/chats/:chatId/read',
        title: 'Marcar conversa como lida',
        description: 'Zera o contador de não lidas para a conversa informada.',
        auth: 'bearer_or_apiKey',
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
          {
            name: 'chatId',
            placeholder: '5511999999999',
            description: 'Número puro ou JID completo da conversa.',
          },
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
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
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
        tryItDisabledReason:
          'Streams SSE ficam abertos continuamente. Use curl -N ou EventSource/fetch-event-source no cliente.',
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
        pathParams: [
          {
            name: 'name',
            placeholder: 'meu-papagai',
            description: 'Nome da instância.',
          },
        ],
        bodyParams: [
          {
            name: 'webhookUrl',
            type: 'string',
            required: false,
            description: 'Nova URL do webhook.',
          },
          {
            name: 'webhookHeaders',
            type: 'object',
            required: false,
            description: 'Substitui o mapa de cabeçalhos.',
          },
          {
            name: 'enabled',
            type: 'boolean',
            required: false,
            description: 'Liga/desliga a entrega de webhooks.',
          },
          {
            name: 'events',
            type: 'string[]',
            required: false,
            description:
              'Permitidos: message, message_update, qr, connected, disconnected.',
          },
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
          {
            status: 400,
            description:
              'Nomes de eventos inválidos ou requisição mal formada.',
          },
          { status: 404, description: 'Instância não encontrada.' },
        ],
        curlExample: `curl -sS -X PATCH "$BASE/api/instances/meu-papagai/webhook" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"enabled":true,"events":["message","connected"]}'`,
        tryBody:
          '{\n  "enabled": true,\n  "events": ["message", "connected", "disconnected"]\n}',
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
