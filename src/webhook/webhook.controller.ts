import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

@Controller('webhook-test')
export class WebhookController {
  @Post()
  @HttpCode(HttpStatus.OK)
  receiveWebhook(
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
  ): { received: boolean; timestamp: number; message: string } {
    console.log('[webhook-test] body:', JSON.stringify(body, null, 2));
    console.log('[webhook-test] headers:', JSON.stringify(headers, null, 2));

    return {
      received: true,
      timestamp: Date.now(),
      message: '🦜 Papagai recebeu seu webhook!',
    };
  }
}
