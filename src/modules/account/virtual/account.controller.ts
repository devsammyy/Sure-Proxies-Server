import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { VirtualAccountResponse } from './account.model';
import { VirtualAccountService } from './account.service';

@ApiTags('Virtual Accounts')
@Controller('virtual-accounts')
export class VirtualAccountController {
  constructor(private readonly virtualAccountService: VirtualAccountService) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Get virtual account by userId' })
  @ApiParam({
    name: 'userId',
    description: 'User ID linked to the virtual account',
  })
  @ApiResponse({
    status: 200,
    description: 'Virtual account details',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Virtual account not found' })
  async getVirtualAccount(
    @Param('userId') userId: string,
  ): Promise<VirtualAccountResponse | null> {
    return this.virtualAccountService.getVirtualAccountByUserId(userId);
  }
}
