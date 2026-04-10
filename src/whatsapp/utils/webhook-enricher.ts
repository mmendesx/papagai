import { MediaFile } from '../interfaces/whatsapp.interface.js';
import { parseVCard } from './media-downloader.js';

export type DownloadMediaFn = (
  msg: any,
  mediaType: string,
) => Promise<MediaFile | null>;

export class WebhookEnricher {
  private readonly MESSAGE_TYPE_DETECTORS: Array<{
    test: (m: any) => boolean;
    resolve: string | ((m: any) => string);
  }> = [
    {
      test: (m) => !!(m.conversation || m.extendedTextMessage),
      resolve: 'text',
    },
    { test: (m) => !!m.imageMessage, resolve: 'image' },
    {
      test: (m) => !!m.audioMessage,
      resolve: (m) => (m.audioMessage.ptt ? 'voice' : 'audio'),
    },
    { test: (m) => !!m.videoMessage, resolve: 'video' },
    { test: (m) => !!m.documentMessage, resolve: 'document' },
    { test: (m) => !!m.stickerMessage, resolve: 'sticker' },
    { test: (m) => !!m.locationMessage, resolve: 'location' },
    { test: (m) => !!m.contactMessage, resolve: 'contact' },
    { test: (m) => !!m.buttonsResponseMessage, resolve: 'button_response' },
    { test: (m) => !!m.listResponseMessage, resolve: 'list_response' },
    { test: (m) => !!m.reactionMessage, resolve: 'reaction' },
  ];

  constructor(private readonly downloadFn: DownloadMediaFn) {}

  getMessageType(msg: any): string {
    const m = msg.message;
    if (!m) return 'unknown';
    const detector = this.MESSAGE_TYPE_DETECTORS.find(({ test }) => test(m));
    if (!detector) return 'unknown';
    return typeof detector.resolve === 'function'
      ? detector.resolve(m)
      : detector.resolve;
  }

  async enrich(webhookData: any, msg: any, messageType: string): Promise<void> {
    type Enricher = (msg: any, data: any) => Promise<void>;
    const ENRICHERS: Partial<Record<string, Enricher>> = {
      text: async (msg, data) => {
        data.text =
          msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      },
      image: async (msg, data) => {
        const r = await this.downloadFn(msg, 'image');
        if (r) {
          data.image = r;
          data.caption = r.caption;
        }
      },
      audio: async (msg, data) => {
        const r = await this.downloadFn(msg, 'audio');
        if (r) {
          data.audio = r;
          data.duration = r.duration;
        }
      },
      voice: async (msg, data) => {
        const r = await this.downloadFn(msg, 'audio');
        if (r) {
          data.voice = r;
          data.duration = r.duration;
        }
      },
      video: async (msg, data) => {
        const r = await this.downloadFn(msg, 'video');
        if (r) {
          data.video = r;
          data.caption = r.caption;
          data.duration = r.duration;
        }
      },
      document: async (msg, data) => {
        const r = await this.downloadFn(msg, 'document');
        if (r) {
          data.document = r;
          data.filename = r.filename;
        }
      },
      sticker: async (msg, data) => {
        const r = await this.downloadFn(msg, 'sticker');
        if (r) data.sticker = r;
      },
      location: async (msg, data) => {
        const loc = msg.message?.locationMessage;
        data.location = {
          degreesLatitude: loc?.degreesLatitude,
          degreesLongitude: loc?.degreesLongitude,
          name: loc?.name,
          address: loc?.address,
        };
      },
      contact: async (msg, data) => {
        const contact = msg.message?.contactMessage;
        const vcard: string = contact?.vcard || '';
        data.contact = {
          displayName: contact?.displayName || '',
          vcard,
          numbers: parseVCard(vcard),
        };
      },
      button_response: async (msg, data) => {
        const btn = msg.message?.buttonsResponseMessage;
        data.buttonId = btn?.selectedButtonId;
        data.text = btn?.selectedDisplayText;
      },
      reaction: async (msg, data) => {
        const react = msg.message?.reactionMessage;
        data.reaction = react?.text;
        data.parentMessageId = react?.key?.id;
      },
    };
    const enrichFn = ENRICHERS[messageType];
    if (enrichFn) await enrichFn(msg, webhookData);
  }
}
