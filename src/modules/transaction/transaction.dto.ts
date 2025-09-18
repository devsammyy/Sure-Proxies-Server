import { ApiProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({ description: 'The wallet ID for this transaction' })
  walletId?: string;

  @ApiProperty({
    description: 'Receiver wallet (only required for TRANSFER)',
    required: false,
  })
  receiverWalletId?: string;

  @ApiProperty({
    description: 'Type of transaction',
    enum: [
      'DEPOSIT',
      'WITHDRAWAL',
      'INVESTMENT',
      'TRANSFER',
      'INVESTMENT_SETTLEMENT',
    ],
  })
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'INVESTMENT' | 'TRANSFER';

  @ApiProperty({ description: 'Amount involved in the transaction' })
  amount: number;

  @ApiProperty({ description: 'Reference ID for external providers (if any)' })
  reference?: string;
}

export class UpdateTransactionDto {
  @ApiProperty({
    description: 'Status update for the transaction',
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
  })
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}
