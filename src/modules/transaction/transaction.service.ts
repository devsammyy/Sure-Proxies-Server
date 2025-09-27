import { BadRequestException, Injectable } from '@nestjs/common';
import { db } from 'src/main';
import { CreateTransactionDto, UpdateTransactionDto } from './transaction.dto';
import { Transaction, TransactionHistory } from './transaction.model';

@Injectable()
export class TransactionsService {
  private collection = 'transactions';
  private historyCollection = 'transaction_histories';

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    const id = db.collection(this.collection).doc().id;
    const transaction: Transaction = {
      id,
      userId,
      type: dto.type,
      amount: dto.amount,
      status: 'PENDING',
      reference: dto.reference,
      createdAt: new Date(),
    };

    await db.collection(this.collection).doc(id).set(transaction);

    await this.createHistory(
      transaction.id,
      userId,
      `Transaction created: ${dto.type} of amount ${dto.amount}`,
    );

    return transaction;
  }

  private async createHistory(
    transactionId: string,
    userId: string,
    description: string,
  ): Promise<void> {
    const id = db.collection(this.historyCollection).doc().id;
    const history: TransactionHistory = {
      id,
      transactionId,
      userId,
      description,
      createdAt: new Date(),
    };
    await db.collection(this.historyCollection).doc(id).set(history);
  }

  async findAll(userId: string): Promise<Transaction[]> {
    const snapshot = await db
      .collection(this.collection)
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map((doc) => doc.data() as Transaction);
  }

  // async update(id: string, dto: UpdateTransactionDto): Promise<Transaction> {
  //   const ref = db.collection(this.collection).doc(id);
  //   const existing = await ref.get();

  //   if (!existing.exists)
  //     throw new BadRequestException('Transaction not found');

  //   const transaction = existing.data() as Transaction;

  //   await ref.update({ status: dto.status });
  //   const updated = { ...transaction, status: dto.status };

  //   await this.createHistory(
  //     id,
  //     transaction.userId,
  //     `Transaction status updated to ${dto.status}`,
  //   );

  //   if (dto.status === 'SUCCESS') {
  //     await this.createHistory(
  //       id,
  //       transaction.userId,
  //       `Transaction status updated to ${dto.status}`,
  //     );
  //   }

  //   return updated;
  // }

  async update(id: string, dto: UpdateTransactionDto): Promise<Transaction> {
    const ref = db.collection(this.collection).doc(id);
    const existing = await ref.get();

    if (!existing.exists)
      throw new BadRequestException('Transaction not found');

    const transaction = existing.data() as Transaction;

    if (transaction.status === dto.status) {
      return transaction; // no change
    }

    await ref.update({ status: dto.status });
    const updated = { ...transaction, status: dto.status };

    await this.createHistory(
      id,
      transaction.userId,
      `Transaction status updated to ${dto.status}`,
    );

    return updated;
  }

  async getTransactionHistoryByTransactionId(
    transactionId: string,
  ): Promise<TransactionHistory[]> {
    const snapshot = await db
      .collection(this.historyCollection)
      .where('transactionId', '==', transactionId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => doc.data() as TransactionHistory);
  }

  async getTransactionHistoryByUserId(
    userId: string,
  ): Promise<TransactionHistory[]> {
    const snapshot = await db
      .collection(this.historyCollection)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => doc.data() as TransactionHistory);
  }
}
