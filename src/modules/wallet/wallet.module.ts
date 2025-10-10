import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TransactionModule } from '../transaction/transaction.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [TransactionModule, AuthModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
