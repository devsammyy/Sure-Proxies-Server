import { ApiProperty } from '@nestjs/swagger';

export class Transaction {
  @ApiProperty({ description: 'Unique transaction ID' })
  id: string;

  @ApiProperty({ description: 'The user ID linked to this transaction' })
  userId: string;

  @ApiProperty({ description: 'The wallet ID linked to this transaction' })
  walletId?: string;

  @ApiProperty({
    description: 'Type of transaction',
    enum: ['DEPOSIT', 'WITHDRAWAL', 'INVESTMENT', 'TRANSFER'],
  })
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'INVESTMENT' | 'TRANSFER';

  @ApiProperty({ description: 'Amount of money involved in this transaction' })
  amount: number;

  @ApiProperty({
    description: 'Current status of the transaction',
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
  })
  status: 'PENDING' | 'SUCCESS' | 'FAILED';

  @ApiProperty({ description: 'External reference ID for payment gateways' })
  reference: string;

  @ApiProperty({ description: 'Date transaction was created' })
  createdAt: Date;
}

export class TransactionHistory {
  @ApiProperty({ description: 'Unique ID of this history record' })
  id: string;

  @ApiProperty({ description: 'Transaction ID this history belongs to' })
  transactionId: string;

  @ApiProperty({ description: 'User ID associated with this transaction' })
  userId: string;

  @ApiProperty({ description: 'Description of the transaction activity' })
  description: string;

  @ApiProperty({ description: 'Date this history record was created' })
  createdAt: Date;
}
