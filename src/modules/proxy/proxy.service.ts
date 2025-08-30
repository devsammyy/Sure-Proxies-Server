/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// proxy.service.ts
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { db, dbFireStore } from 'src/main';
import { ProxyService, PurchaseDto } from './proxy.dto';

// @Injectable()
// export class ProxyServiceLayer {
//   private readonly apiBaseUrl = 'https://api.proxy-cheap.com/v2/order';

//   constructor() {}

//   /** Fetch pricing config from Firestore */
//   private async getPricingConfig() {
//     const configDoc = await db.collection('config').doc('pricing').get();
//     if (!configDoc.exists) {
//       return { globalMarkup: 0, perServiceMarkup: {} };
//     }
//     return configDoc.data();
//   }

//   /** Apply markup to base price */
//   private applyMarkup(
//     basePrice: number,
//     serviceId: string,
//     config: any,
//   ): number {
//     const markup =
//       config?.perServiceMarkup?.[serviceId] ?? config?.globalMarkup ?? 0;
//     return Math.round(basePrice * (1 + markup / 100));
//   }

//   /** Get available proxies with markup applied */
//   async getAvailableProxies(): Promise<ProxyService[]> {
//     try {
//       const response = await axios.get(this.apiBaseUrl);
//       if (response.status !== 200) {
//         throw new Error('Failed to fetch proxy services');
//       }
//       const services: ProxyService[] = (
//         response.data as { services: ProxyService[] }
//       ).services;

//       const pricingConfig = await this.getPricingConfig();

//       // Apply markup
//       services.forEach((service) => {
//         service.basePrice = this.applyMarkup(
//           service.basePrice,
//           service.serviceId,
//           pricingConfig,
//         );
//         service.plans?.forEach((plan) => {
//           plan.basePrice = this.applyMarkup(
//             plan.basePrice,
//             service.serviceId,
//             pricingConfig,
//           );
//         });
//       });

//       return services;
//     } catch (error: unknown) {
//       console.error(error);
//       throw new HttpException(
//         'Failed to fetch proxies',
//         HttpStatus.BAD_GATEWAY,
//       );
//     }
//   }

//   /** Purchase a proxy */
//   async purchaseProxy(
//     userId: string,
//     serviceId: string,
//     planId: string,
//   ): Promise<PurchaseDto> {
//     try {
//       // 1. Get pricing config
//       const pricingConfig = await this.getPricingConfig();

//       // 2. Fetch proxy service info (without markup)
//       const response = await axios.get(this.apiBaseUrl);
//       const services: ProxyService[] = response.data.services;

//       const service = services.find((s) => s.serviceId === serviceId);
//       if (!service)
//         throw new HttpException('Service not found', HttpStatus.NOT_FOUND);

//       const plan = service.plans?.find((p) => p.planId === planId);
//       if (!plan)
//         throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);

//       // 3. Apply markup from pricingConfig
//       const basePrice = plan ? plan.basePrice : service.basePrice;
//       const markup =
//         pricingConfig?.perServiceMarkup?.[serviceId] ??
//         pricingConfig?.globalMarkup ??
//         0;
//       const priceToPay = Math.round(basePrice * (1 + markup / 100));

//       // 4. Execute Proxy-Cheap order
//       const executeResponse = await axios.post(`${this.apiBaseUrl}/execute`, {
//         serviceId,
//         planId,
//       });

//       // 5. Save purchase in Firestore
//       const purchase: PurchaseDto = {
//         userId,
//         proxyServiceId: serviceId,
//         proxyPlanId: planId,
//         pricePaid: priceToPay,
//         status: 'active', // Could also use executeResponse.status
//         createdAt: new Date(),
//         details: executeResponse.data,
//       };

//       const purchaseRef = await db.collection('purchases').add(purchase);

//       // 6. Update user document
//       await db
//         .collection('users')
//         .doc(userId)
//         .update({
//           purchases: dbFireStore.FieldValue.arrayUnion(purchaseRef.id),
//         });

//       return purchase;
//     } catch (error) {
//       console.error(error);
//       throw new HttpException('Purchase failed', HttpStatus.BAD_GATEWAY);
//     }
//   }

//   /** Get user purchases */
//   async getUserPurchases(userId: string): Promise<PurchaseDto[]> {
//     const purchasesSnap = await db
//       .collection('purchases')
//       .where('userId', '==', userId)
//       .get();
//     return purchasesSnap.docs.map((doc) => doc.data() as PurchaseDto);
//   }

//   /** Admin: Get all purchases */
//   async getAllPurchases(): Promise<PurchaseDto[]> {
//     const purchasesSnap = await db.collection('purchases').get();
//     return purchasesSnap.docs.map((doc) => doc.data() as PurchaseDto);
//   }

//   /** Admin: Update markup */
//   async updateMarkup(
//     globalMarkup: number,
//     perServiceMarkup: Record<string, number>,
//   ) {
//     await db.collection('config').doc('pricing').set(
//       {
//         globalMarkup,
//         perServiceMarkup,
//       },
//       { merge: true },
//     );
//     return { success: true };
//   }
// }

@Injectable()
export class ProxyServiceLayer {
  private readonly apiBaseUrl = 'https://api.proxy-cheap.com/v2/order';

  constructor() {}

  /** Fetch pricing config from Firestore */
  private async getPricingConfig() {
    try {
      const configDoc = await db.collection('config').doc('pricing').get();
      if (!configDoc.exists) {
        return { globalMarkup: 0, perServiceMarkup: {} };
      }
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

  /** Initialize pricing config if not exists */
  async createConfig(
    globalMarkup = 0,
    perServiceMarkup: Record<string, number> = {},
  ) {
    try {
      const configRef = db.collection('config').doc('pricing');
      const configDoc = await configRef.get();

      if (configDoc.exists) {
        console.log('Pricing config already exists.');
        return { success: false, message: 'Config already exists' };
      }

      await configRef.set({
        globalMarkup,
        perServiceMarkup,
      });

      console.log('Pricing config created successfully.');
      return { success: true };
    } catch (error) {
      console.error('Error creating pricing config:', error);
      throw new HttpException(
        'Failed to create pricing configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Get available proxies with markup applied */
  async getAvailableProxies(): Promise<ProxyService[]> {
    try {
      const response = await axios.get(this.apiBaseUrl);
      if (response.status !== 200) {
        throw new Error('Failed to fetch proxy services');
      }
      const services: ProxyService[] = (
        response.data as { services: ProxyService[] }
      ).services;

      const pricingConfig = await this.getPricingConfig();

      // Apply markup
      services.forEach((service) => {
        service.basePrice = this.applyMarkup(
          service.basePrice,
          service.serviceId,
          pricingConfig,
        );
        service.plans?.forEach((plan) => {
          plan.basePrice = this.applyMarkup(
            plan.basePrice,
            service.serviceId,
            pricingConfig,
          );
        });
      });

      return services;
    } catch (error: unknown) {
      console.error(error);
      throw new HttpException(
        'Failed to fetch proxies',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** Purchase a proxy */
  async purchaseProxy(
    userId: string,
    serviceId: string,
    planId: string,
  ): Promise<PurchaseDto> {
    try {
      const pricingConfig = await this.getPricingConfig();

      const response = await axios.get(this.apiBaseUrl);
      const services: ProxyService[] = response.data.services;

      const service = services.find((s) => s.serviceId === serviceId);
      if (!service)
        throw new HttpException('Service not found', HttpStatus.NOT_FOUND);

      const plan = service.plans?.find((p) => p.planId === planId);
      if (!plan)
        throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);

      const basePrice = plan ? plan.basePrice : service.basePrice;
      const markup =
        pricingConfig?.perServiceMarkup?.[serviceId] ??
        pricingConfig?.globalMarkup ??
        0;
      const priceToPay = Math.round(basePrice * (1 + markup / 100));

      const executeResponse = await axios.post(`${this.apiBaseUrl}/execute`, {
        serviceId,
        planId,
      });

      const purchase: PurchaseDto = {
        userId,
        proxyServiceId: serviceId,
        proxyPlanId: planId,
        pricePaid: priceToPay,
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

  /** Get user purchases */
  async getUserPurchases(userId: string): Promise<PurchaseDto[]> {
    const purchasesSnap = await db
      .collection('purchases')
      .where('userId', '==', userId)
      .get();
    return purchasesSnap.docs.map((doc) => doc.data() as PurchaseDto);
  }

  /** Admin: Get all purchases */
  async getAllPurchases(): Promise<PurchaseDto[]> {
    const purchasesSnap = await db.collection('purchases').get();
    return purchasesSnap.docs.map((doc) => doc.data() as PurchaseDto);
  }

  /** Admin: Update markup */
  async updateMarkup(
    globalMarkup: number,
    perServiceMarkup: Record<string, number>,
  ) {
    try {
      await db.collection('config').doc('pricing').set(
        {
          globalMarkup,
          perServiceMarkup,
        },
        { merge: true },
      );
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
