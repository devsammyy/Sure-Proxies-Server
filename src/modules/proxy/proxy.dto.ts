import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsIP,
  IsOptional,
  IsString,
} from 'class-validator';

export class AuthenticationDto {
  @IsArray()
  @IsString({ each: true })
  whitelistedIps: string[];

  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class ConnectionDto {
  @IsIP('4')
  publicIp: string;

  @IsString()
  connectIp: string;

  @IsInt()
  httpPort: number;

  @IsInt()
  httpsPort: number;

  @IsInt()
  socks5Port: number;
}

export class MetadataDto {
  @IsString()
  ispName: string;
}

export class ProxyDto {
  @IsString()
  id: string;

  @IsEnum(['ACTIVE', 'CANCELED', 'PENDING', 'EXPIRED'], {
    message: 'status must be one of: ACTIVE, CANCELED, PENDING, EXPIRED',
  })
  status: string;

  @IsEnum(['RESIDENTIAL', 'DATACENTER', 'MOBILE'], {
    message: 'networkType must be one of: RESIDENTIAL, DATACENTER, MOBILE',
  })
  networkType: string;

  authentication: AuthenticationDto;

  connection: ConnectionDto;

  @IsEnum(['HTTP', 'HTTPS', 'SOCKS5'], {
    message: 'proxyType must be one of: HTTP, HTTPS, SOCKS5',
  })
  proxyType: string;

  @IsDateString()
  createdAt: string;

  @IsDateString()
  expiresAt: string;

  @IsOptional()
  metadata?: MetadataDto;
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
  @IsEnum(['HTTP', 'HTTPS', 'SOCKS5'], {
    message: 'currentType must be one of: HTTP, HTTPS, SOCKS5',
  })
  currentType: string;

  @IsArray()
  @IsEnum(['HTTP', 'SOCKS5'], { each: true })
  availableTypes: string[];
}

export class AuthenticationTypeDto {
  @IsEnum(['IP_WHITELIST', 'USERNAME_PASSWORD'], {
    message:
      'currentAuthenticationType must be one of: IP_WHITELIST, USERNAME_PASSWORD',
  })
  currentAuthenticationType: string;

  @IsArray()
  @IsEnum(['IP_WHITELIST', 'USERNAME_PASSWORD'], { each: true })
  availableAuthenticationTypes: string[];
}
