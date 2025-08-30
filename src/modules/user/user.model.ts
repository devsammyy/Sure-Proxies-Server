export class UserModel {
  uid: string;
  email: string;
  fullName: string;
  createdAt: number; // timestamp in milliseconds
  lastLogin: number; // timestamp in milliseconds
  purchases: any[];
  role: 'user' | 'admin';
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}
