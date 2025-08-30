import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { Roles } from './roles.decorator';

export function ApAuthGuard(...roles: string[]) {
  return applyDecorators(Roles(...roles), UseGuards(AuthGuard));
}
