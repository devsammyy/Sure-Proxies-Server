export class UserModel {
  uid: string;
  email: string;
  fullName: string;
  createdAt: number;
  lastLogin: number;
  purchases: any[];
  role: 'user' | 'admin';
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}
