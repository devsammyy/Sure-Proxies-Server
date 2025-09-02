import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProxyService } from './proxy.service';

@ApiTags('Proxies')
@ApiBearerAuth()
@Controller('proxies')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of active proxies' })
  @ApiResponse({
    status: 200,
    description: 'Available active proxies',
  })
  async getListOfActiveProxies() {
    return await this.proxyService.getListOfActiveProxies();
  }
}
