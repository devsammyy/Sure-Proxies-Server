import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountService } from './account.service';

@ApiTags('Account')
@ApiBearerAuth()
@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Get account balance' })
  @ApiResponse({
    status: 200,
    description: 'Master account Balance',
  })
  async getAccountBalance() {
    return await this.accountService.getAccountBalance();
  }
}
