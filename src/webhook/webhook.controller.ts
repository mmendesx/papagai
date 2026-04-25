import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('webhook-test')
export class WebhookController {
  @Post()
  @HttpCode(HttpStatus.OK)
  receiveWebhook(): {
    received: boolean;
    timestamp: number;
    message: string;
  } {
    return {
      received: true,
      timestamp: Date.now(),
      message: '🦜 Papagai recebeu seu webhook!',
    };
  }
}
