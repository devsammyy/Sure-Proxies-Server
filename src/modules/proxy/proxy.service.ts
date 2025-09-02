import { Injectable } from '@nestjs/common';
import { ApiClient } from 'src/common/api/api-client';
import {
  BandwidthPriceAfterCalcDto,
  ProxyDto,
} from 'src/modules/proxy/proxy.dto';

@Injectable()
export class ProxyService {
  private readonly apiBaseUrl = 'https://api.proxy-cheap.com/proxies';
  private readonly apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient(this.apiBaseUrl);
  }

  async getListOfActiveProxies(): Promise<ProxyDto[]> {
    try {
      const proxies = await this.apiClient.get<ProxyDto[]>('');
      return proxies ?? [];
    } catch (error) {
      console.error('Error fetching proxies: ', error);
      return [];
    }
  }

  async cancelProxyById(id: string): Promise<void> {
    try {
      await this.apiClient.get<void>(`/${id}/cancel`);
    } catch (error) {
      console.error('Error fetching proxies: ', error);
    }
  }

  async extendProxyPeriod(id: string, data: any): Promise<ProxyDto | null> {
    try {
      const response = await this.apiClient.post<ProxyDto>(
        `/${id}/extend-period`,
        data,
      );
      return response || null;
    } catch (error) {
      console.error('Error fetching proxies: ', error);
      return null;
    }
  }

  async buyBandwidth(
    id: string,
    data: any,
  ): Promise<BandwidthPriceAfterCalcDto | null> {
    try {
      const response =
        await this.apiClient.post<BandwidthPriceAfterCalcDto | null>(
          `/${id}/buy-bandwidth`,
          data,
        );
      return response || null;
    } catch (error) {
      console.error('Failed to buy bandwidth: ', error);
      return null;
    }
  }

  async whitelistIp(id: string, data: any): Promise<ProxyDto | null> {
    try {
      const response = await this.apiClient.post<ProxyDto | null>(
        `/${id}/whitelist-ip`,
        data,
      );
      return response || null;
    } catch (error) {
      console.error('Failed to buy bandwidth: ', error);
      return null;
    }
  }

  async getProtocols(id: any): Promise<ProxyDto | null> {
    try {
      const proxies = await this.apiClient.get<ProxyDto | null>(
        `/${id}/change-protocol`,
      );
      return proxies || null;
    } catch (error) {
      console.error('Error fetching proxies: ', error);
      return null;
    }
  }
}
