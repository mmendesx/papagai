import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

const { version } = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
) as { version: string };

@Injectable()
export class LlmsDocumentService implements OnModuleInit {
  private document: string = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const baseUrl =
      this.configService.get<string>('baseUrl') ?? 'http://localhost:3000';
    this.document = this.buildDocument(baseUrl);
  }

  getDocument(): string {
    return this.document;
  }

  buildDocument(baseUrl: string): string {
    return (
      this.buildHeader(baseUrl) +
      this.buildAuthSection() +
      this.buildInstanceLifecycleSection() +
      this.buildWebhookConfigSection() +
      this.buildWebhookPayloadSection() +
      this.buildSendMessageSection()
    );
  }

  private buildHeader(baseUrl: string): string {
    return (
      '# Papagai\n' +
      '> WhatsApp gateway REST API and webhook delivery platform\n' +
      '\n' +
      'Version: ' +
      version +
      '\n' +
      'Base URL: ' +
      baseUrl +
      '\n' +
      'Auth: Bearer JWT | ApiKey\n' +
      '\n' +
      '---\n'
    );
  }

  private buildAuthSection(): string {
    return (
      '\n## Authentication\n' +
      '\n' +
      'Papagai supports two auth mechanisms:\n' +
      '\n' +
      '### JWT\n' +
      '\n' +
      'POST /api/auth/login\n' +
      'Body: { "email": "user@example.com", "password": "secret" }\n' +
      'Response: { "access_token": "<jwt>" }\n' +
      '\n' +
      'Usage: Authorization: Bearer <jwt>\n' +
      'Tokens are short-lived. Re-authenticate when you receive 401.\n' +
      '\n' +
      '### API Key\n' +
      '\n' +
      'Create a key:\n' +
      'POST /api/instances/:name/apikeys\n' +
      'Header: Authorization: Bearer <jwt>\n' +
      'Response: { "id": "...", "key": "<plaintext-key>", "name": "...", "scope": "instance" }\n' +
      '\n' +
      'IMPORTANT: The plaintext key is shown ONCE. Store it securely.\n' +
      '\n' +
      'Usage: Authorization: ApiKey <your-api-key>\n' +
      'API keys are scoped to the instance they were created under.\n' +
      '\n' +
      '---\n'
    );
  }

  private buildInstanceLifecycleSection(): string {
    return (
      '\n## Instance Lifecycle\n' +
      '\n' +
      'An "instance" is a managed WhatsApp connection identified by a user-chosen name.\n' +
      '\n' +
      '### Create instance\n' +
      '\n' +
      'POST /api/instances/create\n' +
      'Header: Authorization: Bearer <jwt> | ApiKey <key>\n' +
      'Body:\n' +
      '{\n' +
      '  "name": "my-instance",\n' +
      '  "webhookUrl": "https://your-server.com/webhook",\n' +
      '  "webhookEnabled": true,\n' +
      '  "webhookEvents": ["message", "connected", "disconnected"],\n' +
      '  "webhookHeaders": { "X-Secret": "your-secret" }\n' +
      '}\n' +
      'Response: { "name": "my-instance", "status": "connecting", ... }\n' +
      '\n' +
      '### Scan QR to connect\n' +
      '\n' +
      'After creation the instance enters "connecting" state. Poll the QR endpoint:\n' +
      '\n' +
      'GET /api/instances/:name/qr\n' +
      'Header: Authorization: Bearer <jwt> | ApiKey <key>\n' +
      '\n' +
      'Poll every 2-3 seconds until status is "connected".\n' +
      'The QR string changes every ~20 seconds; render the latest one.\n' +
      'Once the user scans with their phone, the instance becomes "connected".\n' +
      '\n' +
      '### Check connection status\n' +
      '\n' +
      'GET /api/instances/:name/status\n' +
      'Header: Authorization: Bearer <jwt> | ApiKey <key>\n' +
      'Response: { "status": "connected" | "disconnected" | "connecting" }\n' +
      '\n' +
      '### List instances\n' +
      '\n' +
      'GET /api/instances\n' +
      'Header: Authorization: Bearer <jwt> | ApiKey <key>\n' +
      'Response: [{ "name": "my-instance", "status": "connected", ... }]\n' +
      '\n' +
      '### Delete instance\n' +
      '\n' +
      'DELETE /api/instances/:name\n' +
      'Header: Authorization: Bearer <jwt> | ApiKey <key>\n' +
      'Response: 200 OK\n' +
      '\n' +
      '---\n'
    );
  }

  private buildWebhookConfigSection(): string {
    return (
      '\n## Webhook Configuration\n' +
      '\n' +
      'Configure the webhook for an existing instance:\n' +
      '\n' +
      'PATCH /api/instances/:name/webhook\n' +
      'Header: Authorization: Bearer <jwt> | ApiKey <key>\n' +
      'Body:\n' +
      '{\n' +
      '  "webhookUrl": "https://your-server.com/webhook",\n' +
      '  "webhookEnabled": true,\n' +
      '  "webhookEvents": ["message", "message_update", "qr", "connected", "disconnected"],\n' +
      '  "webhookHeaders": { "X-My-Secret": "shared-secret" }\n' +
      '}\n' +
      '\n' +
      'Allowed event values (webhookEvents array):\n' +
      '- message         — incoming WhatsApp message\n' +
      '- message_update  — delivery/read status update\n' +
      '- qr              — new QR code generated (useful for headless QR rendering)\n' +
      '- connected       — instance successfully connected\n' +
      '- disconnected    — instance disconnected\n' +
      '\n' +
      '### Headers Papagai injects on every webhook request\n' +
      '\n' +
      'Content-Type: application/json\n' +
      'X-Papagai-Instance: {instanceName}\n' +
      'X-Papagai-Event: {eventType}\n' +
      '\n' +
      'Plus any custom headers you set in webhookHeaders.\n' +
      '\n' +
      '### Delivery semantics\n' +
      '\n' +
      '1. Papagai makes one synchronous HTTP POST to your URL (5-second timeout).\n' +
      '2. If that attempt fails, the job is queued for exponential-backoff retry.\n' +
      '3. Your endpoint must return 2xx within 5 seconds. Return quickly and process async.\n' +
      '4. Validate the X-Papagai-Instance header and a shared secret in your webhookHeaders\n' +
      '   to authenticate incoming webhook calls.\n' +
      '\n' +
      '---\n'
    );
  }

  private buildWebhookPayloadSection(): string {
    return (
      '\n## Webhook Payload Catalogue\n' +
      '\n' +
      'All webhook payloads are JSON objects POSTed to your webhookUrl.\n' +
      '\n' +
      '### MediaFile object (used in media message types)\n' +
      '\n' +
      '{\n' +
      '  "path": "/uploads/abc.jpg",\n' +
      '  "url": "https://your-papagai-host/uploads/abc.jpg",\n' +
      '  "filename": "abc.jpg",\n' +
      '  "mimetype": "image/jpeg",\n' +
      '  "size": 204800,\n' +
      '  "caption": "optional caption or null",\n' +
      '  "duration": null\n' +
      '}\n' +
      '\n' +
      'Fields:\n' +
      '- path      — server-relative file path\n' +
      '- url       — absolute URL to download the file\n' +
      '- filename  — original filename\n' +
      '- mimetype  — MIME type string\n' +
      '- size      — file size in bytes\n' +
      '- caption   — text caption (image/video only, null if absent)\n' +
      '- duration  — seconds (audio/video only, null if absent)\n' +
      '\n' +
      '---\n' +
      '\n' +
      '### event: "message"\n' +
      '\n' +
      'Sent when a WhatsApp message is received.\n' +
      '\n' +
      'Common fields present on all message events:\n' +
      '{\n' +
      '  "event": "message",\n' +
      '  "instance": "my-instance",\n' +
      '  "from": "5511999990000",\n' +
      '  "pushName": "Alice",\n' +
      '  "messageId": "ABCDEF123456",\n' +
      '  "messageType": "<see variants below>",\n' +
      '  "timestamp": 1717200000,\n' +
      '  "isGroup": false,\n' +
      '  "groupId": null\n' +
      '}\n' +
      '\n' +
      'For group messages: isGroup=true, groupId="120363000000000000@g.us"\n' +
      '\n' +
      '#### messageType: "text"\n' +
      '\n' +
      'Additional fields:\n' +
      '  "text": "Hello world"\n' +
      '\n' +
      '#### messageType: "image"\n' +
      '\n' +
      'Additional fields:\n' +
      '  "image": { <MediaFile> },\n' +
      '  "caption": "optional caption"\n' +
      '\n' +
      '#### messageType: "audio"\n' +
      '\n' +
      'Additional fields:\n' +
      '  "audio": { <MediaFile> }\n' +
      '\n' +
      '#### messageType: "voice"\n' +
      '\n' +
      'Push-to-talk voice note.\n' +
      'Additional fields:\n' +
      '  "voice": { <MediaFile> },\n' +
      '  "duration": 12\n' +
      '\n' +
      '#### messageType: "video"\n' +
      '\n' +
      'Additional fields:\n' +
      '  "video": { <MediaFile> },\n' +
      '  "caption": "optional caption",\n' +
      '  "duration": 30\n' +
      '\n' +
      '#### messageType: "document"\n' +
      '\n' +
      'Additional fields:\n' +
      '  "document": { <MediaFile> },\n' +
      '  "filename": "report.pdf"\n' +
      '\n' +
      '#### messageType: "sticker"\n' +
      '\n' +
      'Additional fields:\n' +
      '  "sticker": { <MediaFile> }\n' +
      '\n' +
      '#### messageType: "location"\n' +
      '\n' +
      'Additional fields:\n' +
      '  "location": {\n' +
      '    "degreesLatitude": -23.5505,\n' +
      '    "degreesLongitude": -46.6333,\n' +
      '    "name": "São Paulo",\n' +
      '    "address": "São Paulo, SP, Brazil"\n' +
      '  }\n' +
      '\n' +
      '#### messageType: "contact"\n' +
      '\n' +
      'Additional fields:\n' +
      '  "contact": {\n' +
      '    "displayName": "Bob",\n' +
      '    "vcard": "BEGIN:VCARD\\nVERSION:3.0\\n...\\nEND:VCARD",\n' +
      '    "numbers": ["5511888880000"]\n' +
      '  }\n' +
      '\n' +
      '#### messageType: "button_response"\n' +
      '\n' +
      'User tapped a button in an interactive message.\n' +
      'Additional fields:\n' +
      '  "buttonId": "btn_yes",\n' +
      '  "text": "Yes"\n' +
      '\n' +
      '#### messageType: "list_response"\n' +
      '\n' +
      'User selected a row from a list message.\n' +
      'Additional fields:\n' +
      '  "selectedRowId": "row_1",\n' +
      '  "text": "Option A"\n' +
      '\n' +
      '#### messageType: "reaction"\n' +
      '\n' +
      'User reacted to a message.\n' +
      'Additional fields:\n' +
      '  "reaction": "👍",\n' +
      '  "parentMessageId": "ABCDEF123456"\n' +
      '\n' +
      '---\n' +
      '\n' +
      '### event: "message_update"\n' +
      '\n' +
      'Sent when message delivery/read status changes.\n' +
      '\n' +
      '{\n' +
      '  "event": "message_update",\n' +
      '  "instance": "my-instance",\n' +
      '  "updates": [\n' +
      '    {\n' +
      '      "key": { "id": "ABCDEF123456", "remoteJid": "5511999990000@s.whatsapp.net", "fromMe": true },\n' +
      '      "update": { "status": 3 }\n' +
      '    }\n' +
      '  ]\n' +
      '}\n' +
      '\n' +
      'Status codes:\n' +
      '  1 = sent (delivered to WhatsApp servers)\n' +
      '  2 = delivered (delivered to recipient device)\n' +
      '  3 = read (read by recipient)\n' +
      '\n' +
      '---\n' +
      '\n' +
      '### event: "qr"\n' +
      '\n' +
      'Sent when a new QR code is generated for scanning.\n' +
      '\n' +
      '{\n' +
      '  "event": "qr",\n' +
      '  "instance": "my-instance",\n' +
      '  "qr": "<base64-encoded QR string -- render with a QR library>"\n' +
      '}\n' +
      '\n' +
      '---\n' +
      '\n' +
      '### event: "connected"\n' +
      '\n' +
      'Sent when the WhatsApp instance successfully connects.\n' +
      '\n' +
      '{\n' +
      '  "event": "connected",\n' +
      '  "instance": "my-instance",\n' +
      '  "phoneNumber": "5511999990000"\n' +
      '}\n' +
      '\n' +
      '---\n' +
      '\n' +
      '### event: "disconnected"\n' +
      '\n' +
      'Sent when the WhatsApp instance disconnects.\n' +
      '\n' +
      '{\n' +
      '  "event": "disconnected",\n' +
      '  "instance": "my-instance",\n' +
      '  "reason": "loggedOut",\n' +
      '  "willReconnect": false\n' +
      '}\n' +
      '\n' +
      'reason values: "loggedOut" | "connectionLost" | "unknown"\n' +
      'willReconnect: true if Papagai will attempt automatic reconnection\n' +
      '\n' +
      '---\n'
    );
  }

  private buildSendMessageSection(): string {
    return (
      '\n## Sending Messages\n' +
      '\n' +
      'POST /api/instances/:name/messages\n' +
      'Header: Authorization: Bearer <jwt> | ApiKey <key>\n' +
      'Content-Type: application/json\n' +
      '\n' +
      '### Text message\n' +
      '\n' +
      '{\n' +
      '  "type": "text",\n' +
      '  "to": "5511999990000",\n' +
      '  "text": "Hello from Papagai!"\n' +
      '}\n' +
      '\n' +
      '### Image message (URL)\n' +
      '\n' +
      '{\n' +
      '  "type": "image",\n' +
      '  "to": "5511999990000",\n' +
      '  "url": "https://example.com/photo.jpg",\n' +
      '  "caption": "Check this out"\n' +
      '}\n' +
      '\n' +
      '### Image message (base64)\n' +
      '\n' +
      '{\n' +
      '  "type": "image",\n' +
      '  "to": "5511999990000",\n' +
      '  "base64": "data:image/jpeg;base64,/9j/4AAQ...",\n' +
      '  "caption": "Check this out"\n' +
      '}\n' +
      '\n' +
      '### Audio message\n' +
      '\n' +
      '{\n' +
      '  "type": "audio",\n' +
      '  "to": "5511999990000",\n' +
      '  "url": "https://example.com/audio.mp3"\n' +
      '}\n' +
      '\n' +
      '### Video message\n' +
      '\n' +
      '{\n' +
      '  "type": "video",\n' +
      '  "to": "5511999990000",\n' +
      '  "url": "https://example.com/video.mp4",\n' +
      '  "caption": "Watch this"\n' +
      '}\n' +
      '\n' +
      '### Document message\n' +
      '\n' +
      '{\n' +
      '  "type": "document",\n' +
      '  "to": "5511999990000",\n' +
      '  "url": "https://example.com/report.pdf",\n' +
      '  "filename": "report.pdf"\n' +
      '}\n' +
      '\n' +
      '### Sticker message\n' +
      '\n' +
      '{\n' +
      '  "type": "sticker",\n' +
      '  "to": "5511999990000",\n' +
      '  "url": "https://example.com/sticker.webp"\n' +
      '}\n' +
      '\n' +
      'Phone number format: country code + number, no "+" prefix (e.g. 5511999990000 for Brazil).\n' +
      'For group messages use the group JID: 120363000000000000@g.us\n' +
      '\n' +
      'Response: { "messageId": "ABCDEF123456", "status": "sent" }\n' +
      '\n' +
      '---\n' +
      '\n' +
      '## Quick-start integration example (Node.js)\n' +
      '\n' +
      '// 1. Login\n' +
      "const { access_token } = await fetch('https://your-host/api/auth/login', {\n" +
      "  method: 'POST',\n" +
      "  headers: { 'Content-Type': 'application/json' },\n" +
      "  body: JSON.stringify({ email: 'you@example.com', password: 'secret' })\n" +
      '}).then(r => r.json());\n' +
      '\n' +
      '// 2. Create instance with webhook\n' +
      "await fetch('https://your-host/api/instances/create', {\n" +
      "  method: 'POST',\n" +
      "  headers: { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' },\n" +
      '  body: JSON.stringify({\n' +
      "    name: 'bot',\n" +
      "    webhookUrl: 'https://your-server.com/webhook',\n" +
      '    webhookEnabled: true,\n' +
      "    webhookEvents: ['message', 'connected', 'disconnected']\n" +
      '  })\n' +
      '});\n' +
      '\n' +
      '// 3. Handle incoming webhook (Express example)\n' +
      "app.post('/webhook', (req, res) => {\n" +
      '  res.sendStatus(200); // Acknowledge immediately\n' +
      '  const { event, instance, messageType, text, from } = req.body;\n' +
      "  if (event === 'message' && messageType === 'text') {\n" +
      "    console.log('[' + instance + '] ' + from + ': ' + text);\n" +
      '  }\n' +
      '});\n'
    );
  }
}
