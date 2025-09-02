import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { Request } from 'express';
import { db, dbAuth } from 'src/main';
import { TokenResponse } from 'src/modules/auth/auth.model';
import { LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  async login(model: LoginDto): Promise<TokenResponse> {
    const { email, password } = model;
    try {
      const { idToken, refreshToken, expiresIn } =
        await this.signInWithEmailAndPassword(email, password);
      return { idToken, refreshToken, expiresIn };
    } catch (error: any) {
      console.error(error?.response?.data || error, 'Error logging in user');
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  private async signInWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<{ idToken: string; refreshToken: string; expiresIn: string }> {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;
    return await this.sendPostRequest(url, {
      email,
      password,
      returnSecureToken: true,
    });
  }

  private async sendPostRequest<T>(url: string, data: any): Promise<T> {
    try {
      const response = await axios.post<T>(url, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error(error, 'Error sending POST request');
      throw new UnauthorizedException('Authentication failed');
    }
  }

  async validateRequest(req: Request): Promise<boolean> {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        "Invalid authorization format. Use 'Bearer <token>'",
      );
    }

    try {
      const decodedToken = await dbAuth.verifyIdToken(token);
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();

      if (!userDoc.exists) {
        throw new UnauthorizedException('User not found');
      }

      const docData = userDoc.data() as { role?: string } | undefined;
      const userData = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: docData?.role ?? 'user',
      };

      (req as any).user = userData;
      return true;
    } catch (error) {
      console.error('Error verifying token: ', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
