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
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApAuthGuard } from 'src/modules/auth/auth-guard.decorator';
import { UserRole } from 'src/modules/user/user.model';
import { ProxyOrderDto, PurchaseOrderDto } from './order.dto';
import { ProxyOrderService } from './order.service';

interface AuthenticatedUser {
  uid: string;
  idToken: string;
  email: string;
}

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

// @ApAuthGuard()
@ApiTags('Proxy Order')
@Controller('proxy_order')
export class ProxyOrderController {
  constructor(private readonly proxyOrderService: ProxyOrderService) {}

  @Get()
  @ApiOperation({ summary: 'Get available proxy services with markup applied' })
  @ApiResponse({
    status: 200,
    description: 'List of available proxies',
    type: [ProxyOrderService],
  })
  async getAvailableProxies(
    @Query('country') country: string,
  ): Promise<ProxyOrderDto[]> {
    return this.proxyOrderService.getAvailableProxies(country || 'US');
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
    return this.proxyOrderService.getServiceOptions(serviceId, planId);
  }

  @Post(':serviceId/price')
  @ApiOperation({ summary: 'Get calculated price for a service/plan' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        country: { type: 'string' },
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
    @Body('country') country: string,
    @Body('quantity') quantity = 1,
    @Body('period') period = { unit: 'months', value: 1 },
  ) {
    return this.proxyOrderService.getPrice(
      serviceId,
      planId,
      country,
      quantity,
      period,
    );
  }

  @Post('purchase')
  @HttpCode(201)
  @ApAuthGuard(UserRole.USER)
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
    @Body()
    options: {
      quantity?: number;
      period?: { unit: string; value: number };
      autoExtend?: { isEnabled: boolean; traffic?: number };
      traffic?: number;
      country?: string;
      ispId?: string;
      couponCode?: string;
    },
  ): Promise<PurchaseOrderDto> {
    const userId = req.user.uid;
    return this.proxyOrderService.purchaseProxy(
      userId,
      serviceId,
      planId,
      options,
    );
  }

  @Get('my-purchases')
  @ApAuthGuard(UserRole.USER)
  @ApiOperation({ summary: 'Get all purchases of the logged-in user' })
  async getMyPurchases(
    @Req() req: AuthenticatedRequest,
  ): Promise<PurchaseOrderDto[]> {
    const userId = req.user.uid;
    return this.proxyOrderService.getUserPurchases(userId);
  }

  // --------------------- ADMIN ROUTES --------------------- //

  @Get('admin/all-purchases')
  @ApiOperation({ summary: 'Get all purchases (Admin only)' })
  async getAllPurchases(): Promise<PurchaseOrderDto[]> {
    return this.proxyOrderService.getAllPurchases();
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
    return this.proxyOrderService.updateMarkup(globalMarkup, perServiceMarkup);
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
    return this.proxyOrderService.createConfig(globalMarkup, perServiceMarkup);
  }
}
