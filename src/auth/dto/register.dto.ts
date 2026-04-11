import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Alice', description: 'Display name' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'alice@example.com', description: 'Unique email address' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'S3cur3P@ss!', description: 'Minimum 8 characters' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'my-app-key', description: 'Application key' })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  appKey: string;
}
