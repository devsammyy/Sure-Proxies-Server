import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { PaymentpointModule } from 'src/modules/paymentpoint/paymentpoint.module';
import { ProxyOrderController } from 'src/modules/proxy/order/order.controller';
import { ProxyOrderService } from 'src/modules/proxy/order/order.service';
import { TransactionModule } from 'src/modules/transaction/transaction.module';

@Module({
  imports: [AuthModule, TransactionModule, PaymentpointModule],
  controllers: [ProxyOrderController],
  providers: [ProxyOrderService, ProxyOrderController],
  exports: [ProxyOrderService],
})
export class ProxyOrderModule {}
