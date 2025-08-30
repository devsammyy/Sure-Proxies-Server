import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { ProxyServiceLayer } from './proxy.service';

@Module({
  controllers: [ProxyController],
  providers: [ProxyServiceLayer],
})
export class ProxyModule {}
