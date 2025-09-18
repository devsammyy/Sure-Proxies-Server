import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { VirtualAccountService } from './account.service';

@Module({
  imports: [AuthModule],
  controllers: [],
  providers: [VirtualAccountService],
})
export class VirtualAccountModule {}
