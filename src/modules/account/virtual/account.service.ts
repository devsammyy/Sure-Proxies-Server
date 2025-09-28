import { Injectable } from '@nestjs/common';
import { db } from 'src/main';
import { VirtualAccountResponse } from 'src/modules/account/virtual/account.model';

@Injectable()
export class VirtualAccountService {
  async saveVirtualAccount(
    userId: string,
    userData: VirtualAccountResponse,
  ): Promise<void> {
    const accountRef = db.collection('virtual_accounts').doc(userId);
    await accountRef.set(userData);
  }

  async getVirtualAccountByUserId(
    userId: string,
  ): Promise<VirtualAccountResponse | null> {
    const accountRef = db.collection('virtual_accounts').doc(userId);
    const doc = await accountRef.get();
    return doc.exists ? (doc.data() as VirtualAccountResponse) : null;
  }
}
