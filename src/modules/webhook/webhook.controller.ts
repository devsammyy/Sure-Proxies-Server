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

type WebhookPayload = {
  transaction_id?: string;
  [key: string]: unknown;
};

@Controller('webhook')
export class WebhookController {
  private securityKey = process.env.PAYMENTPOINT_SECRET!;

  @Post()
  handleWebhook(
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

      // 🔑 use rawBody for HMAC
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

      // 🔑 use parsed body for data
      const payload = req.body as WebhookPayload;

      console.log('✅ Webhook received:', payload);

      return res.status(HttpStatus.OK).json({ status: 'success' });
    } catch (err) {
      console.error('Webhook error:', err);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'Server error' });
    }
  }
}
