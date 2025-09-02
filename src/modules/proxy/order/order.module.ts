import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ProxyOrderController } from 'src/modules/proxy/order/order.controller';
import { ProxyOrderService } from 'src/modules/proxy/order/order.service';

@Module({
  imports: [AuthModule],
  controllers: [ProxyOrderController],
  providers: [ProxyOrderService],
})
export class ProxyOrderModule {}
