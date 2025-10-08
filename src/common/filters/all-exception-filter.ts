import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as firebaseAdmin from 'firebase-admin';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorName = 'Error';
    let details: unknown = undefined;

    // Handle NestJS built-in HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        type HttpErrorResponse = {
          message?: string | string[];
          error?: string;
          details?: unknown;
          validationErrors?: unknown;
        };
        const r = res as HttpErrorResponse;
        if (r.message) {
          if (Array.isArray(r.message)) {
            message = r.message;
          } else if (typeof r.message === 'string') {
            message = r.message;
          }
        }
        if (typeof r.error === 'string') errorName = r.error;
        details = r.details ?? r.validationErrors ?? undefined;
      } else if (typeof res === 'string') {
        message = res;
      }
      errorName = exception.name || errorName;
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception
    ) {
      const firebaseError = exception as firebaseAdmin.FirebaseError;
      status = this.mapFirebaseErrorCode(firebaseError.code);
      message = firebaseError.message;
      errorName = firebaseError.code;
    } else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.name || errorName;
    }

    // Normalize message to string
    const normalizedMessage = Array.isArray(message)
      ? message.join(', ')
      : message;

    response.status(status).json({
      success: false,
      statusCode: status,
      message: normalizedMessage,
      error: errorName,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {}),
    });
  }

  private mapFirebaseErrorCode(code: string): number {
    switch (code) {
      case 'auth/email-already-exists':
      case 'auth/email-already-in-use':
        return HttpStatus.CONFLICT; // 409
      case 'auth/invalid-email':
        return HttpStatus.BAD_REQUEST; // 400
      case 'auth/user-not-found':
        return HttpStatus.NOT_FOUND; // 404
      case 'auth/weak-password':
        return HttpStatus.BAD_REQUEST; // 400
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR; // 500
    }
  }
}
