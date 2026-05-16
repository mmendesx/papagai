import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class WbaApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly metaCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WbaClientService {
  constructor(private readonly configService: ConfigService) {}

  async sendMessage(
    phoneNumberId: string,
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<{
    messaging_product?: string;
    contacts?: Array<{ input?: string; wa_id?: string }>;
    messages?: Array<{ id?: string }>;
  }> {
    const response = await this.requestGraph(
      `/${encodeURIComponent(phoneNumberId)}/messages`,
      accessToken,
      payload,
    );
    return response as {
      messaging_product?: string;
      contacts?: Array<{ input?: string; wa_id?: string }>;
      messages?: Array<{ id?: string }>;
    };
  }

  async healthCheck(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<{ healthy: boolean; statusCode: number; error?: string }> {
    try {
      await this.requestGraph(
        `/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number`,
        accessToken,
      );
      return { healthy: true, statusCode: 200 };
    } catch (error) {
      if (error instanceof WbaApiError) {
        return {
          healthy: false,
          statusCode: error.statusCode,
          error: error.message,
        };
      }
      return {
        healthy: false,
        statusCode: 500,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async requestGraph(
    path: string,
    accessToken: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const baseUrl = this.configService.get<string>(
      'wbaGraphApiBaseUrl',
      'https://graph.facebook.com',
    );
    const version = this.configService.get<string>(
      'wbaGraphApiVersion',
      'v22.0',
    );
    const timeoutMs = this.configService.get<number>('wbaHttpTimeoutMs', 15000);
    const url = `${baseUrl.replace(/\/$/, '')}/${version}${path}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = await response.json().catch(() => undefined);
      if (!response.ok) {
        const graphError = (json as { error?: Record<string, unknown> })?.error;
        const metaCode =
          typeof graphError?.['code'] === 'number'
            ? graphError['code']
            : undefined;
        const message =
          typeof graphError?.['message'] === 'string'
            ? graphError['message']
            : `Meta Cloud API request failed with status ${response.status}`;
        throw new WbaApiError(message, response.status, metaCode);
      }

      return json;
    } catch (error) {
      if (error instanceof WbaApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new WbaApiError(
          'Meta Cloud API request timed out',
          504,
          undefined,
        );
      }
      throw new WbaApiError(
        error instanceof Error ? error.message : String(error),
        500,
        undefined,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
