import { Module } from '@nestjs/common';
import { VirtualAccountController } from 'src/modules/account/virtual/account.controller';
import { AuthModule } from 'src/modules/auth/auth.module';
import { VirtualAccountService } from './account.service';

@Module({
  imports: [AuthModule],
  controllers: [VirtualAccountController],
  providers: [VirtualAccountService, VirtualAccountController],
})
export class VirtualAccountModule {}
