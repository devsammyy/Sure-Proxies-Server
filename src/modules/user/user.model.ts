import * as admin from 'firebase-admin';

export class UserModel {
  uid: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  createdAt: number;
  lastLogin: number;
  purchases: any[];
  role: 'user' | 'admin';
}

export interface UserDoc {
  uid: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  createdAt: admin.firestore.Timestamp;
  lastLogin: admin.firestore.Timestamp;
  purchases: unknown[];
  role: UserRole;
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}
