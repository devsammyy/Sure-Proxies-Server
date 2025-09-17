// webhook.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhookService {
  async processTransaction(data: any) {
    // Save to database
    // Example:
    // await this.transactionRepository.save({
    //   id: data.transaction_id,
    //   status: data.transaction_status,
    //   amount: data.amount_paid,
    // });
    console.log('Processing transaction:', await data);
  }
}
