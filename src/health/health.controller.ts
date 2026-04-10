import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service.js';

@Controller('api/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.checkHealth();
    const overallStatus =
      result.db === 'ok' && result.redis === 'ok' ? 'ok' : 'degraded';
    res.status(overallStatus === 'ok' ? 200 : 503);
    return { status: overallStatus, ...result };
  }
}
