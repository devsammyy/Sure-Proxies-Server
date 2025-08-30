import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateUserDTO {
  @ApiProperty({
    example: 'babatunde@example.com',
    description: 'The email of the user',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Babatunde Adebayo',
    description: 'Full name of the user',
  })
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: 'StrongPass123',
    description: 'Password for the user account',
  })
  @MinLength(6)
  password: string;
}

export class UpdateUserDto {
  @ApiProperty({
    example: 'Babatunde Adebayo',
    description: 'Updated full name',
    required: false,
  })
  @IsOptional()
  fullName?: string;

  @ApiProperty({
    example: 'newpassword123',
    description: 'Updated password',
    required: false,
  })
  @IsOptional()
  @MinLength(6)
  password?: string;
}
