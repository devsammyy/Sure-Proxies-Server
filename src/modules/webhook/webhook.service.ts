// webhook.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { db } from 'src/main';
import { ProxyOrderService } from 'src/modules/proxy/order/order.service';
import { TransactionsService } from 'src/modules/transaction/transaction.service';
import { WalletService } from 'src/modules/wallet/wallet.service';

export type WebhookPayload = {
  transaction_id?: string;
  amount_paid?: number;
  transaction_status?: string;
  settlement_amount?: number;
  settlement_fee?: number;
  sender?: any;
  receiver?: any;
  customer?: {
    customer_id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  description?: string;
  timestamp?: string;
  [key: string]: unknown;
};

interface TransactionDoc {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  userId: string;
  reference?: string;
  amount?: number;
  createdAt?: FirebaseFirestore.Timestamp | Date;
}

export type WebhookProcessResult = {
  status:
    | 'processed'
    | 'unmatched'
    | 'no_data'
    | 'already_processed'
    | 'invalid_signature';
  transactionId?: string;
  message?: string;
};

@Injectable()
export class WebhookService {
  private securityKey = process.env.PAYMENTPOINT_SECRET!;

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly proxyOrderService: ProxyOrderService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Verify webhook signature using HMAC SHA256
   */
  verifySignature(rawBody: string, signature: string): boolean {
    console.log('🔐 [WEBHOOK SERVICE] Starting signature verification');
    console.log('📏 [WEBHOOK SERVICE] Raw body length:', rawBody?.length);
    console.log('🔑 [WEBHOOK SERVICE] Received signature:', signature);

    if (!signature || !rawBody) {
      console.error('❌ [WEBHOOK SERVICE] Missing signature or raw body');
      return false;
    }

    const calculatedSignature = crypto
      .createHmac('sha256', this.securityKey)
      .update(rawBody)
      .digest('hex');

    console.log(
      '🧮 [WEBHOOK SERVICE] Calculated signature:',
      calculatedSignature,
    );

    const isValid = calculatedSignature === signature;

    if (!isValid) {
      console.error('❌ [WEBHOOK SERVICE] Signature mismatch!', {
        calculated: calculatedSignature,
        received: signature,
      });
    } else {
      console.log('✅ [WEBHOOK SERVICE] Signature is valid');
    }

    return isValid;
  }

  /**
   * Find transaction by various matching strategies
   */
  private async findTransaction(
    payload: WebhookPayload,
  ): Promise<FirebaseFirestore.DocumentSnapshot | null> {
    console.log('🔍 [WEBHOOK SERVICE] Finding transaction...');
    const { transaction_id, customer, amount_paid } = payload;

    console.log('🔎 [WEBHOOK SERVICE] Search criteria:', {
      transaction_id,
      customer_id: customer?.customer_id,
      amount_paid,
    });

    // Strategy 1: Match by transaction_id in reference field
    if (transaction_id) {
      console.log('🎯 [WEBHOOK SERVICE] Strategy 1: Searching by reference...');
      const byRefSnap = await db
        .collection('transactions')
        .where('reference', '==', transaction_id)
        .limit(1)
        .get();

      if (!byRefSnap.empty) {
        console.log(
          '✅ [WEBHOOK SERVICE] Found transaction by reference:',
          transaction_id,
        );
        return byRefSnap.docs[0];
      }

      // Strategy 2: Match by document ID
      console.log(
        '🎯 [WEBHOOK SERVICE] Strategy 2: Searching by document ID...',
      );
      const byIdSnap = await db
        .collection('transactions')
        .doc(transaction_id)
        .get();

      if (byIdSnap.exists) {
        console.log(
          '✅ [WEBHOOK SERVICE] Found transaction by document ID:',
          transaction_id,
        );
        return byIdSnap;
      }
    }

    // Strategy 3: Match by customer_id
    if (customer?.customer_id) {
      console.log(
        '🎯 [WEBHOOK SERVICE] Strategy 3: Searching by customer_id...',
      );
      const byCustSnap = await db
        .collection('transactions')
        .where('reference', '==', customer.customer_id)
        .limit(1)
        .get();

      if (!byCustSnap.empty) {
        console.log(
          '✅ [WEBHOOK SERVICE] Found transaction by customer_id:',
          customer.customer_id,
        );
        return byCustSnap.docs[0];
      }
    }

    // Strategy 4: Fallback by amount + PENDING status
    if (typeof amount_paid === 'number') {
      console.log(
        '🎯 [WEBHOOK SERVICE] Strategy 4: Searching by amount fallback...',
      );
      const fallbackSnap = await db
        .collection('transactions')
        .where('amount', '==', amount_paid)
        .where('status', '==', 'PENDING')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!fallbackSnap.empty) {
        console.log(
          '✅ [WEBHOOK SERVICE] Found transaction by amount fallback:',
          amount_paid,
        );
        return fallbackSnap.docs[0];
      }
    }

    console.error('❌ [WEBHOOK SERVICE] No matching transaction found', {
      transaction_id,
      customer_id: customer?.customer_id,
      amount_paid,
    });

    return null;
  }

  /**
   * Create transaction history entry
   */
  private async createTransactionHistory(
    transactionId: string,
    userId: string,
    description: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    await db.collection('transaction_histories').add({
      transactionId,
      userId,
      description,
      meta,
      createdAt: new Date(),
    });
  }

  /**
   * Process successful payment
   */
  private async processSuccessfulPayment(
    txId: string,
    txData: TransactionDoc,
    payload: WebhookPayload,
  ): Promise<void> {
    console.log('💰 [WEBHOOK SERVICE] Processing successful payment');
    console.log('📝 [WEBHOOK SERVICE] Transaction ID:', txId);
    console.log('👤 [WEBHOOK SERVICE] User ID:', txData.userId);

    const { transaction_id, amount_paid, settlement_amount, settlement_fee } =
      payload;

    // Get full transaction details to check type
    const txSnapshot = await db.collection('transactions').doc(txId).get();
    const fullTxData = txSnapshot.data();
    const transactionType = (fullTxData?.type as string) || null;

    console.log('🔍 [WEBHOOK SERVICE] Transaction type:', transactionType);

    // Update transaction status
    await this.transactionsService.update(txId, { status: 'SUCCESS' });
    console.log('✅ [WEBHOOK SERVICE] Transaction marked as SUCCESS:', txId);

    // Create history entry for successful payment
    await this.createTransactionHistory(
      txId,
      txData.userId,
      `Payment confirmed by PaymentPoint: ${transaction_id ?? 'n/a'}`,
      {
        transaction_id,
        amount_paid,
        settlement_amount,
        settlement_fee,
      },
    );

    console.log('📚 [WEBHOOK SERVICE] Transaction history entry created');

    // Handle based on transaction type
    if (transactionType === 'DEPOSIT') {
      // This is a wallet deposit
      console.log('💳 [WEBHOOK SERVICE] Processing wallet deposit...');
      try {
        const depositAmount =
          (fullTxData?.amount as number) || amount_paid || 0;

        await this.walletService.processDeposit(
          txData.userId,
          txId,
          depositAmount,
        );

        console.log(
          '✅ [WEBHOOK SERVICE] Wallet deposit processed successfully:',
          {
            userId: txData.userId,
            amount: depositAmount,
          },
        );
      } catch (err) {
        console.error(
          '❌ [WEBHOOK SERVICE] Error processing wallet deposit:',
          txId,
          err,
        );
      }
    } else {
      // This is a proxy purchase
      console.log('🚀 [WEBHOOK SERVICE] Processing proxy purchase...');
      try {
        const purchase = await this.proxyOrderService.finalizePurchase(txId);

        if (purchase) {
          console.log('✅ [WEBHOOK SERVICE] Purchase finalized successfully:', {
            transactionId: txId,
            purchaseId: purchase.id,
          });
        } else {
          console.log(
            '⚠️  [WEBHOOK SERVICE] No pending purchase found for transaction:',
            txId,
          );
        }
      } catch (err) {
        console.error(
          '❌ [WEBHOOK SERVICE] Error finalizing purchase for transaction:',
          txId,
          err,
        );
        // Note: Transaction status remains SUCCESS even if finalization fails
        // This allows for manual retry or investigation
      }
    }
  }

  /**
   * Process failed payment
   */
  private async processFailedPayment(
    txId: string,
    txData: TransactionDoc,
    payload: WebhookPayload,
  ): Promise<void> {
    const { transaction_id, amount_paid, transaction_status } = payload;

    // Update transaction status
    await this.transactionsService.update(txId, { status: 'FAILED' });
    console.log('❌ Transaction marked as FAILED:', txId);

    // Create history entry for failed payment
    await this.createTransactionHistory(
      txId,
      txData.userId,
      `Payment failed or not successful: ${transaction_status}`,
      {
        transaction_id,
        amount_paid,
        transaction_status,
      },
    );
  }

  /**
   * Main webhook processing logic
   */
  async processTransaction(
    payload: WebhookPayload,
  ): Promise<WebhookProcessResult> {
    console.log('\n' + '▼'.repeat(80));
    console.log('📥 [WEBHOOK SERVICE] Processing webhook payload');
    console.log('⏰ [WEBHOOK SERVICE] Timestamp:', new Date().toISOString());

    const { transaction_id, amount_paid, transaction_status } = payload;

    console.log('� [WEBHOOK SERVICE] Payload details:', {
      transaction_id,
      transaction_status,
      amount_paid,
    });

    // Find matching transaction
    const txDoc = await this.findTransaction(payload);

    if (!txDoc) {
      console.error('❌ [WEBHOOK SERVICE] No matching transaction found');
      console.log('▲'.repeat(80) + '\n');
      return {
        status: 'unmatched',
        message: 'No matching transaction found',
      };
    }

    const txId = txDoc.id;
    const txData = txDoc.data() as TransactionDoc | undefined;

    console.log('✅ [WEBHOOK SERVICE] Transaction found:', txId);
    console.log('📄 [WEBHOOK SERVICE] Transaction data:', txData);

    if (!txData) {
      console.error(
        '❌ [WEBHOOK SERVICE] Transaction snapshot has no data:',
        txId,
      );
      console.log('▲'.repeat(80) + '\n');
      return {
        status: 'no_data',
        transactionId: txId,
        message: 'Transaction document has no data',
      };
    }

    // Check if already processed
    if (txData.status === 'SUCCESS') {
      console.log(
        '⏩ [WEBHOOK SERVICE] Transaction already SUCCESS, ignoring:',
        txId,
      );
      console.log('▲'.repeat(80) + '\n');
      return {
        status: 'already_processed',
        transactionId: txId,
        message: 'Transaction already processed',
      };
    }

    // Process based on status
    console.log(
      '🔀 [WEBHOOK SERVICE] Transaction status from webhook:',
      transaction_status,
    );

    if (
      transaction_status === 'success' ||
      transaction_status === 'completed'
    ) {
      console.log('✅ [WEBHOOK SERVICE] Processing as SUCCESSFUL payment...');
      await this.processSuccessfulPayment(txId, txData, payload);
    } else {
      console.log('❌ [WEBHOOK SERVICE] Processing as FAILED payment...');
      await this.processFailedPayment(txId, txData, payload);
    }

    console.log('🎉 [WEBHOOK SERVICE] Webhook processing complete!');
    console.log('▲'.repeat(80) + '\n');

    return {
      status: 'processed',
      transactionId: txId,
      message: 'Webhook processed successfully',
    };
  }
}
