import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountModule } from 'src/modules/account/account.module';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ProxyOrderModule } from 'src/modules/proxy/order/order.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProxyModule } from './modules/proxy/proxy.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    UserModule,
    AuthModule,
    ProxyModule,
    ProxyOrderModule,
    AccountModule,
  ],
  controllers: [AppController],
  providers: [AppService, AuthGuard],
})
export class AppModule {}
