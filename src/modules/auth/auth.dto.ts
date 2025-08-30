import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'Babatunde@example.com',
    description: "The user's email address",
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @ApiProperty({ example: 'StrongPass123', description: "The user's password" })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
