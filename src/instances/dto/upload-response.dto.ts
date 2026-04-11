import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ example: 'http://localhost:3000/uploads/my-bot/abc123.jpg' })
  url!: string;
}
