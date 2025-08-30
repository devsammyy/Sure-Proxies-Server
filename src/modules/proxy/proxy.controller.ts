import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
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
@Controller('proxies')
export class ProxyController {
  constructor(private readonly proxyService: ProxyServiceLayer) {}

  // --------------------- USER ROUTES --------------------- //
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Get available proxy services with applied markup' })
  @ApiResponse({
    status: 200,
    description: 'List of proxies',
    type: [ProxyServiceLayer],
  })
  async getAvailableProxies(): Promise<ProxyService[]> {
    return this.proxyService.getAvailableProxies();
  }

  @ApiBearerAuth()
  @Post('purchase')
  @HttpCode(201)
  @ApiOperation({ summary: 'Purchase a proxy service' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        planId: { type: 'string' },
      },
      required: ['serviceId', 'planId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Purchase successful',
  })
  async purchaseProxy(
    @Req() req: AuthenticatedRequest,
    @Body('serviceId') serviceId: string,
    @Body('planId') planId: string,
  ): Promise<PurchaseDto> {
    const userId = req.user.uid;
    return this.proxyService.purchaseProxy(userId, serviceId, planId);
  }
  @ApiBearerAuth()
  @Get('my-purchases')
  @ApiOperation({ summary: 'Get all purchases of the logged-in user' })
  @ApiResponse({
    status: 200,
    description: 'User purchases',
  })
  async getMyPurchases(
    @Req() req: AuthenticatedRequest,
  ): Promise<PurchaseDto[]> {
    const userId = req.user.uid;
    return this.proxyService.getUserPurchases(userId);
  }

  @ApiBearerAuth()
  @Get('admin/all-purchases')
  @ApiOperation({ summary: 'Get all purchases (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'All purchases',
  })
  async getAllPurchases(): Promise<PurchaseDto[]> {
    return this.proxyService.getAllPurchases();
  }

  @ApiBearerAuth()
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
  @ApiResponse({ status: 200, description: 'Markup updated successfully' })
  async updateMarkup(
    @Body('globalMarkup') globalMarkup: number,
    @Body('perServiceMarkup') perServiceMarkup: Record<string, number>,
  ) {
    return this.proxyService.updateMarkup(globalMarkup, perServiceMarkup);
  }

  @ApiBearerAuth()
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
  @ApiResponse({
    status: 201,
    description: 'Pricing config created successfully',
  })
  async createConfig(
    @Body('globalMarkup') globalMarkup: number,
    @Body('perServiceMarkup') perServiceMarkup: Record<string, number>,
  ) {
    return this.proxyService.createConfig(globalMarkup, perServiceMarkup);
  }
}
