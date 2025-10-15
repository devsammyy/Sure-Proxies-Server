import {
  Body,
  Controller,
  Post,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { env } from 'src/config';
import { LoginDto } from 'src/modules/auth/auth.dto';
import { AuthService } from 'src/modules/auth/auth.service';

@ApiTags('Auth Module')
@Controller('auth')
export class AuthController {
  constructor(private readonly authSvc: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login a user',
    description: 'Authenticate a user and return their information.',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiResponse({ status: 200, description: 'User logged in successfully.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authSvc.login(loginDto);
    // Create session cookie (token + role) for middleware; HttpOnly for security
    try {
      const payload = Buffer.from(
        JSON.stringify({ t: result.idToken, r: result.user.role }),
        'utf8',
      ).toString('base64');
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      res.cookie('sp_auth', payload, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: twelveHoursMs,
        secure: env.NODE_ENV === 'production',
        path: '/',
      });
    } catch {
      // fail silently, login still succeeds
    }
    return result;
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user (clear auth cookie)' })
  @ApiResponse({ status: 200, description: 'User logged out.' })
  logout(@Res({ passthrough: true }) res: Response) {
    try {
      res.cookie('sp_auth', '', {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 0,
        secure: env.NODE_ENV === 'production',
        path: '/',
      });
    } catch {
      // ignore
    }
    return { success: true };
  }
}
