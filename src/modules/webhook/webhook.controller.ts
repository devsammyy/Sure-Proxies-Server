// src/webhook/webhook.controller.ts
import {
  BadRequestException,
  Controller,
  Headers,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WebhookPayload, WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  async handleWebhook(
    @Req() req: Request & { rawBody?: string },
    @Res() res: Response,
    @Headers('paymentpoint-signature') signature: string,
  ) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 [WEBHOOK CONTROLLER] Incoming webhook request');
    console.log('⏰ [WEBHOOK CONTROLLER] Timestamp:', new Date().toISOString());
    console.log('🔗 [WEBHOOK CONTROLLER] URL:', req.url);
    console.log('📨 [WEBHOOK CONTROLLER] Method:', req.method);
    console.log('🌐 [WEBHOOK CONTROLLER] IP:', req.ip);
    console.log(
      '📋 [WEBHOOK CONTROLLER] Headers:',
      JSON.stringify(req.headers, null, 2),
    );
    console.log('='.repeat(80) + '\n');

    try {
      // Validate raw body exists
      if (!req.rawBody) {
        console.error(
          '❌ [WEBHOOK CONTROLLER] rawBody is missing from request',
        );
        throw new BadRequestException('Missing raw body');
      }

      console.log(
        '✅ [WEBHOOK CONTROLLER] Raw body present, length:',
        req.rawBody.length,
      );

      // Validate signature header exists
      if (!signature) {
        console.error('❌ [WEBHOOK CONTROLLER] signature header is missing');
        throw new BadRequestException('Missing signature header');
      }

      console.log(
        '🔑 [WEBHOOK CONTROLLER] Signature header present:',
        signature,
      );

      // Verify webhook signature
      console.log('🔐 [WEBHOOK CONTROLLER] Verifying signature...');
      const isValidSignature = this.webhookService.verifySignature(
        req.rawBody,
        signature,
      );

      if (!isValidSignature) {
        console.error('❌ [WEBHOOK CONTROLLER] Invalid signature!');
        throw new UnauthorizedException('Invalid signature');
      }

      console.log('✅ [WEBHOOK CONTROLLER] Signature verified successfully');

      // Parse payload
      const payload = req.body as WebhookPayload;
      console.log(
        '📦 [WEBHOOK CONTROLLER] Parsed payload:',
        JSON.stringify(payload, null, 2),
      );

      // Process transaction through service
      console.log('⚙️  [WEBHOOK CONTROLLER] Processing transaction...');
      const result = await this.webhookService.processTransaction(payload);

      console.log('✨ [WEBHOOK CONTROLLER] Transaction processed successfully');
      console.log(
        '📤 [WEBHOOK CONTROLLER] Result:',
        JSON.stringify(result, null, 2),
      );

      // Return appropriate response based on result
      return res.status(HttpStatus.OK).json(result);
    } catch (err) {
      console.error('❌ [WEBHOOK CONTROLLER] Error:', err);

      // Handle known exceptions
      if (err instanceof BadRequestException) {
        console.error('🚫 [WEBHOOK CONTROLLER] Bad request:', err.message);
        return res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
      }

      if (err instanceof UnauthorizedException) {
        console.error('🔒 [WEBHOOK CONTROLLER] Unauthorized:', err.message);
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: err.message });
      }

      // Handle unknown errors
      console.error('💥 [WEBHOOK CONTROLLER] Internal error:', err);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'Internal server error' });
    }
  }
}
