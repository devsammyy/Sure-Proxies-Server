import { IsInt } from 'class-validator';

export class AccountBalanceDto {
  @IsInt()
  balance: string;
}
