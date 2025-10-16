import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UptimePointDto {
  @IsDateString()
  date: string;

  @IsOptional()
  value: number | null;
}

export class UptimeDto {
  @IsDateString()
  updatedAt: string;

  @IsArray()
  data: UptimePointDto[];
}

export class TrafficPointDto {
  @IsDateString()
  date: string;

  @IsInt()
  value: number;
}

export class TrafficDto {
  @IsDateString()
  updatedAt: string;

  @IsArray()
  data: TrafficPointDto[];
}

export class AuthenticationDto {
  @IsArray()
  @IsString({ each: true })
  whitelistedIps: string[];

  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class ConnectionHostnamesDto {
  [key: string]: string;
}

export class ConnectionDto {
  @IsOptional()
  publicIp?: string | null;

  @IsOptional()
  connectIp?: string | null;

  @IsOptional()
  @IsString()
  ipVersion?: string;

  @IsOptional()
  lastIp?: string | null;

  @IsOptional()
  httpPort?: number | null;

  @IsOptional()
  httpsPort?: number | null;

  @IsOptional()
  socks5Port?: number | null;

  @IsOptional()
  hostnames?: ConnectionHostnamesDto[];
}

export class MetadataDto {
  @IsOptional()
  ispName?: string | null;

  @IsOptional()
  orderId?: string;
}

export class BandwidthDto {
  @IsOptional()
  total?: number | null;

  @IsOptional()
  used?: number | null;

  @IsOptional()
  @IsDateString()
  updatedAt?: string;
}

export class UplinkOrThreadsDto {
  @IsInt()
  value: number;

  @IsString()
  label: string;
}

export class ProxyDto {
  // top-level metadata often returned by provider
  @IsOptional()
  @IsDateString()
  activatedAt?: string;

  @IsOptional()
  @IsDateString()
  canceledAt?: string | null;

  @IsOptional()
  @IsDateString()
  updatedAt?: string;

  @IsOptional()
  @IsBoolean()
  autoExtendEnabled?: boolean;

  @IsOptional()
  autoExtendBandwidthAmount?: number | null;

  @IsOptional()
  @IsDateString()
  autoExtendAt?: string | null;

  @IsArray()
  routes: any[];

  @IsString()
  type: string;

  @IsString()
  plan: string;

  @IsOptional()
  uptime?: UptimeDto;

  @IsOptional()
  traffic?: TrafficDto;

  // provider id is numeric in example but can be string; allow both
  id: number | string;

  status: string;

  networkType?: string;

  authentication?: AuthenticationDto;

  connection?: ConnectionDto;

  proxyType?: string;

  @IsOptional()
  @IsDateString()
  createdAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  metadata?: MetadataDto;

  @IsOptional()
  bandwidth?: BandwidthDto;

  @IsOptional()
  uplinkSpeed?: UplinkOrThreadsDto;

  @IsOptional()
  threads?: UplinkOrThreadsDto;

  @IsOptional()
  location?: { countryCode?: string | null; regionCode?: string | null };

  @IsOptional()
  note?: string | null;

  @IsArray()
  actions: string[];

  @IsOptional()
  maintenanceWindows?: any[];
}

export class BandwidthPriceAfterCalcDto {
  @IsInt()
  finalPrice: number;
  @IsInt()
  priceNoDiscounts: number;
  @IsInt()
  discount: number;
}

export class ProtocolDto {
  @IsString()
  currentType: string;

  @IsArray()
  availableTypes: string[];
}

export class AuthenticationTypeDto {
  @IsString()
  currentAuthenticationType: string;

  @IsArray()
  availableAuthenticationTypes: string[];
}

export class ExtendProxyDtoInput {
  @IsString({
    message: 'ProxyInMonth',
  })
  periodInMonths: string;
}
