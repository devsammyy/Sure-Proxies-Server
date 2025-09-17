import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import * as firebaseAdmin from 'firebase-admin';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // Handle NestJS built-in HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'message' in res) {
        message = (res as { message?: string }).message || 'Unexpected error';
      } else if (typeof res === 'string') {
        message = res;
      } else {
        message = 'Unexpected error';
      }
    }

    // Handle Firebase errors
    else if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception
    ) {
      const firebaseError = exception as firebaseAdmin.FirebaseError;
      status = this.mapFirebaseErrorCode(firebaseError.code);
      message = firebaseError.message;
    }

    // Handle unknown/unexpected errors
    else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
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
