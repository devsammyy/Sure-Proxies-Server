import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { db, dbAuth } from 'src/main';
import { VirtualAccountResponse } from 'src/modules/account/virtual/account.model';
import { PaymentpointService } from 'src/modules/paymentpoint/paymentpoint.service';
import { UserDoc, UserRole } from 'src/modules/user/user.model';
import { CreateUserDTO } from './user.dto';

@Injectable()
export class UserService {
  constructor(private readonly paymentPointService: PaymentpointService) {}

  public async create(model: CreateUserDTO): Promise<UserDoc> {
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
        phoneNumber: model.phoneNumber,
        createdAt: admin.firestore.Timestamp.now(),
        lastLogin: admin.firestore.Timestamp.now(),
        purchases: [],
        role: UserRole.USER,
      } as UserDoc);

      const userDoc = await db.collection('users').doc(record.uid).get();
      const data = userDoc.data() as UserDoc | undefined;

      if (!data) {
        throw new Error('User not found after creation');
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
      await userRef.set(userData).then(async () => {
        await this.paymentPointService
          .createVirtualAccount({
            email: userData.email,
            name: userData.fullName,
            phoneNumber: userData.phoneNumber,
          })
          .then(async (virtual: VirtualAccountResponse) => {
            const virtualAccountRef = db
              .collection('virtual_accounts')
              .doc(userId);
            await virtualAccountRef.set(virtual);
          });
      });
    } catch (error) {
      console.error('Saving user in db', error);
      throw new Error('Error saving user');
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
      throw new Error('User not found');
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
