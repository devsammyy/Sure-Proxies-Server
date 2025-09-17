import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';

import { PaymentpointService } from './paymentpoint.service';

@Module({
  imports: [AuthModule],
  providers: [PaymentpointService],
  exports: [PaymentpointService],
})
export class PaymentpointModule {}
