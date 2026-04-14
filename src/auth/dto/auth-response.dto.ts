import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 1, description: 'User ID' })
  id: number;

  @ApiProperty({ example: 'alice@example.com', description: 'Email address' })
  email: string;

  @ApiProperty({ example: 'Alice', description: 'Display name' })
  name: string;
}

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  access_token: string;

  @ApiProperty({
    type: UserResponseDto,
    description: 'Authenticated user profile',
  })
  user: UserResponseDto;
}
