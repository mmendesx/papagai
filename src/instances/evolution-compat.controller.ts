import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AnyAuthGuard } from '../auth/guards/any-auth.guard.js';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard.js';
import {
  GetBase64FromMediaMessageDto,
  GetBase64FromMediaMessageResponseDto,
} from './dto/get-base64-from-media-message.dto.js';
import { InstancesService } from './instances.service.js';

@ApiTags('Compatibility')
@ApiBearerAuth('bearer')
@ApiSecurity('apiKey')
@Controller('chat')
@UseGuards(AnyAuthGuard)
export class EvolutionCompatController {
  constructor(private readonly instancesService: InstancesService) {}

  @ApiOperation({
    summary: 'Evolution-compatible media retrieval by message id',
  })
  @ApiParam({ name: 'name', description: 'Instance name' })
  @ApiBody({
    type: GetBase64FromMediaMessageDto,
    examples: {
      default: {
        summary: 'Evolution request payload',
        value: {
          message: { key: { id: '3EB00C38AC4E1BA524D51E' } },
          convertToMp4: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: GetBase64FromMediaMessageResponseDto,
    description: 'Stored media base64 payload',
  })
  @ApiResponse({
    status: 400,
    description:
      'Message not found / non-media / unsupported conversion / unsupported provider',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @Get('getBase64FromMediaMessage/:name')
  @HttpCode(HttpStatus.OK)
  getBase64FromMediaMessage(
    @Req() req: Request,
    @Param('name') name: string,
    @Body() dto: GetBase64FromMediaMessageDto,
  ) {
    const userId = (req['user'] as JwtPayload).sub;
    return this.instancesService.getBase64FromMediaMessage(userId, name, dto);
  }
}
