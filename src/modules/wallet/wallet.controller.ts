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
  getWallet(@Request() req: { user: { uid: string } }) {
    const userId = req.user.uid;
    return this.walletService.getOrCreateWallet(userId);
  }

  @Get('transactions')
  getTransactions(@Request() req: { user: { uid: string } }) {
    const userId = req.user.uid;
    return this.walletService.getTransactions(userId);
  }

  @Post('deposit/initiate')
  initiateDeposit(
    @Request() req: { user: { uid: string } },
    @Body() depositRequest: DepositRequest,
  ) {
    const userId = req.user.uid;
    return this.walletService.initiateDeposit(userId, depositRequest.amount);
  }

  @Post('withdraw')
  requestWithdrawal(
    @Request() req: { user: { uid: string } },
    @Body() withdrawalRequest: WithdrawalRequest,
  ) {
    const userId = req.user.uid;
    return this.walletService.requestWithdrawal(userId, withdrawalRequest);
  }
}
