import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ProxyController } from './proxy.controller';
import { ProxyServiceLayer } from './proxy.service';

@Module({
  imports: [AuthModule],
  controllers: [ProxyController],
  providers: [ProxyServiceLayer],
})
export class ProxyModule {}
