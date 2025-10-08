import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PeriodDto {
  @ApiProperty({
    description: 'Period unit',
    example: 'months',
    enum: ['months', 'days', 'years'],
  })
  @IsString()
  @IsIn(['months', 'days', 'years'])
  unit: 'months' | 'days' | 'years';

  @ApiProperty({
    description: 'Period value (positive integer)',
    example: 1,
  })
  @IsInt()
  @Min(1)
  value: number;
}

export class AutoExtendDto {
  @ApiProperty({
    description: 'Whether auto-extend is enabled',
    example: true,
  })
  @IsBoolean()
  isEnabled: boolean;

  @ApiProperty({
    description: 'Traffic amount to auto-extend (optional)',
    required: false,
    example: 1024,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  traffic?: number;
}

export class PriceInputDto {
  @ApiProperty({
    description: 'Plan id of the service',
    required: false,
    example: 'premium',
  })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiProperty({
    description: 'Quantity to price',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({
    description: 'Billing period',
    required: false,
    type: PeriodDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PeriodDto)
  period?: PeriodDto;

  @ApiProperty({
    description: 'Traffic amount (GB) for mobile/rotating services',
    required: false,
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  traffic?: number;

  @ApiProperty({
    description:
      'Package / bundle identifier (for static datacenter ipv6 etc.)',
    required: false,
    example: '50',
  })
  @IsOptional()
  @IsString()
  packageId?: string;

  @ApiProperty({
    description: 'Country code (ISO2) where required by the service',
    required: false,
    example: 'US',
  })
  @IsOptional()
  @IsString()
  country?: string;
}

export class ProxyOrderPurchaseInputDto {
  @ApiProperty({
    description: 'User id making the purchase',
    example: 'uid_123',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Plan id (optional for traffic-only services)',
    example: 'premium',
    required: false,
  })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Country code (ISO2) - optional',
    required: false,
    example: 'US',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description: 'ISP id (optional, provider specific)',
    required: false,
  })
  @IsOptional()
  @IsString()
  ispId?: string;

  @ApiProperty({ description: 'Billing period', type: PeriodDto })
  @ValidateNested()
  @Type(() => PeriodDto)
  period: PeriodDto;

  @ApiProperty({
    description: 'Auto-extend options',
    required: false,
    type: AutoExtendDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AutoExtendDto)
  autoExtend?: AutoExtendDto;

  @ApiProperty({
    description: 'Traffic amount (optional)',
    required: false,
    example: 1024,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  traffic?: number;

  @ApiProperty({
    description: 'Package / bundle identifier (optional for certain services)',
    required: false,
    example: '50',
  })
  @IsOptional()
  @IsString()
  packageId?: string;

  @ApiProperty({
    description:
      'Expected price that was displayed to the user (for validation)',
    required: false,
    example: 49.99,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedPrice?: number;
}

export class ProxyOrderPlanInputDto {
  @ApiProperty({ description: 'Plan id' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Human readable plan label' })
  @IsString()
  label: string;
}

export class PurchaseOrderInputDto {
  @ApiProperty({ description: 'User id', example: 'uid_123' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Plan id', example: 'premium' })
  @IsString()
  planId: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Country code (ISO2) - optional',
    required: false,
    example: 'US',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ description: 'ISP id (optional)', required: false })
  @IsOptional()
  @IsString()
  ispId?: string;

  @ApiProperty({ description: 'Billing period', type: PeriodDto })
  @ValidateNested()
  @Type(() => PeriodDto)
  period: PeriodDto;

  @ApiProperty({
    description: 'Auto-extend options',
    required: false,
    type: AutoExtendDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AutoExtendDto)
  autoExtend?: AutoExtendDto;

  @ApiProperty({
    description: 'Traffic amount (optional)',
    required: false,
    example: 1024,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  traffic?: number;

  @ApiProperty({
    description:
      'Expected price that was displayed to the user (for validation)',
    required: false,
    example: 49.99,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedPrice?: number;
}
