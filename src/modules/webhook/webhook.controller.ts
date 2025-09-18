// src/webhook/webhook.controller.ts
import {
  Controller,
  Headers,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';
import { db } from 'src/main';
import { ProxyOrderService } from 'src/modules/proxy/order/order.service';
import { TransactionsService } from 'src/modules/transaction/transaction.service';

type WebhookPayload = {
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

// Narrow the Firestore transaction shape you actually use here
interface TransactionDoc {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  userId: string;
  reference?: string;
  amount?: number;
  createdAt?: FirebaseFirestore.Timestamp | Date;
}

@Controller('webhook')
export class WebhookController {
  private securityKey = process.env.PAYMENTPOINT_SECRET!;

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly proxyOrderService: ProxyOrderService,
  ) {}

  @Post()
  async handleWebhook(
    @Req() req: Request & { rawBody?: string },
    @Res() res: Response,
    @Headers('paymentpoint-signature') signature: string,
  ) {
    try {
      if (!req.rawBody) {
        console.error('❌ rawBody is missing');
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ error: 'Missing raw body' });
      }

      if (!signature) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ error: 'Missing signature header' });
      }

      // verify signature
      const calculatedSignature = crypto
        .createHmac('sha256', this.securityKey)
        .update(req.rawBody)
        .digest('hex');

      if (calculatedSignature !== signature) {
        console.warn('❌ Invalid signature', {
          calculated: calculatedSignature,
          received: signature,
        });
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ error: 'Invalid signature' });
      }

      const payload = req.body as WebhookPayload;

      const {
        transaction_id,
        amount_paid,
        transaction_status,
        settlement_amount,
        settlement_fee,
        customer,
      } = payload;

      console.log('✅ Webhook payload:', {
        transaction_id,
        transaction_status,
        amount_paid,
      });

      // Try to find matching transaction by reference or doc id
      let txDoc: FirebaseFirestore.DocumentSnapshot | null = null;

      if (transaction_id) {
        const byRefSnap = await db
          .collection('transactions')
          .where('reference', '==', transaction_id)
          .limit(1)
          .get();
        if (!byRefSnap.empty) txDoc = byRefSnap.docs[0];
        else {
          const byIdSnap = await db
            .collection('transactions')
            .doc(transaction_id)
            .get();
          if (byIdSnap.exists) txDoc = byIdSnap;
        }
      }

      // try using customer.customer_id if provided
      if (!txDoc && customer?.customer_id) {
        const byCustSnap = await db
          .collection('transactions')
          .where('reference', '==', customer.customer_id)
          .limit(1)
          .get();
        if (!byCustSnap.empty) txDoc = byCustSnap.docs[0];
      }

      // fallback by amount + PENDING status
      if (!txDoc && typeof amount_paid === 'number') {
        const fallbackSnap = await db
          .collection('transactions')
          .where('amount', '==', amount_paid)
          .where('status', '==', 'PENDING')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        if (!fallbackSnap.empty) txDoc = fallbackSnap.docs[0];
      }

      if (!txDoc) {
        console.warn('No matching transaction found for webhook', {
          transaction_id,
          customer,
        });
        return res.status(HttpStatus.OK).json({ status: 'unmatched' });
      }

      // Do NOT use `as any`
      const txData = txDoc.data() as TransactionDoc | undefined;
      const txId = txDoc.id;

      if (!txData) {
        console.warn('Transaction snapshot has no data', { txId });
        return res.status(HttpStatus.OK).json({ status: 'no_data' });
      }

      // If already SUCCESS, respond early
      if (txData.status === 'SUCCESS') {
        console.log('Transaction already SUCCESS, ignoring webhook', txId);
        return res.status(HttpStatus.OK).json({ status: 'already_processed' });
      }

      // Update transaction status based on webhook
      if (
        transaction_status === 'success' ||
        transaction_status === 'completed'
      ) {
        await this.transactionsService.update(txId, { status: 'SUCCESS' });

        // write history entry
        await db.collection('transaction_histories').add({
          transactionId: txId,
          userId: txData.userId,
          description: `Payment confirmed by PaymentPoint: ${transaction_id ?? 'n/a'}`,
          meta: {
            transaction_id,
            amount_paid,
            settlement_amount,
            settlement_fee,
          },
          createdAt: new Date(),
        });

        // finalize purchase (idempotent)
        try {
          const purchase = await this.proxyOrderService.finalizePurchase(txId);
          if (purchase) {
            console.log('Purchase finalized and saved for transaction', txId);
          } else {
            console.log(
              'No pending purchase to finalize for transaction',
              txId,
            );
          }
        } catch (err) {
          console.error('Error finalizing purchase for transaction', txId, err);
          // do not change transaction status here; you can retry finalize later
        }
      } else {
        // mark failed
        await this.transactionsService.update(txId, { status: 'FAILED' });

        await db.collection('transaction_histories').add({
          transactionId: txId,
          userId: txData.userId,
          description: `Payment failed or not successful: ${transaction_status}`,
          meta: { transaction_id, amount_paid },
          createdAt: new Date(),
        });
      }

      return res.status(HttpStatus.OK).json({ status: 'processed' });
    } catch (err) {
      console.error('Webhook error:', err);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'Server error' });
    }
  }
}
