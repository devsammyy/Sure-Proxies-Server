import { Injectable } from '@nestjs/common';
import { ApiClient } from 'src/common/api/api-client';
import { AccountBalanceDto } from './account.dto';

@Injectable()
export class AccountService {
  private readonly apiBaseUrl = 'https://api.proxy-cheap.com/account/balance';
  private readonly apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient(this.apiBaseUrl);
  }

  async getAccountBalance(): Promise<AccountBalanceDto | null> {
    try {
      const balance = await this.apiClient.get<AccountBalanceDto | null>('');
      return balance || null;
    } catch (error) {
      console.error('Error fetching account balance: ', error);
      return null;
    }
  }
}
