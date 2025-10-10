import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { DepositRequest, WithdrawalRequest } from './wallet.model';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getWallet(@Request() req: any) {
    const userId = req.user.uid as string;
    return this.walletService.getOrCreateWallet(userId);
  }

  @Get('transactions')
  getTransactions(@Request() req: any) {
    const userId = req.user.uid as string;
    return this.walletService.getTransactions(userId);
  }

  @Post('deposit/initiate')
  initiateDeposit(@Request() req: any, @Body() depositRequest: DepositRequest) {
    const userId = req.user.uid as string;
    return this.walletService.initiateDeposit(userId, depositRequest.amount);
  }

  @Post('withdraw')
  requestWithdrawal(
    @Request() req: any,
    @Body() withdrawalRequest: WithdrawalRequest,
  ) {
    const userId = req.user.uid as string;
    return this.walletService.requestWithdrawal(userId, withdrawalRequest);
  }
}
