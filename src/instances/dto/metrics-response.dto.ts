import { ApiProperty } from '@nestjs/swagger';

export class InstanceMetricsDto {
  @ApiProperty({ example: 10 })
  messagesSent!: number;

  @ApiProperty({ example: 25 })
  messagesReceived!: number;

  @ApiProperty({ example: 5 })
  activeConversations!: number;

  @ApiProperty({ example: true })
  webhookEnabled!: boolean;
}

export class InstanceMetricsResponseDto {
  @ApiProperty({ example: 'my-instance' })
  instance!: string;

  @ApiProperty({ type: () => InstanceMetricsDto })
  metrics!: InstanceMetricsDto;
}
