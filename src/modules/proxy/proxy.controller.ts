import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ApAuthGuard } from 'src/modules/auth/auth-guard.decorator';
import { ProxyService, PurchaseDto } from './proxy.dto';
import { ProxyServiceLayer } from './proxy.service';

interface AuthenticatedUser {
  uid: string;
  idToken: string;
  email: string;
}

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Proxies')
@ApiBearerAuth()
@Controller('proxies')
export class ProxyController {
  constructor(private readonly proxyService: ProxyServiceLayer) {}

  // --------------------- USER ROUTES --------------------- //

  @Get()
  @ApiOperation({ summary: 'Get available proxy services with markup applied' })
  @ApiResponse({
    status: 200,
    description: 'List of available proxies',
    type: [ProxyServiceLayer],
  })
  @ApiBearerAuth()
  @ApAuthGuard('user')
  async getAvailableProxies(): Promise<ProxyService[]> {
    return this.proxyService.getAvailableProxies();
  }

  @Get(':serviceId/options')
  @ApiOperation({ summary: 'Get options for a specific service/plan' })
  @ApiResponse({
    status: 200,
    description: 'Available options for this service',
  })
  async getServiceOptions(
    @Param('serviceId') serviceId: string,
    @Query('planId') planId?: string,
  ) {
    return this.proxyService.getServiceOptions(serviceId, planId);
  }

  @Post(':serviceId/price')
  @ApiOperation({ summary: 'Get calculated price for a service/plan' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        quantity: { type: 'number', example: 1 },
        period: {
          type: 'object',
          properties: {
            unit: { type: 'string', example: 'months' },
            value: { type: 'number', example: 1 },
          },
        },
      },
      required: ['planId'],
    },
  })
  async getPrice(
    @Param('serviceId') serviceId: string,
    @Body('planId') planId: string,
    @Body('quantity') quantity = 1,
    @Body('period') period = { unit: 'months', value: 1 },
  ) {
    return this.proxyService.getPrice(serviceId, planId, quantity, period);
  }

  @Post('purchase')
  @HttpCode(201)
  @ApiOperation({ summary: 'Purchase a proxy service' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        planId: { type: 'string' },
        quantity: { type: 'number', example: 1 },
        period: {
          type: 'object',
          properties: {
            unit: { type: 'string', example: 'months' },
            value: { type: 'number', example: 1 },
          },
        },
        autoExtend: {
          type: 'object',
          properties: {
            isEnabled: { type: 'boolean', example: true },
            traffic: { type: 'number', example: 5 },
          },
        },
        traffic: { type: 'number', example: 1 },
        country: { type: 'string', example: 'US' },
        ispId: { type: 'string', example: 'isp-1' },
        couponCode: { type: 'string', example: 'DISCOUNT10' },
      },
      required: ['serviceId', 'planId'],
    },
  })
  async purchaseProxy(
    @Req() req: AuthenticatedRequest,
    @Body('serviceId') serviceId: string,
    @Body('planId') planId: string,
    @Body() options: any,
  ): Promise<PurchaseDto> {
    const userId = req.user.uid;
    return this.proxyService.purchaseProxy(userId, serviceId, planId, options);
  }

  @Get('my-purchases')
  @ApiOperation({ summary: 'Get all purchases of the logged-in user' })
  async getMyPurchases(
    @Req() req: AuthenticatedRequest,
  ): Promise<PurchaseDto[]> {
    const userId = req.user.uid;
    return this.proxyService.getUserPurchases(userId);
  }

  // --------------------- ADMIN ROUTES --------------------- //

  @Get('admin/all-purchases')
  @ApiOperation({ summary: 'Get all purchases (Admin only)' })
  async getAllPurchases(): Promise<PurchaseDto[]> {
    return this.proxyService.getAllPurchases();
  }

  @Post('admin/update-markup')
  @ApiOperation({ summary: 'Update pricing markup (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        globalMarkup: { type: 'number', example: 20 },
        perServiceMarkup: {
          type: 'object',
          additionalProperties: { type: 'number' },
          example: { 'service-1': 25, 'service-2': 15 },
        },
      },
      required: ['globalMarkup'],
    },
  })
  async updateMarkup(
    @Body('globalMarkup') globalMarkup: number,
    @Body('perServiceMarkup') perServiceMarkup: Record<string, number>,
  ) {
    return this.proxyService.updateMarkup(globalMarkup, perServiceMarkup);
  }

  @Post('admin/create-config')
  @ApiOperation({ summary: 'Create initial pricing config (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        globalMarkup: { type: 'number', example: 0 },
        perServiceMarkup: {
          type: 'object',
          additionalProperties: { type: 'number' },
          example: { 'service-1': 20, 'service-2': 10 },
        },
      },
    },
  })
  async createConfig(
    @Body('globalMarkup') globalMarkup: number,
    @Body('perServiceMarkup') perServiceMarkup: Record<string, number>,
  ) {
    return this.proxyService.createConfig(globalMarkup, perServiceMarkup);
  }
}
