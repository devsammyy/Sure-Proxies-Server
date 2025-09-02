/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { db, dbFireStore } from 'src/main';
import {
  PriceResponse,
  ServiceDetailsResponse,
} from 'src/modules/proxy/order/order.model';
import { ProxyOrderDto, PurchaseOrderDto } from './order.dto';

@Injectable()
export class ProxyOrderService {
  private readonly apiBaseUrl = 'https://api.proxy-cheap.com/v2/order';

  constructor() {}

  /** Fetch pricing config from Firestore */
  private async getPricingConfig() {
    try {
      const configDoc = await db.collection('config').doc('pricing').get();
      if (!configDoc.exists) return { globalMarkup: 0, perServiceMarkup: {} };
      return configDoc.data();
    } catch (error) {
      console.error('Error fetching pricing config:', error);
      throw new HttpException(
        'Failed to fetch pricing configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Apply markup to base price */
  private applyMarkup(
    basePrice: number,
    serviceId: string,
    config: any,
  ): number {
    const markup =
      config?.perServiceMarkup?.[serviceId] ?? config?.globalMarkup ?? 0;
    return Math.round(basePrice * (1 + markup / 100));
  }

  /** Create default pricing config */
  async createConfig(
    globalMarkup = 0,
    perServiceMarkup: Record<string, number> = {},
  ) {
    try {
      const configRef = db.collection('config').doc('pricing');
      const configDoc = await configRef.get();
      if (configDoc.exists) {
        await configRef.update({ globalMarkup, perServiceMarkup });
        return { success: true, message: 'Config updated successfully' };
      } else {
        await configRef.set({ globalMarkup, perServiceMarkup });
        return { success: true, message: 'Config updated successfully' };
      }
    } catch (error) {
      console.error('Error creating pricing config:', error);
      throw new HttpException(
        'Failed to create pricing configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Fetch all proxy services */
  async getAvailableProxies(country: string = 'US'): Promise<ProxyOrderDto[]> {
    try {
      const response = await axios.get(this.apiBaseUrl);
      if (response.status !== 200) {
        throw new Error('Failed to fetch proxy services');
      }

      const services: ProxyOrderDto[] = response?.data?.services;

      // 2. Load pricing config
      const pricingConfig = await this.getPricingConfig();

      // 3. For each service & plan, fetch price from API and apply markup
      for (const service of services) {
        for (const plan of service?.plans ?? []) {
          try {
            const priceData = await this.getPrice(
              service?.id,
              plan?.id,
              country,
              1, // default quantity = 1
              { unit: 'months', value: 1 }, // default period
            );

            // API gives `finalPrice` or `unitPrice`
            const basePrice =
              priceData?.finalPrice ?? priceData?.unitPrice ?? 0;

            // apply markup
            plan.basePrice = this.applyMarkup(
              basePrice,
              service.id,
              pricingConfig,
            );
          } catch (err) {
            console.warn(
              `Could not fetch price for service ${service.id}, plan ${plan.id}`,
              err.message,
            );
            plan.basePrice = 0;
          }
        }
      }

      return services;
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Failed to fetch proxies',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** Fetch options for a specific service */
  async getServiceOptions(serviceId: string, planId?: string) {
    try {
      const response = await axios.post<ServiceDetailsResponse>(
        `${this.apiBaseUrl}/${serviceId}`,
        {
          planId,
        },
      );
      return response.data;
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Failed to fetch service options',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** Get price from Proxy-Cheap API */
  async getPrice(
    serviceId: string,
    planId: string,
    country = 'US',
    quantity = 1,
    period = { unit: 'months', value: 1 },
  ) {
    try {
      const response = await axios.post<PriceResponse>(
        `${this.apiBaseUrl}/${serviceId}/price`,
        {
          planId,
          country,
          quantity,
          period,
        },
      );
      return response?.data; // contains finalPrice, unitPrice, etc.
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to fetch price', HttpStatus.BAD_GATEWAY);
    }
  }

  /** Purchase a proxy (full API compliance) */
  async purchaseProxy(
    userId: string,
    serviceId: string,
    planId: string,
    options: {
      quantity?: number;
      period?: { unit: string; value: number };
      autoExtend?: { isEnabled: boolean; traffic?: number };
      traffic?: number;
      country?: string;
      ispId?: string;
      couponCode?: string;
    } = {},
  ): Promise<PurchaseOrderDto> {
    try {
      const pricingConfig = await this.getPricingConfig();

      // 1. Fetch price
      const priceData = await this.getPrice(
        serviceId,
        planId,
        options.country || 'US',
        options.quantity ?? 1,
        options.period ?? { unit: 'months', value: 1 },
      );
      const apiPrice = priceData.finalPrice;
      const priceWithMarkup = this.applyMarkup(
        apiPrice,
        serviceId,
        pricingConfig,
      );

      // 2. Execute order
      const executeResponse = await axios.post(
        `${this.apiBaseUrl}/${serviceId}/execute`,
        {
          planId,
          quantity: options.quantity ?? 1,
          period: options.period ?? { unit: 'months', value: 1 },
          autoExtend: options.autoExtend ?? { isEnabled: true },
          traffic: options.traffic ?? 1,
          country: options.country,
          ispId: options.ispId,
          couponCode: options.couponCode,
        },
        {
          headers: {
            'X-Api-Key': process.env.PROXY_API_KEY,
            'X-Api-Secret': process.env.PROXY_API_SECRET,
          },
        },
      );

      // 3. Save purchase to Firestore
      const purchase: PurchaseOrderDto = {
        userId,
        proxyServiceId: serviceId,
        proxyPlanId: planId,
        pricePaid: priceWithMarkup,
        status: 'active',
        createdAt: new Date(),
        details: executeResponse.data,
      };

      const purchaseRef = await db.collection('purchases').add(purchase);

      await db
        .collection('users')
        .doc(userId)
        .update({
          purchases: dbFireStore.FieldValue.arrayUnion(purchaseRef.id),
        });

      return purchase;
    } catch (error) {
      console.error(error);
      throw new HttpException('Purchase failed', HttpStatus.BAD_GATEWAY);
    }
  }

  /** Get all purchases for a user */
  async getUserPurchases(userId: string): Promise<PurchaseOrderDto[]> {
    const purchasesSnap = await db
      .collection('purchases')
      .where('userId', '==', userId)
      .get();
    return purchasesSnap.docs.map((doc) => doc.data() as PurchaseOrderDto);
  }

  /** Admin: Get all purchases */
  async getAllPurchases(): Promise<PurchaseOrderDto[]> {
    const purchasesSnap = await db.collection('purchases').get();
    return purchasesSnap.docs.map((doc) => doc.data() as PurchaseOrderDto);
  }

  /** Admin: Update markup */
  async updateMarkup(
    globalMarkup: number,
    perServiceMarkup: Record<string, number>,
  ) {
    try {
      await db
        .collection('config')
        .doc('pricing')
        .set({ globalMarkup, perServiceMarkup }, { merge: true });
      return { success: true };
    } catch (error) {
      console.error('Error updating markup:', error);
      throw new HttpException(
        'Failed to update pricing configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
