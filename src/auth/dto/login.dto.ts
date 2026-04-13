import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'alice@example.com', description: 'Registered email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'S3cur3P@ss!', description: 'Minimum 8 characters' })
  @IsString()
  @MinLength(8)
  password: string;
}
