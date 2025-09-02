import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

export function ApAuthGuard() {
  return applyDecorators(UseGuards(AuthGuard));
}
