import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ProxyOrderController } from 'src/modules/proxy/order/order.controller';
import { ProxyOrderService } from 'src/modules/proxy/order/order.service';
import { TransactionModule } from 'src/modules/transaction/transaction.module';

@Module({
  imports: [AuthModule, TransactionModule],
  controllers: [ProxyOrderController],
  providers: [ProxyOrderService, ProxyOrderController],
  exports: [ProxyOrderService],
})
export class ProxyOrderModule {}
