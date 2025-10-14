export interface Wallet {
  id: string;
  userId: string;
  balance: number; // in NGN (Naira)
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE' | 'REFUND';
  amount: number; // in NGN
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  description: string;
  referenceId?: string; // transaction ID or payment reference
  createdAt: Date;
  updatedAt: Date;
}

export interface DepositRequest {
  amount: number; // in NGN
}

export interface WithdrawalRequest {
  amount: number; // in NGN
  bankAccountNumber: string;
  bankName: string;
  accountName: string;
}
