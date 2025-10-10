import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ProxyOrderModule } from 'src/modules/proxy/order/order.module';
import { TransactionModule } from 'src/modules/transaction/transaction.module';
import { WalletModule } from 'src/modules/wallet/wallet.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [AuthModule, TransactionModule, ProxyOrderModule, WalletModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
