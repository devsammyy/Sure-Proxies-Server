import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateTransactionDto, UpdateTransactionDto } from './transaction.dto';

import { ApAuthGuard } from 'src/modules/auth/auth-guard.decorator';
import { UserRole } from 'src/modules/user/user.model';
import { TransactionsService } from './transaction.service';

@ApAuthGuard(UserRole.USER)
@ApiBearerAuth('access-token')
@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Create a new transaction for a user' })
  create(@Param('userId') userId: string, @Body() dto: CreateTransactionDto) {
    return this.service.create(userId, dto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get all transactions for a user' })
  findAll(@Param('userId') userId: string) {
    return this.service.findAll(userId);
  }

  @Get('status/:transactionId')
  @ApiOperation({ summary: 'Get transaction status by transaction ID' })
  async getTransactionStatus(@Param('transactionId') transactionId: string) {
    return await this.service.getTransactionById(transactionId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction status' })
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.service.update(id, dto);
  }

  @Get('transaction/:transactionId')
  @ApiOperation({ summary: 'Get history for a specific transaction' })
  async getTransactionHistory(@Param('transactionId') transactionId: string) {
    return this.service.getTransactionHistoryByTransactionId(transactionId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all transaction histories for a user' })
  async getTransactionHistoryByUserId(@Param('userId') userId: string) {
    return this.service.getTransactionHistoryByUserId(userId);
  }
}
