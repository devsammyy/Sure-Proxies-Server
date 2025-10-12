import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { db, dbAuth } from 'src/main';
import { UserDoc, UserRole } from 'src/modules/user/user.model';
import { CreateUserDTO } from './user.dto';

@Injectable()
export class UserService {
  public async create(model: CreateUserDTO): Promise<UserDoc> {
    try {
      const record = await dbAuth.createUser({
        displayName: model.fullName,
        email: model.email,
        password: model.password,
      });

      if (!record) {
        throw new HttpException(
          'Unable to create account. Please try again.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      await this.saveUser(record.uid, {
        uid: record.uid,
        email: model.email,
        fullName: model.fullName,
        phoneNumber: model.phoneNumber,
        createdAt: admin.firestore.Timestamp.now(),
        lastLogin: admin.firestore.Timestamp.now(),
        purchases: [],
        role: UserRole.USER,
      } as UserDoc);

      const userDoc = await db.collection('users').doc(record.uid).get();
      const data = userDoc.data() as UserDoc | undefined;

      if (!data) {
        throw new HttpException(
          'Account created but verification failed. Please contact support.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        uid: data.uid,
        email: data.email,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        createdAt: data.createdAt,
        lastLogin: data.lastLogin,
        purchases: data.purchases,
        role: data.role,
      };
    } catch (error: unknown) {
      console.error(error, 'Error creating user');
      throw error;
    }
  }

  async saveUser(userId: string, userData: UserDoc): Promise<void> {
    try {
      const userRef = db.collection('users').doc(userId);
      // ✅ Just save the user - virtual accounts created on first purchase
      await userRef.set(userData);
    } catch (error) {
      console.error('❌ [USER] Error saving user in db:', error);
      throw new HttpException(
        'Unable to save account information. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async findAll(): Promise<UserDoc[]> {
    const usersSnapshot = await db.collection('users').get();

    return usersSnapshot.docs.map((doc) => {
      const data = doc.data() as UserDoc | undefined;

      return {
        uid: data?.uid,
        email: data?.email,
        fullName: data?.fullName,
        phoneNumber: data?.phoneNumber,
        createdAt: data?.createdAt,
        lastLogin: data?.lastLogin,
        purchases: (data?.purchases as unknown[]) ?? [],
        role: data?.role ?? UserRole.USER,
      } as UserDoc;
    });
  }

  async findOne(id: string) {
    const user = await db.collection('users').doc(id).get();
    if (!user.exists) {
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }
    return { id: user.id, ...user.data() };
  }

  async update(id: string, model: UserDoc) {
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
