import { Module } from '@nestjs/common';
import { VirtualAccountModule } from 'src/modules/account/virtual/account.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [AuthModule, VirtualAccountModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
