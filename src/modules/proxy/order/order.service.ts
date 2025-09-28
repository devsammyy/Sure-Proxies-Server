/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { db } from 'src/main';
import {
  FinalizeTxResult,
  PriceResponseModel,
  PurchaseOrderModel,
  ServiceDetailsResponseModel,
  TxDoc,
} from 'src/modules/proxy/order/order.model';
import { Transaction } from 'src/modules/transaction/transaction.model';
import { TransactionsService } from 'src/modules/transaction/transaction.service';
import { PriceInputDto, ProxyOrderPurchaseInputDto } from './order.dto';
import { ProxyOrderModel } from './order.model';

@Injectable()
export class ProxyOrderService {
  private readonly apiBaseUrl = 'https://api.proxy-cheap.com/v2/order';

  constructor(private readonly transactionsService: TransactionsService) {}

  /** Fetch pricing config from Firestore */
  private async getPricingConfig() {
    try {
      const configDoc = await db.collection('config').doc('pricing').get();
      if (!configDoc.exists) return { globalMarkup: 0, perServiceMarkup: {} };
      const config = configDoc.data();
      console.log(config, 'config from markup');
      return config;
    } catch (error) {
      console.error('Error fetching pricing config:', error);
      throw new HttpException(
        'Failed to fetch pricing configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Apply markup to original price */
  private applyMarkup(
    originalPrice: number,
    serviceId: string,
    config: any,
  ): number {
    const markup =
      config?.perServiceMarkup?.[serviceId] ?? config?.globalMarkup ?? 0;
    return Math.round(originalPrice * (1 + markup / 100));
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
  async getAvailableProxiesServices(): Promise<ProxyOrderModel[]> {
    try {
      const response = await axios.get(this.apiBaseUrl);
      const services: ProxyOrderModel[] = response?.data?.services;
      return services;
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Failed to fetch proxies',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getServiceOptions(serviceId: string, planId?: string) {
    try {
      const response = await axios.post<ServiceDetailsResponseModel>(
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
  async getPrice(serviceId: string, model?: PriceInputDto) {
    try {
      const response = await axios.post<PriceResponseModel>(
        `${this.apiBaseUrl}/${serviceId}/price`,
        {
          planId: model?.planId,
          quantity: model?.quantity,
          period: {
            ...model?.period,
          },
        },
      );
      console.log(response?.data);
      return response?.data; // contains finalPrice, unitPrice, etc.
    } catch (error: any) {
      console.error('Error fetching price:', error);
      throw new HttpException('Failed to fetch price', HttpStatus.BAD_GATEWAY);
    }
  }

  async purchaseProxy(
    serviceId: string,
    model: ProxyOrderPurchaseInputDto,
  ): Promise<{ transactionId: string; amount: number }> {
    try {
      const pricingConfig = await this.getPricingConfig();
      const originalPrice = await this.getPrice(serviceId, {
        planId: model.planId,
        quantity: model.quantity,
        period: {
          ...model.period,
        },
      });

      const profitPrice = this.applyMarkup(
        originalPrice?.finalPrice ?? originalPrice?.unitPrice ?? 0,
        serviceId,
        pricingConfig,
      );

      const transaction: Transaction = await this.transactionsService.create(
        model.userId,
        {
          type: 'DEPOSIT',
          amount: profitPrice,
          reference: crypto.randomUUID(),
        },
      );

      return { transactionId: transaction.id, amount: profitPrice };
    } catch (error) {
      console.error('purchaseProxy error:', error);
      throw new HttpException(
        'Purchase initialization failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async finalizePurchase(transactionId: string) {
    const pendingRef = db.collection('pending_purchases').doc(transactionId);
    const txRef = db.collection('transactions').doc(transactionId);

    try {
      const result = await db.runTransaction<FinalizeTxResult>(async (t) => {
        const pendingSnap = await t.get(pendingRef);
        if (!pendingSnap.exists) {
          return { status: 'no_pending' };
        }
        const pending = pendingSnap.data() as PurchaseOrderModel;

        // fetch transaction doc
        const txSnap = await t.get(txRef);
        if (!txSnap.exists) {
          return { status: 'no_tx' };
        }
        const txData = txSnap.data() as TxDoc;

        // If transaction already finalized (prevent duplicates)
        if (txData.finalized) {
          return { status: 'already_finalized' };
        }

        // mark transaction as finalized (so concurrent requests stop here)
        t.update(txRef, { finalized: true, finalizedAt: new Date() });

        // return pending for the outer scope to use
        return { status: 'ok', pending, txData };
      });

      if (result.status === 'no_pending') {
        console.warn('No pending purchase for transaction', transactionId);
        return null;
      }
      if (result.status === 'no_tx') {
        throw new Error(
          'Transaction doc missing for finalizePurchase: ' + transactionId,
        );
      }
      if (result.status === 'already_finalized') {
        console.log('finalizePurchase already ran for', transactionId);
        return null;
      }

      // const { pending } = result;

      // // Execute the external proxy API (outside transaction)
      // const executeResponse = await axios.post<Record<string, unknown>>(
      //   `${this.apiBaseUrl}/${pending.serviceId}/execute`,
      //   {
      //     planId: pending.planId,
      //     quantity: pending.options.quantity ?? 0,
      //     period: pending.options.period ?? {},
      //     autoExtend: pending.options.autoExtend ?? {},
      //     traffic: pending.options.traffic ?? 0,
      //     country: pending.options.country,
      //     ispId: pending.options.ispId,
      //     couponCode: pending.options.couponCode,
      //   },
      //   {
      //     headers: {
      //       'X-Api-Key': process.env.PROXY_API_KEY as string,
      //       'X-Api-Secret': process.env.PROXY_API_SECRET as string,
      //     },
      //   },
      // );

      // construct and save purchase
      // const purchase: PurchaseOrderModel = {
      //   userId: pending.userId,
      //   serviceId: pending.serviceId,
      //   planId: pending.planId,
      //   profitPrice: pending.profitPrice,
      //   status: 'active',
      //   createdAt: new Date(),
      // };

      // const purchaseRef = await db.collection('purchases').add(purchase);

      // // attach purchase id to user document
      // await db
      //   .collection('users')
      //   .doc(pending.userId) // now typed as string
      //   .update({
      //     purchases: dbFireStore.FieldValue.arrayUnion(purchaseRef.id),
      //   });

      // await pendingRef.delete();

      // return purchase;
    } catch (err: unknown) {
      console.error('finalizePurchase error for', transactionId, err);

      const msg = (err instanceof Error ? err.message : String(err)).slice(
        0,
        500,
      );

      await db.collection('transactions').doc(transactionId).update({
        finalizeError: msg,
        finalized: false,
        finalizedAt: new Date(),
      });
      throw err;
    }
  }

  /** Get all purchases for a user */
  async getUserPurchases(userId: string): Promise<PurchaseOrderModel[]> {
    const purchasesSnap = await db
      .collection('purchases')
      .where('userId', '==', userId)
      .get();
    return purchasesSnap.docs.map((doc) => doc.data() as PurchaseOrderModel);
  }

  /** Admin: Get all purchases */
  async getAllPurchases(): Promise<PurchaseOrderModel[]> {
    const purchasesSnap = await db.collection('purchases').get();
    return purchasesSnap.docs.map((doc) => doc.data() as PurchaseOrderModel);
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
