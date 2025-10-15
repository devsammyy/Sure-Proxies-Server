import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ApAuthGuard } from 'src/modules/auth/auth-guard.decorator';
import { UserRole } from 'src/modules/user/user.model';

import { PriceInputDto, PurchaseOrderInputDto } from './order.dto';
import { ProxyOrderModel, PurchaseOrderModel } from './order.model';
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
  @ApiOperation({
    summary:
      'Get a list of order services (emphasis on the services) available for purchase',
  })
  @ApiResponse({
    status: 200,
    description:
      'This endpoint is the entry point to the whole ordering process. It returns the list of orderable services, and optionally their plans when supported. The service and plan identifiers are required to be included within payloads of all the remaining endpoints: setup, price & execute.',
    isArray: true,
    type: [ProxyOrderModel],
  })
  async getAvailableProxies(): Promise<ProxyOrderModel[]> {
    return this.proxyOrderService.getAvailableProxiesServices();
  }

  @Get(':serviceId/options')
  @ApiOperation({
    summary: 'Available options to the service',
  })
  @ApiResponse({
    status: 200,
    description:
      "This allows you to fetch all the order properties available for the selected service. Some of the services might require a planId - refer to the plans available under the specific service in the /proxy_order endpoint. Each service might be described by different properties, so you shouldn't assume they all work the same way.",
  })
  @ApiParam({
    name: 'planId',
    required: false,
  })
  async getServiceOptions(
    @Param('serviceId') serviceId: string,
    @Query('planId') planId?: string,
  ) {
    return this.proxyOrderService.getServiceOptions(serviceId, planId);
  }

  @Post(':serviceId/price')
  @ApiOperation({
    summary: 'Api to get price of a service',
  })
  @ApiBody({
    type: PriceInputDto,
  })
  @ApiResponse({
    description:
      'This endpoint allows to get a price for the selected configuration for a particular service. The response contains information about the total, subtotal, markups, discounts & unit prices.',
  })
  async getPrice(
    @Param('serviceId') serviceId: string,
    @Body() model: PriceInputDto,
  ) {
    return this.proxyOrderService.getPrice(serviceId, model);
  }

  @Post(':serviceId/purchase')
  @ApiBody({
    description: 'Enter the options',
    type: PurchaseOrderInputDto,
  })
  purchase(
    @Param('serviceId') serviceId: string,
    @Body('model') model: PurchaseOrderInputDto,
  ) {
    return this.proxyOrderService.purchaseProxy(serviceId, model);
  }

  @Post('finalize/:transactionId')
  @ApiOperation({ summary: 'Finalize a pending purchase by transactionId' })
  async finalizePurchase(@Param('transactionId') transactionId: string) {
    return this.proxyOrderService.finalizePurchase(transactionId);
  }

  @Get('my-purchases')
  @ApAuthGuard(UserRole.USER)
  @ApiOperation({ summary: 'Get all purchases of the logged-in user' })
  async getMyPurchases(
    @Req() req: AuthenticatedRequest,
  ): Promise<PurchaseOrderModel[]> {
    const userId = req.user.uid;
    return this.proxyOrderService.getUserPurchases(userId);
  }

  // --------------------- ADMIN ROUTES --------------------- //

  @Get('admin/all-purchases')
  @ApiOperation({ summary: 'Get all purchases (Admin only)' })
  async getAllPurchases(): Promise<PurchaseOrderModel[]> {
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

  @Get('admin/config')
  @ApAuthGuard(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pricing config (Admin only)' })
  async getConfig() {
    return this.proxyOrderService.getPricingConfig();
  }

  @Get('admin/provider-mappings')
  @ApAuthGuard(UserRole.ADMIN)
  @ApiOperation({ summary: 'List provider -> user mappings (Admin only)' })
  async listProviderMappings(@Query('limit') limit?: string): Promise<any> {
    const l = limit ? parseInt(limit, 10) : undefined;
    return await this.proxyOrderService.getProviderMappings(l);
  }

  @Get('admin/provider-mappings/:providerId')
  @ApAuthGuard(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get a provider mapping by providerId (Admin only)',
  })
  async getProviderMapping(@Param('providerId') providerId: string) {
    return this.proxyOrderService.getProviderMapping(providerId);
  }

  @Post('admin/provider-mappings/:providerId/claim')
  @ApAuthGuard(UserRole.ADMIN)
  @ApiOperation({ summary: 'Claim a provider mapping (Admin only)' })
  async claimProviderMapping(
    @Param('providerId') providerId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user?.uid || 'unknown-admin';
    return this.proxyOrderService.claimProviderMapping(providerId, adminId);
  }
}
