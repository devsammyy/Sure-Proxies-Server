export interface Wallet {
  id: string;
  userId: string;
  balance: number; // in USD
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE' | 'REFUND';
  amount: number; // in USD
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  description: string;
  referenceId?: string; // transaction ID or payment reference
  createdAt: Date;
  updatedAt: Date;
}

export interface DepositRequest {
  amount: number; // in USD
}

export interface WithdrawalRequest {
  amount: number; // in USD
  bankAccountNumber: string;
  bankName: string;
  accountName: string;
}
