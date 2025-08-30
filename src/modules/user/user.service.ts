import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { db, dbAuth } from 'src/main';
import { UserModel, UserRole } from 'src/modules/user/user.model';
import { CreateUserDTO, UpdateUserDto } from './user.dto';

@Injectable()
export class UserService {
  public async create(model: CreateUserDTO): Promise<UserModel> {
    try {
      const record = await dbAuth.createUser({
        displayName: model.fullName,
        email: model.email,
        password: model.password,
      });

      if (!record) {
        throw new Error('User creation failed');
      }
      await this.saveUser(record.uid, {
        uid: record.uid,
        email: model.email,
        fullName: model.fullName,
        createdAt: admin.firestore.Timestamp.now(),
        lastLogin: admin.firestore.Timestamp.now(),
        purchases: [],
        role: UserRole.USER,
      });

      const userDoc = await db.collection('users').doc(record.uid).get();
      const data = userDoc.data() as
        | {
            uid: string;
            email: string;
            fullName: string;
            createdAt: admin.firestore.Timestamp;
            lastLogin: admin.firestore.Timestamp;
            purchases: any[];
            role: UserRole;
          }
        | undefined;

      if (!data) {
        throw new Error('User not found after creation');
      }

      // Type assertion for lastLogin and createdAt
      const createdAtTimestamp = data.createdAt;
      const lastLoginTimestamp = data.lastLogin;

      return {
        uid: data.uid,
        email: data.email,
        fullName: data.fullName,
        createdAt: createdAtTimestamp.toDate().getTime(), // 👈 timestamp number
        lastLogin: lastLoginTimestamp.toDate().getTime(), // 👈 timestamp number
        purchases: data.purchases,
        role: data.role,
      } as UserModel;
    } catch (error: unknown) {
      console.error(error, 'Error creating user');
      throw error;
    }
  }

  async saveUser(userId: string, userData: any): Promise<void> {
    const userRef = db.collection('users').doc(userId);
    await userRef.set(userData);
  }
  public async findAll(): Promise<UserModel[]> {
    const usersSnapshot = await db.collection('users').get();

    return usersSnapshot.docs.map((doc) => {
      const data = doc.data() as
        | {
            uid: string;
            email: string;
            fullName: string;
            createdAt: admin.firestore.Timestamp;
            lastLogin: admin.firestore.Timestamp;
            purchases: any[];
            role: UserRole;
          }
        | undefined;

      // Type assertion for lastLogin and createdAt
      const createdAtTimestamp = data?.createdAt;
      const lastLoginTimestamp = data?.lastLogin;
      return {
        uid: data?.uid,
        email: data?.email,
        fullName: data?.fullName,
        createdAt: createdAtTimestamp?.toDate().getTime(), // 👈 timestamp number
        lastLogin: lastLoginTimestamp?.toDate().getTime(), // 👈 timestamp number
        purchases: data?.purchases || [],
        role: data?.role,
      } as UserModel;
    });
  }

  async findOne(id: string) {
    const user = await db.collection('users').doc(id).get();
    if (!user.exists) {
      throw new Error('User not found');
    }
    return { id: user.id, ...user.data() };
  }

  async update(id: string, model: UpdateUserDto) {
    const user = await this.findOne(id);
    const updatedUser = { ...user, ...model };
    await this.saveUser(id, updatedUser);
    return updatedUser;
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    await db.collection('users').doc(id).delete();
    return user;
  }
}
