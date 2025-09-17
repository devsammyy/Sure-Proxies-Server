import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [AuthModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
