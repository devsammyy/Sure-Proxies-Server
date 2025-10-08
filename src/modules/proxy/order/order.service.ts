/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from 'src/main';
import { PaymentpointService } from 'src/modules/paymentpoint/paymentpoint.service';
import {
  FinalizeTxResult,
  PendingDataModel,
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

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly paymentPointService: PaymentpointService,
  ) {}

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

  /** Fetch current USD to NGN exchange rate from Firestore or external API */
  private async getExchangeRate(): Promise<number> {
    try {
      // Try to get from Firestore cache first
      const rateDoc = await db.collection('config').doc('exchange_rate').get();

      if (rateDoc.exists) {
        const data = rateDoc.data();
        const cachedRate = data?.rate;
        const lastUpdated = data?.lastUpdated?.toDate();

        // Use cached rate if less than 1 hour old
        if (cachedRate && lastUpdated) {
          const hoursSinceUpdate =
            (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
          if (hoursSinceUpdate < 1) {
            console.log('💱 [EXCHANGE RATE] Using cached rate:', cachedRate);
            return cachedRate;
          }
        }
      }

      // Fetch fresh rate from external API
      console.log('💱 [EXCHANGE RATE] Fetching fresh rate from API...');
      const response = await axios.get(
        'https://api.exchangerate-api.com/v4/latest/USD',
      );
      const rate = response.data?.rates?.NGN;

      if (!rate || typeof rate !== 'number') {
        console.warn(
          '⚠️  [EXCHANGE RATE] Invalid rate from API, using fallback',
        );
        return 1500; // Fallback rate
      }

      // Cache the rate
      await db.collection('config').doc('exchange_rate').set({
        rate,
        lastUpdated: new Date(),
      });

      console.log('✅ [EXCHANGE RATE] Fresh rate fetched and cached:', rate);
      return rate;
    } catch (error) {
      console.error('❌ [EXCHANGE RATE] Error fetching rate:', error);
      return 1500; // Fallback rate
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

  /**
   * Ensure user has virtual account (create if not exists)
   * This implements lazy creation - only creates on first purchase
   */
  private async ensureVirtualAccount(userId: string): Promise<void> {
    try {
      console.log(
        '🏦 [VIRTUAL ACCOUNT] Checking if user has virtual account...',
      );

      const virtualAccountRef = db.collection('virtual_accounts').doc(userId);
      const virtualAccountSnap = await virtualAccountRef.get();

      if (virtualAccountSnap.exists) {
        console.log('✅ [VIRTUAL ACCOUNT] User already has virtual account');
        return;
      }

      console.log(
        '📝 [VIRTUAL ACCOUNT] No virtual account found, creating one...',
      );

      // Get user details
      const userSnap = await db.collection('users').doc(userId).get();
      const userData = userSnap.data();

      if (!userData) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Create virtual account via PaymentPoint API
      const virtualAccount =
        await this.paymentPointService.createVirtualAccount({
          email: userData.email,
          name: userData.fullName,
          phoneNumber: userData.phoneNumber,
        });

      // Save to database
      await virtualAccountRef.set(virtualAccount as any);

      console.log(
        '✅ [VIRTUAL ACCOUNT] Virtual account created successfully for user:',
        userId,
      );
    } catch (error) {
      console.error(
        '❌ [VIRTUAL ACCOUNT] Error ensuring virtual account:',
        error,
      );
      throw new HttpException(
        'Failed to create virtual account',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
          planId: planId || null,
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
      // Build provider-specific payload
      const payload: Record<string, unknown> = {};
      const normalizedId = serviceId.toLowerCase();
      // Heuristic classification: widen support without hardcoding every id
      const requiresTraffic =
        /rotating/.test(normalizedId) &&
        (normalizedId.includes('mobile') ||
          normalizedId.includes('residential'));
      // Any static (non-rotating) ipv6 variant (datacenter or residential) that is not rotating requires packageId + country + period
      const requiresPackageCountry =
        normalizedId.includes('ipv6') &&
        normalizedId.includes('static') &&
        !normalizedId.includes('rotating');
      const ipv6Residential =
        requiresPackageCountry && normalizedId.includes('residential');
      // Country-required services (static/dedicated mobile/residential, non-rotating, non-ipv6) now support period
      const countryRequiresPeriod =
        (normalizedId.includes('static') ||
          normalizedId.includes('dedicated')) &&
        (normalizedId.includes('mobile') ||
          normalizedId.includes('residential')) &&
        !normalizedId.includes('rotating') &&
        !normalizedId.includes('ipv6') &&
        normalizedId !== 'dedicated-mobile'; // treat dedicated-mobile separately
      // Plan-only was previously applied to dedicated-mobile, but dedicated-mobile now REQUIRES country + planId (no period)
      const requiresPlanOnly = false;

      if (normalizedId === 'dedicated-mobile') {
        // Dedicated mobile: provider rejects quantity & country (empty list) and may require period in singular unit naming
        payload.planId = model?.planId || 'dedicated';
        if (model?.period) {
          const unit =
            (model.period.unit === 'days' && 'day') ||
            (model.period.unit === 'months' && 'month') ||
            model.period.unit;
          payload.period = { unit, value: model.period.value };
        }
        if (model?.country) payload.country = model.country; // allow future optional country
      } else if (requiresTraffic) {
        if (typeof model?.traffic !== 'number') {
          throw new HttpException(
            { message: 'traffic is required for rotating pricing' },
            HttpStatus.BAD_REQUEST,
          );
        }
        payload.traffic = model.traffic;
        // Explicitly strip any period just in case it was sent
        if (payload.period) delete payload.period;
        // NOTE: Provider returns period.NOT_ALLOWED for rotating/traffic-only services.
        if (model?.country) payload.country = model.country; // some providers may accept country filter
      } else if (requiresPackageCountry) {
        // Static IPv6 variants: require packageId; country required for datacenter, optional for residential
        if (!model?.packageId) {
          throw new HttpException(
            { message: 'packageId is required for static-ipv6 service' },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (!model?.country && !ipv6Residential) {
          throw new HttpException(
            { message: 'country is required for static-ipv6 service' },
            HttpStatus.BAD_REQUEST,
          );
        }
        payload.packageId = model.packageId;
        if (model?.country) {
          payload.country = model.country.toLowerCase();
        }
        if (model?.period) payload.period = model.period; // keep period if user provided
      } else if (countryRequiresPeriod) {
        // Static/dedicated mobile or residential (non-rotating, non-ipv6) now support optional country for some variants.
        if (model?.country) payload.country = model.country;
        if (model?.planId) payload.planId = model.planId;
        if (model?.quantity) payload.quantity = model.quantity; // ensure quantity present when provided
        if (model?.period) payload.period = model.period;
      } else {
        // Generic pattern (legacy): planId, quantity, period
        if (model?.planId) payload.planId = model.planId;
        if (model?.quantity) payload.quantity = model.quantity;
        if (model?.period) payload.period = model.period;
        if (model?.country) payload.country = model.country;
        if (model?.traffic) payload.traffic = model.traffic;
        if (model?.packageId) payload.packageId = model.packageId;
      }

      // Debug logging (opt-in): set DEBUG_PROXY_ORDER=1 to enable
      if (process.env.DEBUG_PROXY_ORDER === '1') {
        try {
          const branch = requiresTraffic
            ? 'traffic-only'
            : requiresPackageCountry
              ? 'package+country'
              : countryRequiresPeriod
                ? 'country+period'
                : 'generic';
          const effectiveBranch = requiresPlanOnly ? 'plan-only' : branch;
          console.log(
            '[ProxyOrder:getPrice] building request',
            JSON.stringify({ serviceId, branch: effectiveBranch, payload }),
          );
        } catch (e) {
          console.warn('Debug logging failed', e);
        }
      }

      // Additional safeguard for any rotating service that slipped classification
      if (
        !requiresTraffic &&
        /rotating/.test(normalizedId) &&
        typeof model?.traffic !== 'number'
      ) {
        throw new HttpException(
          { message: 'traffic is required for rotating service' },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Sanitize payload: remove null/undefined
      Object.keys(payload).forEach((k) => {
        if (payload[k] == null) delete payload[k];
      });

      // Final defensive: remove period for any branch that should not send it
      if (requiresTraffic) {
        if ('period' in payload) delete payload.period;
      }
      // If branch requires country and still missing, abort before provider call
      if (requiresPackageCountry && !payload.country && !ipv6Residential) {
        // For non-residential static ipv6 variants, country remains mandatory
        throw new HttpException(
          { message: 'country missing before provider request' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (requiresTraffic && typeof payload['traffic'] !== 'number') {
        throw new HttpException(
          { message: 'traffic missing before provider request' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const response = await axios.post<PriceResponseModel>(
        `${this.apiBaseUrl}/${serviceId}/price`,
        payload,
      );
      const base = response?.data;
      // fetch markup config
      const pricingConfig = await this.getPricingConfig();
      const markupPercent =
        pricingConfig?.perServiceMarkup?.[serviceId] ??
        pricingConfig?.globalMarkup ??
        0;
      if (!markupPercent || markupPercent === 0) {
        return {
          ...base,
          originalFinalPrice: base.finalPrice,
          originalUnitPrice: base.unitPrice,
          markupPercent: 0,
          markupAmount: 0,
        } as PriceResponseModel & Record<string, unknown>;
      }

      const multiplier = 1 + markupPercent / 100;
      const newFinal = parseFloat((base.finalPrice * multiplier).toFixed(2));
      const newUnit = parseFloat((base.unitPrice * multiplier).toFixed(4));
      const markupAmount = parseFloat((newFinal - base.finalPrice).toFixed(2));

      return {
        ...base,
        finalPrice: newFinal,
        unitPrice: newUnit,
        priceNoDiscounts: parseFloat(
          (base.priceNoDiscounts * multiplier).toFixed(2),
        ),
        finalPriceInCurrency: newFinal,
        subtotal: parseFloat((base.subtotal * multiplier).toFixed(2)),
        originalFinalPrice: base.finalPrice,
        originalUnitPrice: base.unitPrice,
        markupPercent,
        markupAmount,
      } as PriceResponseModel & Record<string, unknown>;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const providerData = error.response?.data as unknown;
        // Attempt to derive a concise provider-side message
        let detail: string | undefined;
        if (providerData && typeof providerData === 'object') {
          const d: any = providerData;
          detail =
            d?.errors?.[0]?.message || d?.errors?.[0] || d?.message || d?.error;
        }
        console.error(
          'Provider price API error:',
          JSON.stringify(providerData),
        );
        // Additional payload context logged above on build; re-log minimal on failure if debug enabled
        if (process.env.DEBUG_PROXY_ORDER === '1') {
          console.error('[ProxyOrder:getPrice] failed for', serviceId);
        }
        throw new HttpException(
          {
            message: 'Failed to fetch price',
            provider: detail || 'Unprocessable provider request',
            statusCode: status || HttpStatus.BAD_GATEWAY,
          },
          status && status >= 400 && status < 600
            ? status
            : HttpStatus.BAD_GATEWAY,
        );
      }
      console.error('Unknown error fetching price:', error);
      throw new HttpException('Failed to fetch price', HttpStatus.BAD_GATEWAY);
    }
  }

  async purchaseProxy(
    serviceId: string,
    model: ProxyOrderPurchaseInputDto,
  ): Promise<{ transactionId: string; amount: number }> {
    try {
      console.log('💰 [PURCHASE] Starting purchase for service:', serviceId);
      console.log('📋 [PURCHASE] User ID:', model.userId);
      console.log(
        '🎯 [PURCHASE] Expected price from frontend:',
        model.expectedPrice,
      );

      // ✅ Ensure user has virtual account (lazy creation on first purchase)
      await this.ensureVirtualAccount(model.userId);

      // getPrice already includes markup in finalPrice
      const priced = await this.getPrice(serviceId, {
        planId: model.planId,
        quantity: model.quantity,
        period: { ...model.period },
        traffic: model.traffic,
        packageId: (model as any).packageId,
        country: model.country,
      });
      const profitPrice =
        (priced as any)?.finalPrice ?? (priced as any)?.unitPrice ?? 0;

      console.log('💵 [PURCHASE] Backend calculated price (USD):', profitPrice);

      // Store expectedPrice for validation AFTER webhook confirms payment
      if (model.expectedPrice !== undefined && model.expectedPrice !== null) {
        console.log(
          '� [PURCHASE] Expected price from frontend (NGN):',
          model.expectedPrice,
        );
        console.log(
          '⏳ [PURCHASE] Price validation will occur after payment confirmation in webhook',
        );
      }

      const transaction: Transaction = await this.transactionsService.create(
        model.userId,
        {
          type: 'DEPOSIT',
          amount: profitPrice,
          reference: crypto.randomUUID(),
        },
      );

      console.log('📝 [PURCHASE] Transaction created:', transaction.id);

      // Save pending purchase with all order details
      // Note: Filter out undefined values to avoid Firestore errors
      const options: any = {};
      if (model.quantity !== undefined) options.quantity = model.quantity;
      if (model.period !== undefined) options.period = model.period;
      if (model.autoExtend !== undefined) options.autoExtend = model.autoExtend;
      if (model.traffic !== undefined) options.traffic = model.traffic;
      if (model.country !== undefined) options.country = model.country;
      if (model.ispId !== undefined) options.ispId = model.ispId;

      const pendingData: PendingDataModel = {
        userId: model.userId,
        serviceId,
        ...(model.planId && { planId: model.planId }), // Only include if defined
        pricePaid: profitPrice,
        ...(model.expectedPrice !== undefined &&
          model.expectedPrice !== null && {
            expectedPrice: model.expectedPrice,
          }), // Store for validation in webhook
        options,
      } as PendingDataModel;

      console.log(
        '💾 [PURCHASE] Pending data to save:',
        JSON.stringify(pendingData, null, 2),
      );

      await db
        .collection('pending_purchases')
        .doc(transaction.id)
        .set(pendingData);

      console.log(
        '💾 [PURCHASE] Pending purchase saved for transaction:',
        transaction.id,
      );
      console.log('✨ [PURCHASE] Purchase initialization complete');

      return { transactionId: transaction.id, amount: profitPrice };
    } catch (error) {
      console.error('❌ [PURCHASE] Purchase error:', error);
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
        const pending = pendingSnap.data() as PendingDataModel;

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

      const { pending } = result;

      // ✅ Validate price if expectedPrice was provided (after payment confirmation)
      if (
        pending.expectedPrice !== undefined &&
        pending.expectedPrice !== null
      ) {
        console.log('🔍 [FINALIZE] Starting price validation after payment...');

        // Get exchange rate to convert USD to Naira
        const exchangeRate = await this.getExchangeRate();

        // Convert USD price to Naira
        const priceInNaira = Math.round(pending.pricePaid * exchangeRate);

        const priceDiff = Math.abs(priceInNaira - pending.expectedPrice);
        const tolerance = Math.max(priceInNaira * 0.01, 100); // 1% or 100 NGN

        console.log('💱 [FINALIZE] Exchange rate (USD to NGN):', exchangeRate);
        console.log('💵 [FINALIZE] Price paid (USD):', pending.pricePaid);
        console.log('💵 [FINALIZE] Price paid (NGN):', priceInNaira);
        console.log(
          '📌 [FINALIZE] Expected price (NGN):',
          pending.expectedPrice,
        );
        console.log('📊 [FINALIZE] Difference (NGN):', priceDiff);
        console.log('📏 [FINALIZE] Tolerance (NGN):', tolerance);

        if (priceDiff > tolerance) {
          console.error('❌ [FINALIZE] Price mismatch detected after payment!');
          console.error(
            '⚠️  [FINALIZE] This indicates a serious issue - payment already made',
          );

          // Log to transaction for investigation
          await db
            .collection('transactions')
            .doc(transactionId)
            .update({
              priceValidationFailed: true,
              priceValidationDetails: {
                pricePaidUSD: pending.pricePaid,
                pricePaidNGN: priceInNaira,
                expectedNGN: pending.expectedPrice,
                difference: priceDiff,
                tolerance,
                exchangeRate,
              },
            });

          throw new HttpException(
            {
              message:
                'Price validation failed after payment - contact support',
              currentPrice: priceInNaira,
              expectedPrice: pending.expectedPrice,
              code: 'PRICE_VALIDATION_FAILED_AFTER_PAYMENT',
            },
            HttpStatus.CONFLICT,
          );
        }

        console.log('✅ [FINALIZE] Price validation passed');
      }

      // Execute the external proxy API (outside transaction)
      // Build payload, only including defined values
      const executePayload: any = {};

      if (pending.planId !== undefined) {
        executePayload.planId = pending.planId;
      }
      if (pending.options.quantity !== undefined) {
        executePayload.quantity = pending.options.quantity;
      }
      if (pending.options.period !== undefined) {
        executePayload.period = pending.options.period;
      }
      if (pending.options.autoExtend !== undefined) {
        executePayload.autoExtend = pending.options.autoExtend;
      }
      if (pending.options.traffic !== undefined) {
        executePayload.traffic = pending.options.traffic;
      }
      if (pending.options.country !== undefined) {
        executePayload.country = pending.options.country;
      }
      if (pending.options.ispId !== undefined) {
        executePayload.ispId = pending.options.ispId;
      }

      console.log(
        '🚀 [FINALIZE] Execute payload:',
        JSON.stringify(executePayload, null, 2),
      );

      const executeResponse = await axios.post<Record<string, unknown>>(
        `${this.apiBaseUrl}/${pending.serviceId}/execute`,
        executePayload,
        {
          headers: {
            'X-Api-Key': process.env.PROXY_API_KEY as string,
            'X-Api-Secret': process.env.PROXY_API_SECRET as string,
          },
        },
      );

      // construct and save purchase
      const purchase: PurchaseOrderModel = {
        id: '',
        userId: pending.userId,
        serviceId: pending.serviceId,
        planId: pending.planId,
        profitPrice: pending.pricePaid,
        status: 'active',
        createdAt: new Date(),
        details: executeResponse.data,
      };

      const purchaseRef = await db.collection('purchases').add(purchase);
      purchase.id = purchaseRef.id;

      // Update purchase document with its own ID
      await purchaseRef.update({ id: purchaseRef.id });

      // attach purchase id to user document using FieldValue
      await db
        .collection('users')
        .doc(pending.userId)
        .update({
          purchases: FieldValue.arrayUnion(purchaseRef.id) as any,
        });

      // Delete pending purchase
      await pendingRef.delete();

      console.log('Purchase finalized successfully:', purchaseRef.id);
      return purchase;
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
