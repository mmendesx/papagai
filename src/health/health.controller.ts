import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service.js';

@ApiTags('Health')
@Controller('api/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @ApiOperation({
    summary: 'Service health check',
    description:
      'Returns the operational status of the database and Redis connections.',
  })
  @ApiResponse({
    status: 200,
    description: 'All services are operational',
    schema: { example: { status: 'ok', db: 'ok', redis: 'ok' } },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more services are degraded',
    schema: { example: { status: 'degraded', db: 'ok', redis: 'error' } },
  })
  @Get()
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.checkHealth();
    const overallStatus =
      result.db === 'ok' && result.redis === 'ok' ? 'ok' : 'degraded';
    res.status(overallStatus === 'ok' ? 200 : 503);
    return { status: overallStatus, ...result };
  }
}
