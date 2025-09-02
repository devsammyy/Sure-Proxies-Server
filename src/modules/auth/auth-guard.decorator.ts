import { applyDecorators, UseGuards } from '@nestjs/common';
import { UserRole } from '../user/user.model';
import { AuthGuard } from './auth.guard';
import { Roles } from './roles.decorator'; // 👈 you'll need this decorator

export function ApAuthGuard(...roles: UserRole[]) {
  return applyDecorators(
    UseGuards(AuthGuard), // apply the auth guard
    Roles(...roles), // attach roles if provided
  );
}
