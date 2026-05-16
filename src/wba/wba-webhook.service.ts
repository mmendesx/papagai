import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { WbaInstanceService } from './wba-instance.service.js';

type WebhookOwner = { userId: string; name: string; appSecret?: string };

@Injectable()
export class WbaWebhookService {
  constructor(private readonly wbaInstanceService: WbaInstanceService) {}

  async verifyChallenge(
    mode?: string,
    verifyToken?: string,
    challenge?: string,
  ): Promise<string> {
    if (mode !== 'subscribe' || !verifyToken || !challenge) {
      throw new ForbiddenException('Invalid webhook verification request.');
    }
    const owner = await this.wbaInstanceService.findByVerifyToken(verifyToken);
    if (!owner) {
      throw new ForbiddenException('Invalid webhook verify token.');
    }
    return challenge;
  }

  async ingestWebhook(
    body: Record<string, any>,
    rawBody: Buffer,
    signatureHeader?: string,
  ): Promise<{ accepted: boolean; processed: number; ignored: number }> {
    const changes = this.collectMessageChanges(body);
    if (changes.length === 0) {
      return { accepted: true, processed: 0, ignored: 0 };
    }

    const ownerByPhone = new Map<string, WebhookOwner>();
    for (const change of changes) {
      const phoneNumberId = this.getPhoneNumberId(change);
      if (!phoneNumberId) continue;
      if (ownerByPhone.has(phoneNumberId)) continue;
      const owner =
        await this.wbaInstanceService.findInstanceByPhoneNumberId(
          phoneNumberId,
        );
      if (owner) {
        ownerByPhone.set(phoneNumberId, owner);
      }
    }

    if (ownerByPhone.size === 0) {
      return { accepted: true, processed: 0, ignored: changes.length };
    }

    this.validateSignatureIfRequired(signatureHeader, rawBody, [
      ...ownerByPhone.values(),
    ]);

    let processed = 0;
    let ignored = 0;
    for (const change of changes) {
      const phoneNumberId = this.getPhoneNumberId(change);
      if (!phoneNumberId) {
        ignored += 1;
        continue;
      }
      const owner = ownerByPhone.get(phoneNumberId);
      if (!owner) {
        ignored += 1;
        continue;
      }
      const value = change?.value ?? {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const firstContact = contacts[0];
      const senderName =
        typeof firstContact?.profile?.name === 'string'
          ? firstContact.profile.name
          : null;

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        const messageId = typeof message?.id === 'string' ? message.id : null;
        const from = typeof message?.from === 'string' ? message.from : null;
        if (!messageId || !from) {
          ignored += 1;
          continue;
        }
        const text =
          typeof message?.text?.body === 'string'
            ? message.text.body
            : message?.type === 'template'
              ? `Template: ${message?.template?.name ?? 'unknown'}`
              : null;
        const timestamp =
          typeof message?.timestamp === 'string'
            ? Number.parseInt(message.timestamp, 10)
            : undefined;
        this.wbaInstanceService.ingestIncomingMessage(
          owner.userId,
          owner.name,
          {
            id: messageId,
            from,
            type: typeof message?.type === 'string' ? message.type : 'unknown',
            text,
            timestamp,
            senderName: senderName ?? undefined,
          },
        );
        processed += 1;
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const status of statuses) {
        const statusId = typeof status?.id === 'string' ? status.id : null;
        if (!statusId) {
          ignored += 1;
          continue;
        }
        this.wbaInstanceService.ingestStatusUpdate(owner.userId, owner.name, {
          id: statusId,
          status:
            typeof status?.status === 'string' ? status.status : undefined,
        });
        processed += 1;
      }
    }

    return { accepted: true, processed, ignored };
  }

  private collectMessageChanges(
    body: Record<string, any>,
  ): Array<Record<string, any>> {
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    const changes: Array<Record<string, any>> = [];
    for (const entry of entries) {
      const entryChanges = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of entryChanges) {
        if (change?.field === 'messages') {
          changes.push(change);
        }
      }
    }
    return changes;
  }

  private getPhoneNumberId(change: Record<string, any>): string | null {
    const phoneNumberId = change?.value?.metadata?.phone_number_id;
    return typeof phoneNumberId === 'string' && phoneNumberId.length > 0
      ? phoneNumberId
      : null;
  }

  private validateSignatureIfRequired(
    signatureHeader: string | undefined,
    rawBody: Buffer,
    owners: WebhookOwner[],
  ): void {
    const requiredOwners = owners.filter(
      (owner) =>
        typeof owner.appSecret === 'string' && owner.appSecret.length > 0,
    );
    if (requiredOwners.length === 0) return;

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      throw new ForbiddenException('Missing webhook signature.');
    }

    const expectedSignature = signatureHeader.slice('sha256='.length).trim();
    const isAnyValid = requiredOwners.some((owner) =>
      this.isValidSignature(rawBody, expectedSignature, owner.appSecret!),
    );
    if (!isAnyValid) {
      throw new ForbiddenException('Invalid webhook signature.');
    }
  }

  private isValidSignature(
    rawBody: Buffer,
    signature: string,
    appSecret: string,
  ): boolean {
    const digest = createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');
    const incoming = Buffer.from(signature, 'hex');
    const expected = Buffer.from(digest, 'hex');
    if (incoming.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(incoming, expected);
  }
}
