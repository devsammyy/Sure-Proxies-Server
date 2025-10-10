import { BadRequestException, Injectable } from '@nestjs/common';
import { db } from 'src/main';
import { TransactionsService } from '../transaction/transaction.service';
import { Wallet, WalletTransaction, WithdrawalRequest } from './wallet.model';

@Injectable()
export class WalletService {
  private walletCollection = 'wallets';
  private walletTransactionCollection = 'wallet_transactions';

  constructor(private transactionsService: TransactionsService) {}

  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const walletSnapshot = await db
      .collection(this.walletCollection)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!walletSnapshot.empty) {
      const doc = walletSnapshot.docs[0];
      return doc.data() as Wallet;
    }

    // Create new wallet
    const walletId = db.collection(this.walletCollection).doc().id;
    const newWallet: Wallet = {
      id: walletId,
      userId,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection(this.walletCollection).doc(walletId).set(newWallet);
    return newWallet;
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getOrCreateWallet(userId);
    return wallet.balance;
  }

  async initiateDeposit(
    userId: string,
    amount: number,
  ): Promise<{ transactionId: string; message: string }> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Create a transaction record for the deposit
    const transaction = await this.transactionsService.create(userId, {
      type: 'DEPOSIT',
      amount,
      reference: `DEPOSIT-${Date.now()}`,
    });

    // Create wallet transaction record
    await this.createWalletTransaction({
      userId,
      type: 'DEPOSIT',
      amount,
      status: 'PENDING',
      description: `Wallet deposit of $${amount}`,
      referenceId: transaction.id,
    });

    return {
      transactionId: transaction.id,
      message:
        'Deposit initiated. Transfer the amount to your virtual account to complete the deposit.',
    };
  }

  async processDeposit(
    userId: string,
    transactionId: string,
    amount: number,
  ): Promise<void> {
    // Step 1: Update transaction status to SUCCESS first
    await this.transactionsService.update(transactionId, { status: 'SUCCESS' });
    console.log(`✅ [WALLET] Transaction ${transactionId} marked as SUCCESS`);

    // Step 2: Update wallet balance using Firestore transaction
    const wallet = await this.getOrCreateWallet(userId);
    const walletRef = db.collection(this.walletCollection).doc(wallet.id);

    await db.runTransaction(async (transaction) => {
      const walletDoc = await transaction.get(walletRef);

      if (!walletDoc.exists) {
        throw new BadRequestException('Wallet not found');
      }

      const currentWallet = walletDoc.data() as Wallet;
      const newBalance = currentWallet.balance + amount;

      // Update wallet balance atomically
      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: new Date(),
      });

      // Find and update wallet transaction status
      const walletTxSnapshot = await db
        .collection(this.walletTransactionCollection)
        .where('referenceId', '==', transactionId)
        .where('type', '==', 'DEPOSIT')
        .limit(1)
        .get();

      if (!walletTxSnapshot.empty) {
        const doc = walletTxSnapshot.docs[0];
        transaction.update(
          db.collection(this.walletTransactionCollection).doc(doc.id),
          {
            status: 'SUCCESS',
            updatedAt: new Date(),
          },
        );
      }
    });

    console.log(
      `✅ [WALLET] Deposit processed: $${amount} added to wallet ${wallet.id}`,
    );
  }

  async requestWithdrawal(
    userId: string,
    request: WithdrawalRequest,
  ): Promise<{ message: string; transactionId: string }> {
    if (request.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);

    if (wallet.balance < request.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Step 1: Create transaction record first
    const transaction = await this.transactionsService.create(userId, {
      type: 'WITHDRAWAL',
      amount: request.amount,
      reference: `WD-${Date.now()}`,
    });

    console.log(
      `📝 [WALLET] Withdrawal transaction created: ${transaction.id}`,
    );

    // Step 2: Deduct from wallet using Firestore transaction
    const walletRef = db.collection(this.walletCollection).doc(wallet.id);

    try {
      await db.runTransaction(async (firestoreTx) => {
        const walletDoc = await firestoreTx.get(walletRef);

        if (!walletDoc.exists) {
          throw new BadRequestException('Wallet not found');
        }

        const currentWallet = walletDoc.data() as Wallet;

        // Double-check balance inside transaction
        if (currentWallet.balance < request.amount) {
          throw new BadRequestException('Insufficient balance');
        }

        const newBalance = currentWallet.balance - request.amount;

        // Deduct from wallet atomically
        firestoreTx.update(walletRef, {
          balance: newBalance,
          updatedAt: new Date(),
        });
      });

      // Step 3: Create wallet transaction record
      await this.createWalletTransaction({
        userId,
        type: 'WITHDRAWAL',
        amount: request.amount,
        status: 'PENDING',
        description: `Withdrawal of $${request.amount} to ${request.bankName} - ${request.accountName}`,
        referenceId: transaction.id,
      });

      console.log(
        `✅ [WALLET] Withdrawal processed: $${request.amount} deducted from wallet ${wallet.id}`,
      );

      return {
        transactionId: transaction.id,
        message: `Withdrawal request for $${request.amount} submitted successfully. Funds will be sent to ${request.bankName} - ${request.accountName}`,
      };
    } catch (error) {
      // If wallet deduction fails, mark transaction as FAILED
      await this.transactionsService.update(transaction.id, {
        status: 'FAILED',
      });
      throw error;
    }
  }

  async deductForPurchase(
    userId: string,
    amount: number,
    description: string,
  ): Promise<string> {
    const wallet = await this.getOrCreateWallet(userId);

    if (wallet.balance < amount) {
      throw new BadRequestException(
        'Insufficient wallet balance for this purchase',
      );
    }

    // Step 1: Create transaction record first
    const transaction = await this.transactionsService.create(userId, {
      type: 'DEPOSIT', // Using DEPOSIT type for consistency with proxy purchases
      amount,
      reference: `WALLET-PURCHASE-${Date.now()}`,
    });

    console.log(`📝 [WALLET] Purchase transaction created: ${transaction.id}`);

    // Step 2: Deduct from wallet using Firestore transaction
    const walletRef = db.collection(this.walletCollection).doc(wallet.id);

    try {
      await db.runTransaction(async (firestoreTx) => {
        const walletDoc = await firestoreTx.get(walletRef);

        if (!walletDoc.exists) {
          throw new BadRequestException('Wallet not found');
        }

        const currentWallet = walletDoc.data() as Wallet;

        // Double-check balance inside transaction
        if (currentWallet.balance < amount) {
          throw new BadRequestException(
            'Insufficient wallet balance for this purchase',
          );
        }

        const newBalance = currentWallet.balance - amount;

        // Deduct from wallet atomically
        firestoreTx.update(walletRef, {
          balance: newBalance,
          updatedAt: new Date(),
        });
      });

      // Step 3: Mark transaction as SUCCESS
      await this.transactionsService.update(transaction.id, {
        status: 'SUCCESS',
      });

      // Step 4: Create wallet transaction record
      await this.createWalletTransaction({
        userId,
        type: 'PURCHASE',
        amount,
        status: 'SUCCESS',
        description: description || `Purchase deduction of $${amount}`,
        referenceId: transaction.id,
      });

      console.log(
        `✅ [WALLET] Purchase deducted: $${amount} from wallet ${wallet.id}`,
      );

      return transaction.id;
    } catch (error) {
      // If wallet deduction fails, mark transaction as FAILED
      await this.transactionsService.update(transaction.id, {
        status: 'FAILED',
      });
      throw error;
    }
  }

  async getTransactions(userId: string): Promise<WalletTransaction[]> {
    const snapshot = await db
      .collection(this.walletTransactionCollection)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map((doc) => doc.data() as WalletTransaction);
  }

  /**
   * Refund amount back to wallet (e.g., failed purchase, cancellation)
   * Uses Firestore transaction for atomicity
   */
  async refundToWallet(
    userId: string,
    amount: number,
    description: string,
  ): Promise<string> {
    if (amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }

    // Step 1: Create transaction record first
    const transaction = await this.transactionsService.create(userId, {
      type: 'DEPOSIT', // Refund increases balance, similar to deposit
      amount,
      reference: `REFUND-${Date.now()}`,
    });

    console.log(`📝 [WALLET] Refund transaction created: ${transaction.id}`);

    // Step 2: Add to wallet using Firestore transaction
    const wallet = await this.getOrCreateWallet(userId);
    const walletRef = db.collection(this.walletCollection).doc(wallet.id);

    try {
      await db.runTransaction(async (firestoreTx) => {
        const walletDoc = await firestoreTx.get(walletRef);

        if (!walletDoc.exists) {
          throw new BadRequestException('Wallet not found');
        }

        const currentWallet = walletDoc.data() as Wallet;
        const newBalance = currentWallet.balance + amount;

        // Add to wallet atomically
        firestoreTx.update(walletRef, {
          balance: newBalance,
          updatedAt: new Date(),
        });
      });

      // Step 3: Mark transaction as SUCCESS
      await this.transactionsService.update(transaction.id, {
        status: 'SUCCESS',
      });

      // Step 4: Create wallet transaction record
      await this.createWalletTransaction({
        userId,
        type: 'REFUND',
        amount,
        status: 'SUCCESS',
        description: description || `Refund of $${amount}`,
        referenceId: transaction.id,
      });

      console.log(
        `✅ [WALLET] Refund processed: $${amount} added to wallet ${wallet.id}`,
      );

      return transaction.id;
    } catch (error) {
      // If wallet update fails, mark transaction as FAILED
      await this.transactionsService.update(transaction.id, {
        status: 'FAILED',
      });
      throw error;
    }
  }

  private async createWalletTransaction(
    data: Omit<
      WalletTransaction,
      'id' | 'walletId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<WalletTransaction> {
    const wallet = await this.getOrCreateWallet(data.userId);
    const id = db.collection(this.walletTransactionCollection).doc().id;

    const transaction: WalletTransaction = {
      id,
      walletId: wallet.id,
      userId: data.userId,
      type: data.type,
      amount: data.amount,
      status: data.status,
      description: data.description,
      referenceId: data.referenceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db
      .collection(this.walletTransactionCollection)
      .doc(id)
      .set(transaction);

    return transaction;
  }
}
