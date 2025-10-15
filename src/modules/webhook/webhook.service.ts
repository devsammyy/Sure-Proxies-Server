// webhook.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
// using process.env directly (dotenv is loaded in config/index.ts)
import { db } from 'src/main';
import { ProxyOrderService } from 'src/modules/proxy/order/order.service';
import { TransactionsService } from 'src/modules/transaction/transaction.service';
import { WalletService } from 'src/modules/wallet/wallet.service';

export type WebhookPayload = {
  transaction_id?: string;
  amount_paid?: number | string;
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
  private securityKey = process.env.PAYMENTPOINT_SECRET || '';

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
    const transaction_id =
      typeof payload.transaction_id === 'string'
        ? payload.transaction_id
        : undefined;

    const customer =
      payload.customer && typeof payload.customer === 'object'
        ? (payload.customer as { customer_id?: string })
        : undefined;

    const amount_paid =
      typeof payload.amount_paid === 'number' ||
      typeof payload.amount_paid === 'string'
        ? payload.amount_paid
        : undefined;

    const receiver =
      payload.receiver && typeof payload.receiver === 'object'
        ? (payload.receiver as { account_number?: string })
        : undefined;

    console.log('🔎 [WEBHOOK SERVICE] Search criteria:', {
      transaction_id,
      customer_id: customer?.customer_id,
      amount_paid,
    });

    // Normalize amount_paid so mapping checks can validate amounts consistently
    let normalizedAmount: number | null = null;
    if (typeof amount_paid === 'number') {
      normalizedAmount = amount_paid;
    } else if (typeof amount_paid === 'string') {
      const parsed = parseFloat(amount_paid.replace(/,/g, ''));
      if (!Number.isNaN(parsed)) normalizedAmount = parsed;
    }

    // Quick deterministic mapping lookup: prefer customer_id mapping, fallback to receiver account mapping
    try {
      const custId = customer?.customer_id;
      if (custId) {
        const key = String(custId).trim();
        console.log(
          '🔎 [WEBHOOK SERVICE] Checking virtual_account_mappings for customer_id',
          key,
        );
        const mapDoc = await db
          .collection('virtual_account_mappings')
          .doc(key)
          .get();
        if (mapDoc.exists) {
          const mapData = mapDoc.data() as
            | { transactionId?: string; userId?: string }
            | undefined;
          const mappedTxId = mapData?.transactionId;
          if (mappedTxId) {
            const txSnap = await db
              .collection('transactions')
              .doc(mappedTxId)
              .get();
            if (txSnap.exists) {
              const txData = txSnap.data() as TransactionDoc | undefined;

              // Require the mapped transaction to be PENDING to avoid re-processing
              if (txData && txData.status !== 'PENDING') {
                console.warn(
                  '[WEBHOOK] Mapped transaction is not PENDING, ignoring mapping:',
                  mappedTxId,
                );
              } else {
                // If amount is present in webhook, validate it matches the transaction amount
                if (
                  normalizedAmount !== null &&
                  txData &&
                  typeof txData.amount === 'number'
                ) {
                  const expected = Math.round(txData.amount);
                  const received = Math.round(normalizedAmount);
                  if (expected !== received) {
                    console.warn(
                      '[WEBHOOK] Amount mismatch for mapped transaction (customer_id):',
                      { mappedTxId, expected, received },
                    );
                    // do not return this mapping if amount mismatches
                  } else {
                    console.log(
                      '✅ [WEBHOOK SERVICE] Found transaction via virtual_account_mappings (customer_id):',
                      mappedTxId,
                    );
                    return txSnap;
                  }
                } else {
                  // No amount to validate or no amount on transaction — accept mapping
                  console.log(
                    '✅ [WEBHOOK SERVICE] Found transaction via virtual_account_mappings (customer_id):',
                    mappedTxId,
                  );
                  return txSnap;
                }
              }
            }
          }
        }
      }

      // fallback: receiver account number mapping
      const receiverAccountRaw = receiver?.account_number;
      if (receiverAccountRaw) {
        const normalizedLookup = String(receiverAccountRaw).replace(/\D/g, '');
        if (normalizedLookup) {
          console.log(
            '🔎 [WEBHOOK SERVICE] Checking virtual_account_mappings for receiver account',
            normalizedLookup,
          );
          const mapDoc = await db
            .collection('virtual_account_mappings')
            .doc(normalizedLookup)
            .get();
          if (mapDoc.exists) {
            const mapData = mapDoc.data() as
              | { transactionId?: string; userId?: string }
              | undefined;
            const mappedTxId = mapData?.transactionId;
            if (mappedTxId) {
              const txSnap = await db
                .collection('transactions')
                .doc(mappedTxId)
                .get();
              if (txSnap.exists) {
                const txData = txSnap.data() as TransactionDoc | undefined;

                // Require PENDING and validate amount when available
                if (txData && txData.status !== 'PENDING') {
                  console.warn(
                    '[WEBHOOK] Mapped transaction (receiver) is not PENDING, ignoring:',
                    mappedTxId,
                  );
                } else if (
                  normalizedAmount !== null &&
                  txData &&
                  typeof txData.amount === 'number'
                ) {
                  const expected = Math.round(txData.amount);
                  const received = Math.round(normalizedAmount);
                  if (expected !== received) {
                    console.warn(
                      '[WEBHOOK] Amount mismatch for mapped transaction (receiver):',
                      { mappedTxId, expected, received },
                    );
                  } else {
                    console.log(
                      '✅ [WEBHOOK SERVICE] Found transaction via virtual_account_mappings (receiver):',
                      mappedTxId,
                    );
                    return txSnap;
                  }
                } else {
                  console.log(
                    '✅ [WEBHOOK SERVICE] Found transaction via virtual_account_mappings (receiver):',
                    mappedTxId,
                  );
                  return txSnap;
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(
        '⚠️ [WEBHOOK SERVICE] virtual_account_mappings lookup failed:',
        err,
      );
    }

    // Strategy 3: Match by customer_id
    if (customer?.customer_id) {
      console.log(
        '🎯 [WEBHOOK SERVICE] Strategy 3: Searching by customer_id...',
      );

      const byCustSnap = await db
        .collection('transactions')
        .where('reference', '==', String(customer.customer_id))
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

    // (amount normalization already performed earlier in this function)

    // Strategy 4: Fallback by amount + PENDING status
    if (normalizedAmount !== null) {
      console.log(
        '🎯 [WEBHOOK SERVICE] Strategy 4: Searching by amount fallback...',
      );
      // amount stored in transactions may be integer NGN for deposits
      const roundedAmount = Math.round(normalizedAmount);

      const fallbackSnap = await db
        .collection('transactions')
        .where('amount', '==', roundedAmount)
        .where('status', '==', 'PENDING')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!fallbackSnap.empty) {
        console.log(
          '✅ [WEBHOOK SERVICE] Found transaction by amount fallback:',
          roundedAmount,
        );
        return fallbackSnap.docs[0];
      }
    }

    // Strategy 5: Match by receiver account number -> virtual_accounts -> user's pending transaction
    try {
      const receiverAccount = receiver?.account_number;
      if (receiverAccount) {
        console.log(
          '🎯 [WEBHOOK SERVICE] Strategy 5: Searching by receiver account number...',
          receiverAccount,
        );

        type BankAccount = { accountNumber?: string };
        type VirtualAccountDoc = { bankAccounts?: BankAccount[] } & Record<
          string,
          unknown
        >;

        const virtualSnap = await db.collection('virtual_accounts').get();
        for (const doc of virtualSnap.docs) {
          const data = doc.data() as VirtualAccountDoc | undefined;
          const banks: BankAccount[] =
            (data?.bankAccounts as BankAccount[]) || [];

          const normalizedReceiver = String(receiverAccount).replace(/\D/g, '');
          const match = banks.find(
            (b: BankAccount) =>
              String(b?.accountNumber ?? '').replace(/\D/g, '') ===
              normalizedReceiver,
          );

          if (match) {
            const userId = doc.id;

            // look for a pending transaction for this user with the normalized amount (rounded)
            if (normalizedAmount !== null) {
              const rounded = Math.round(normalizedAmount);
              const userTxSnap = await db
                .collection('transactions')
                .where('userId', '==', userId)
                .where('status', '==', 'PENDING')
                .where('amount', '==', rounded)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

              if (!userTxSnap.empty) {
                console.log(
                  '✅ [WEBHOOK SERVICE] Found transaction by receiver account and amount:',
                  userTxSnap.docs[0].id,
                );
                return userTxSnap.docs[0];
              }
            }

            // If no amount match, return the latest pending transaction for this user
            const latestPending = await db
              .collection('transactions')
              .where('userId', '==', userId)
              .where('status', '==', 'PENDING')
              .orderBy('createdAt', 'desc')
              .limit(1)
              .get();

            if (!latestPending.empty) {
              console.log(
                '✅ [WEBHOOK SERVICE] Found transaction by receiver account (latest pending):',
                latestPending.docs[0].id,
              );
              return latestPending.docs[0];
            }
          }
        }
      }
    } catch (err) {
      console.error(
        '⚠️ [WEBHOOK SERVICE] Receiver account matching failed:',
        err,
      );
    }

    // Extra debug: log normalized amount and a small snapshot of recent pending transactions
    try {
      const pendingSnap = await db
        .collection('transactions')
        .where('status', '==', 'PENDING')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      const pendingList = pendingSnap.docs.map((d) => {
        const dd = d.data() as Record<string, unknown> | undefined;
        return {
          id: d.id,
          amount: dd && typeof dd['amount'] === 'number' ? dd['amount'] : null,
          userId: dd && typeof dd['userId'] === 'string' ? dd['userId'] : null,
          reference:
            dd && typeof dd['reference'] === 'string' ? dd['reference'] : null,
        };
      });

      const virtualSnap = await db.collection('virtual_accounts').get();
      const virtualSummary = virtualSnap.docs.map((d) => {
        const vd = d.data() as Record<string, unknown> | undefined;
        const rawBanks =
          vd && Array.isArray(vd['bankAccounts'])
            ? (vd['bankAccounts'] as unknown[])
            : [];
        const bankAccounts = rawBanks.map((b) => {
          const rb = b as Record<string, unknown> | undefined;
          const acc =
            rb && typeof rb['accountNumber'] === 'string'
              ? rb['accountNumber']
              : '';
          return { accountNumber: acc };
        });
        return { id: d.id, bankAccounts };
      });

      console.error('❌ [WEBHOOK SERVICE] No matching transaction found', {
        transaction_id,
        customer_id: customer?.customer_id,
        amount_paid,
        normalizedAmount: normalizedAmount,
        recentPending: pendingList,
        virtualAccountsSnapshot: virtualSummary,
      });
    } catch (dbgErr) {
      console.error(
        '⚠️ [WEBHOOK SERVICE] Failed to collect debug info for unmatched webhook:',
        dbgErr,
      );
      console.error('❌ [WEBHOOK SERVICE] No matching transaction found', {
        transaction_id,
        customer_id: customer?.customer_id,
        amount_paid,
      });
    }

    return null;
  }

  private async processSuccessfulPayment(
    txId: string,
    txData: TransactionDoc,
    payload: WebhookPayload,
  ): Promise<void> {
    console.log('💰 [WEBHOOK SERVICE] Processing successful payment');
    console.log('📝 [WEBHOOK SERVICE] Transaction ID:', txId);
    console.log('👤 [WEBHOOK SERVICE] User ID:', txData.userId);

    const { transaction_id, amount_paid } = payload;

    // Get full transaction details to check type
    const txSnapshot = await db.collection('transactions').doc(txId).get();
    const fullTxData = txSnapshot.data();
    const transactionType = (fullTxData?.type as string) || null;

    console.log('🔍 [WEBHOOK SERVICE] Transaction type:', transactionType);

    // For DEPOSIT transactions we validate customer_id and amount before marking SUCCESS.
    // For non-deposit (purchase) we will mark SUCCESS below before finalization.

    // Persist provider transaction id on our transaction doc for reference/audit
    if (transaction_id) {
      try {
        await db
          .collection('transactions')
          .doc(txId)
          .update({ referenceId: String(transaction_id) });

        console.log(
          '🔗 [WEBHOOK SERVICE] Recorded provider transaction_id as referenceId:',
          transaction_id,
        );
      } catch (refErr) {
        console.warn(
          '⚠️ [WEBHOOK SERVICE] Failed to save referenceId on transaction:',
          refErr,
        );
      }
    }

    // Handle based on transaction type
    if (transactionType === 'DEPOSIT') {
      // This is a wallet deposit
      console.log('💳 [WEBHOOK SERVICE] Processing wallet deposit...');
      try {
        // --- Validate provider customer_id against our virtual_account.customer.customer_id ---
        const providerCustId =
          payload.customer && typeof payload.customer === 'object'
            ? (payload.customer as { customer_id?: string })?.customer_id
            : undefined;

        if (providerCustId) {
          try {
            const vaSnap = await db
              .collection('virtual_accounts')
              .doc(txData.userId)
              .get();
            if (vaSnap.exists) {
              const vaData = vaSnap.data() as
                | Record<string, unknown>
                | undefined;
              const vaCustObj =
                vaData && typeof vaData['customer'] === 'object'
                  ? (vaData['customer'] as { customer_id?: string })
                  : undefined;
              const expectedCustId = vaCustObj?.customer_id;
              if (
                expectedCustId &&
                String(expectedCustId).trim() !== String(providerCustId).trim()
              ) {
                console.warn(
                  '[WEBHOOK] provider customer_id does not match virtual_account customer_id for user:',
                  txData.userId,
                  { expected: expectedCustId, received: providerCustId },
                );
                // mark transaction for investigation and return
                await db.collection('transactions').doc(txId).update({
                  investigationRequired: true,
                  failureReason: 'provider_customer_id_mismatch',
                  providerCustomerId: providerCustId,
                  expectedCustomerId: expectedCustId,
                  investigationTimestamp: new Date(),
                });
                return;
              }
            }
          } catch (vaErr) {
            console.warn(
              '[WEBHOOK] Failed to validate virtual_account customer_id:',
              vaErr,
            );
          }
        }

        // --- Validate amount if provided ---
        let normalizedAmount: number | null = null;
        if (typeof amount_paid === 'number') normalizedAmount = amount_paid;
        else if (typeof amount_paid === 'string') {
          const parsed = parseFloat(amount_paid.replace(/,/g, ''));
          if (!Number.isNaN(parsed)) normalizedAmount = parsed;
        }

        if (
          normalizedAmount !== null &&
          typeof fullTxData?.amount === 'number'
        ) {
          const expected = Math.round(fullTxData.amount);
          const received = Math.round(normalizedAmount);
          if (expected !== received) {
            console.warn('[WEBHOOK] Amount mismatch for transaction:', txId, {
              expected,
              received,
            });
            await db.collection('transactions').doc(txId).update({
              investigationRequired: true,
              failureReason: 'amount_mismatch',
              expectedAmount: expected,
              receivedAmount: received,
              investigationTimestamp: new Date(),
            });
            return;
          }
        }

        // All validations passed — mark transaction SUCCESS and record provider reference
        await this.transactionsService.update(
          txId,
          { status: 'SUCCESS' },
          `Payment confirmed by PaymentPoint: ${transaction_id ?? 'n/a'}`,
        );

        if (transaction_id) {
          try {
            await db
              .collection('transactions')
              .doc(txId)
              .update({ referenceId: String(transaction_id) });
            console.log(
              '🔗 [WEBHOOK SERVICE] Recorded provider transaction_id as referenceId:',
              transaction_id,
            );
          } catch (refErr) {
            console.warn(
              '⚠️ [WEBHOOK SERVICE] Failed to save referenceId on transaction:',
              refErr,
            );
          }
        }
        // Normalize deposit amount to a number (fullTxData.amount preferred)
        const rawAmount =
          (fullTxData?.amount as number | undefined) ?? amount_paid ?? 0;
        let depositAmount = 0;
        if (typeof rawAmount === 'number') depositAmount = rawAmount;
        else if (typeof rawAmount === 'string') {
          const parsed = parseFloat(rawAmount.replace(/,/g, ''));
          depositAmount = Number.isNaN(parsed) ? 0 : parsed;
        }

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

        // Remove mapping using provider customer_id when available; fallback to receiver account
        try {
          const custKey =
            payload.customer && typeof payload.customer === 'object'
              ? (payload.customer as { customer_id?: string })?.customer_id
              : undefined;

          if (custKey) {
            const key = String(custKey).trim();
            await db.collection('virtual_account_mappings').doc(key).delete();
            console.log(
              '[WEBHOOK] Removed virtual_account_mappings for customer_id',
              key,
            );
          } else {
            const receiverAccountRaw =
              payload.receiver && typeof payload.receiver === 'object'
                ? (payload.receiver as { account_number?: string })
                    ?.account_number
                : undefined;

            if (receiverAccountRaw) {
              const normalized = String(receiverAccountRaw).replace(/\D/g, '');
              if (normalized) {
                await db
                  .collection('virtual_account_mappings')
                  .doc(normalized)
                  .delete();

                console.log(
                  '[WEBHOOK] Removed virtual_account_mappings for',
                  normalized,
                );
              }
            }
          }
        } catch (delErr) {
          console.warn(
            '[WEBHOOK] Failed to delete virtual_account_mappings entry:',
            delErr,
          );
        }
      } catch (err) {
        console.error(
          '❌ [WEBHOOK SERVICE] Error processing wallet deposit:',
          txId,
          err,
        );
      }
    } else {
      // This is a proxy purchase
      console.log(
        '🚀 [WEBHOOK SERVICE] Processing proxy purchase for transaction:',
        txId,
      );

      try {
        // Validate that this is actually a purchase transaction
        const transactionDoc = await db
          .collection('transactions')
          .doc(txId)
          .get();

        if (!transactionDoc.exists) {
          console.warn(
            '⚠️ [WEBHOOK SERVICE] Transaction document not found:',
            txId,
          );
          return;
        }

        const transactionData = transactionDoc.data();

        if (transactionData?.type !== 'purchase') {
          console.warn(
            '⚠️ [WEBHOOK SERVICE] Transaction is not a purchase type:',
            {
              transactionId: txId,
              actualType: transactionData?.type as string,
            },
          );
          return;
        }

        const purchase = await this.proxyOrderService.finalizePurchase(txId);

        if (purchase) {
          console.log(
            '✅ [WEBHOOK SERVICE] Proxy purchase completed successfully:',
            {
              transactionId: txId,
              purchaseId: purchase.id,
              userId: purchase.userId,
              serviceId: purchase.serviceId,
            },
          );

          // Update transaction with purchase completion
          await db.collection('transactions').doc(txId).update({
            purchaseCompleted: true,
            purchaseId: purchase.id,
            completedAt: new Date(),
          });
        } else {
          console.warn(
            '⚠️ [WEBHOOK SERVICE] No pending purchase found for transaction:',
            txId,
          );

          // Mark transaction for investigation
          await db.collection('transactions').doc(txId).update({
            purchaseCompletionFailed: true,
            failureReason: 'No pending purchase found',
            investigationRequired: true,
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';

        console.error('❌ [WEBHOOK SERVICE] Failed to finalize purchase:', {
          transactionId: txId,
          error: errorMessage,
        });

        // Record the error in the transaction for investigation
        await db.collection('transactions').doc(txId).update({
          purchaseCompletionFailed: true,
          failureReason: errorMessage,
          investigationRequired: true,
          errorTimestamp: new Date(),
        });

        // Note: Transaction payment status remains SUCCESS as payment was confirmed
        // The purchase finalization can be retried manually or via admin interface
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
    const { transaction_status } = payload;

    // Update transaction status and create a single history entry via TransactionsService
    await this.transactionsService.update(
      txId,
      { status: 'FAILED' },
      `Payment failed or not successful: ${transaction_status}`,
    );
    console.log('❌ Transaction marked as FAILED and history recorded:', txId);
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
      transaction_status === 'successful' ||
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
