import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticationTypeDto,
  BandwidthPriceAfterCalcDto,
  ExtendProxyDtoInput,
  ProtocolDto,
  ProxyDto,
} from 'src/modules/proxy/proxy.dto';
import { ApAuthGuard } from '../auth/auth-guard.decorator';
import { UserRole } from '../user/user.model';
import { ProxyService } from './proxy.service';

interface AuthenticatedRequest extends Request {
  user?: {
    uid?: string;
    [key: string]: any;
  };
}

@ApAuthGuard(UserRole.USER)
@ApiBearerAuth('access-token')
@ApiTags('Proxies')
@Controller('proxies')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of active proxies (user-specific)' })
  @ApiResponse({
    status: 200,
    description: 'Available active proxies for the authenticated user',
  })
  async getListOfActiveProxies(
    @Req() req: AuthenticatedRequest,
  ): Promise<ProxyDto[]> {
    // req.user is populated by the ApAuthGuard decorator
    const userId = req?.user?.uid;
    console.log(userId);
    return await this.proxyService.getListOfActiveProxies(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get list of active proxies by id',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The ID of the proxy',
    example: '1234-5678-904D',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns proxy with passed id',
  })
  async getProxyById(@Param('id') id: string) {
    return await this.proxyService.getProxyById(id);
  }

  @Get(':id/cancel')
  @ApiOperation({ summary: 'Cancel proxy by passing id' })
  @ApiOperation({
    description: 'Cancel proxy by passing the id',
  })
  async cancelProxyById(@Param('id') id: string) {
    return await this.proxyService.cancelProxyById(id);
  }

  @Post(':id/extend-period')
  @ApiResponse({
    status: 201,
    description: 'Successfully extended the proxy period',
    type: ProxyDto,
  })
  @ApiOperation({
    summary: 'Extend the duration (periodInMonths) of a proxy by id',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        periodInMonths: { type: 'number', example: 12 },
      },
    },
  })
  async extendProxyPeriod(
    @Param('id') id: string,
    @Body('data') data: ExtendProxyDtoInput,
  ) {
    return await this.proxyService.extendProxyPeriod(id, data);
  }

  @Post(':id/auto-extend')
  @ApiOperation({ summary: 'Enable or disable auto-extend for a proxy' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
      },
    },
  })
  async setAutoExtend(
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req?.user?.uid;
    return await this.proxyService.setAutoExtendForPurchase(
      id,
      userId,
      !!enabled,
    );
  }

  @Post(':id/buy-bandwidth')
  @ApiOperation({ summary: 'Buy additional bandwidth for a proxy' })
  @ApiResponse({ status: 200, type: BandwidthPriceAfterCalcDto })
  async buyBandwidth(
    @Param('id') id: string,
    @Body() data: any,
  ): Promise<BandwidthPriceAfterCalcDto | null> {
    return await this.proxyService.buyBandwidth(id, data);
  }

  // ---- Whitelist IP ----
  @Post(':id/whitelist-ip')
  @ApiOperation({ summary: 'Whitelist an IP for proxy usage' })
  @ApiResponse({ status: 200, type: ProxyDto })
  async whitelistIp(
    @Param('id') id: string,
    @Body() data: any,
  ): Promise<ProxyDto | null> {
    return await this.proxyService.whitelistIp(id, data);
  }

  @Get(':id/change-protocol')
  @ApiOperation({ summary: 'Get available proxy protocols' })
  @ApiResponse({ status: 200, type: ProtocolDto })
  async getProtocols(@Param('id') id: string): Promise<ProtocolDto | null> {
    return await this.proxyService.getProtocols(id);
  }

  @Post(':id/change-protocol')
  @ApiOperation({ summary: 'Change the protocol of a proxy' })
  @ApiResponse({ status: 200, description: 'Protocol changed successfully' })
  async changeProtocol(
    @Param('id') id: string,
    @Body() data: any,
  ): Promise<void> {
    await this.proxyService.changeProtocol(id, data);
  }

  @Post(':id/rotate-ip')
  @ApiOperation({ summary: 'Rotate the IP address of a proxy' })
  @ApiResponse({ status: 200, type: String })
  async rotateIp(
    @Param('id') id: string,
    @Body() data: any,
  ): Promise<string | null> {
    return await this.proxyService.rotateIp(id, data);
  }

  @Get(':id/change-authentication-type')
  @ApiOperation({ summary: 'Get available authentication methods' })
  @ApiResponse({ status: 200, type: AuthenticationTypeDto })
  async getAuthenticationMethods(
    @Param('id') id: string,
  ): Promise<AuthenticationTypeDto | null> {
    return await this.proxyService.getAuthenticationMethods(id);
  }

  @Post(':id/change-authentication-type')
  @ApiOperation({ summary: 'Change authentication method for proxy' })
  @ApiResponse({
    status: 200,
    description: 'Authentication method changed successfully',
  })
  async changeAuthenticationMethod(
    @Param('id') id: string,
    @Body() data: any,
  ): Promise<void> {
    await this.proxyService.changeAuthenticationMethod(id, data);
  }
}
