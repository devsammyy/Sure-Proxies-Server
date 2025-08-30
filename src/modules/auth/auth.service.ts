import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Request } from 'express';
import { dbAuth } from 'src/main';
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
    } catch (error: unknown) {
      console.error(error, 'Error logging in user');
      throw error;
    }
  }

  private async signInWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<{ idToken: string; refreshToken: string; expiresIn: string }> {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;
    const response: {
      idToken: string;
      refreshToken: string;
      expiresIn: string;
    } = await this.sendPostRequest(url, {
      email,
      password,
      returnSecureToken: true,
    });
    // Explicitly extract and return only the expected fields
    return {
      idToken: response.idToken,
      refreshToken: response.refreshToken,
      expiresIn: response.expiresIn,
    };
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
      throw error;
    }
  }

  async validateRequest(req: Request): Promise<boolean> {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      console.log('Authorization header not provided');
      return false;
    }
    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      console.log("Invalid authorization format. Expected 'Bearer <token>'.");
    }

    try {
      await dbAuth.verifyIdToken(token);
      return true;
    } catch (error) {
      console.error(error, 'Error verifying token: ', error);
      return false;
    }
  }
}
