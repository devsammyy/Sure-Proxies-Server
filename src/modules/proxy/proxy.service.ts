import { Injectable } from '@nestjs/common';
import { ApiClient } from 'src/common/api/api-client';
import {
  AuthenticationTypeDto,
  BandwidthPriceAfterCalcDto,
  ExtendProxyDtoInput,
  ProtocolDto,
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

  async getProxyById(id: any): Promise<ProtocolDto | null> {
    try {
      const proxies = await this.apiClient.get<ProtocolDto | null>(`/${id}`);
      return proxies || null;
    } catch (error) {
      console.error('Error fetching proxy: ', error);
      return null;
    }
  }

  async cancelProxyById(id: string): Promise<void> {
    try {
      await this.apiClient.get<void>(`/${id}/cancel`);
    } catch (error) {
      console.error('Error cancelling proxy: ', error);
    }
  }

  async extendProxyPeriod(
    id: string,
    data: ExtendProxyDtoInput,
  ): Promise<ProxyDto | null> {
    try {
      const response = await this.apiClient.post<ProxyDto>(
        `/${id}/extend-period`,
        data,
      );
      return response || null;
    } catch (error) {
      console.error('Error extending proxy period: ', error);
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
      console.error('Failed to whitelist the ip: ', error);
      return null;
    }
  }

  async getProtocols(id: any): Promise<ProtocolDto | null> {
    try {
      const proxies = await this.apiClient.get<ProtocolDto | null>(
        `/${id}/change-protocol`,
      );
      return proxies || null;
    } catch (error) {
      console.error('Error fetching protocol: ', error);
      return null;
    }
  }

  async changeProtocol(id: string, data: any): Promise<void> {
    try {
      await this.apiClient.post<void>(`/${id}/change-protocol`, data);
    } catch (error) {
      console.error('Failed to changing protocol: ', error);
    }
  }

  async rotateIp(id: string, data: any): Promise<string | null> {
    try {
      const response = await this.apiClient.post<string | null>(
        `/${id}/rotate-ip`,
        data,
      );
      return response || null;
    } catch (error) {
      console.error('Failed to rotate IP: ', error);
      return null;
    }
  }

  async getAuthenticationMethods(
    id: any,
  ): Promise<AuthenticationTypeDto | null> {
    try {
      const proxies = await this.apiClient.get<AuthenticationTypeDto | null>(
        `/${id}/change-authentication-type`,
      );
      return proxies || null;
    } catch (error) {
      console.error('Error fetching method: ', error);
      return null;
    }
  }

  async changeAuthenticationMethod(id: string, data: any): Promise<void> {
    try {
      await this.apiClient.post<void>(
        `/${id}/change-authentication-type`,
        data,
      );
    } catch (error) {
      console.error('Failed to changing auth method: ', error);
    }
  }
}
