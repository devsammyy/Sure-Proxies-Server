import { Injectable } from '@nestjs/common';
import { ApiClient } from 'src/common/api/api-client';

@Injectable()
export class PaymentpointService {
  private readonly apiBaseUrl = process.env.PAYMENTPOINT_BASEURL!;

  private readonly paymentPointBusinessId =
    process.env.PAYMENTPOINT_BUSINESS_ID;

  private readonly apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient(this.apiBaseUrl);
  }

  async createVirtualAccount(customer: {
    email: string;
    name: string;
    phoneNumber: string;
  }) {
    const body = {
      email: customer.email,
      name: customer.name,
      phoneNumber: customer.phoneNumber,
      bankCode: ['20946', '20897'],
      businessId: this.paymentPointBusinessId,
    };

    console.log('[PaymentPoint] Creating virtual account with body:', body);

    try {
      const response = await this.apiClient.postPaymentPoint(
        '/createVirtualAccount',
        body,
      );
      console.log(
        '[PaymentPoint] createVirtualAccount API response:',
        response,
      );
      return response;
    } catch (error) {
      console.error('[PaymentPoint] Error creating virtual account:', error);
      throw error;
    }
  }
}
