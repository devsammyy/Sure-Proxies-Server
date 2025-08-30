import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from 'src/modules/auth/auth.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authSvc: AuthService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<Request>();
    const isValid = await this.authSvc.validateRequest(request);
    if (!isValid) return false;

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Type user object for safety
    interface UserWithRole {
      role?: string;
      [key: string]: unknown;
    }
    const user = (request as { user?: UserWithRole }).user;
    if (!user || typeof user.role !== 'string') {
      throw new ForbiddenException('User role not found');
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
