import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
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

  async getListOfActiveProxies(userId?: string): Promise<ProxyDto[]> {
    try {
      const raw = await this.apiClient.get<ProxyDto[]>('');
      console.log(JSON.stringify(raw), 'Rawwwwww');
      // Normalize provider response into an array of ProxyDto
      let proxiesArray: ProxyDto[] = [];
      if (!raw) {
        proxiesArray = [];
      } else if (Array.isArray(raw)) {
        proxiesArray = raw;
      } else if (typeof raw === 'object') {
        // try common envelope shapes: { data: [...] } or { proxies: [...] }
        // use safe casts and checks
        const obj = raw as Record<string, unknown>;
        const maybeData = obj['data'];
        const maybeProxies = obj['proxies'];
        if (Array.isArray(maybeData)) proxiesArray = maybeData as ProxyDto[];
        else if (Array.isArray(maybeProxies))
          proxiesArray = maybeProxies as ProxyDto[];
        else proxiesArray = [];
      } else {
        proxiesArray = [];
      }

      // Ensure we preserve hostnames if provider returned them under alternate keys
      proxiesArray = proxiesArray.map((rawP) => {
        const p = rawP as Record<string, any>;
        try {
          const conn = (p && (p.connection as Record<string, any>)) || {};
          // common alternate locations for hostnames
          const altHostnames: Record<string, string> | null =
            (p?.hostnames as Record<string, string>) ||
            (p?.connectionHostnames as Record<string, string>) ||
            (p?.hostnamesMap as Record<string, string>) ||
            null;
          if (!conn.hostnames && altHostnames) {
            conn.hostnames = altHostnames;
          }
          // If hostnames exist nested under connection.hostnames as an object, keep as-is
          p.connection = conn;
        } catch {
          // ignore
        }
        return p as ProxyDto;
      });

      // If no userId provided return everything we have
      if (!userId) return proxiesArray;

      // Fetch all purchases for this user
      const db = admin.firestore();
      const purchasesSnap = await db
        .collection('purchases')
        .where('userId', '==', userId)
        .get();
      const providerOrderIds = new Set(
        purchasesSnap.docs
          .map((doc) => {
            const data = doc.data() as {
              providerOrderId?: string;
              id?: string;
            };
            return data.providerOrderId ?? data.id;
          })
          .filter((id): id is string => typeof id === 'string'),
      );

      const userProxies = proxiesArray.filter(
        (proxy) =>
          typeof proxy?.metadata?.orderId === 'string' &&
          providerOrderIds.has(proxy.metadata.orderId),
      );
      return userProxies ?? [];
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

  async setAutoExtendForPurchase(
    id: string,
    userId?: string,
    enabled = true,
  ): Promise<{ success: boolean } | null> {
    try {
      // fetch proxy to obtain metadata.orderId
      const proxy = (await this.apiClient.get<Record<string, unknown>>(
        `/${id}`,
      )) as Record<string, any> | null;
      const orderId = proxy
        ? (proxy['metadata'] as Record<string, string>)?.['orderId']
        : undefined;

      const db = admin.firestore();
      // query purchases for the user
      const purchasesSnap = await db
        .collection('purchases')
        .where('userId', '==', userId)
        .get();

      let updated = false;
      for (const doc of purchasesSnap.docs) {
        const data = doc.data() as Record<string, unknown>;
        const providerOrderId =
          (data['providerOrderId'] as string) ?? (data['id'] as string);
        if (!providerOrderId) continue;
        if (orderId && providerOrderId === orderId) {
          await doc.ref.update({ autoExtend: enabled });
          updated = true;
          break;
        }
        // fallback: if id matches stringified proxy id
        if (!orderId && String(data['id']) === String(id)) {
          await doc.ref.update({ autoExtend: enabled });
          updated = true;
          break;
        }
      }

      return { success: updated };
    } catch (error) {
      console.error('Failed to set autoExtend: ', error);
      return null;
    }
  }
}
