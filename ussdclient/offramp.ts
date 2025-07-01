import { AppDataSource } from './database';
import { WalletEntity, FiatTransactionEntity } from './database';
import { DepositResult, WithdrawResult } from '../types';

export class OfframpModule {
 
  private readonly WITHDRAWAL_FEE = 0.02; // 2% fee

  constructor() {
  
  }

  /**
   * Simulate fiat-to-crypto deposit
   * Returns USDA at 1:1 ratio after 60s delay
   */
  public async depositFiat(phone: string, amountUsd: number): Promise<DepositResult> {
    try {
      if (amountUsd <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Check if wallet exists
      const walletExists = await this.checkWalletExists(phone);
      if (!walletExists) {
        throw new Error('Wallet not found. Please create a wallet first.');
      }

      // Record transaction
      await this.recordTransaction(phone, 'deposit', amountUsd, 'pending');

      // Simulate 60-second delay
      console.log(`Processing deposit of $${amountUsd} for ${phone}...`);
      
      // In a real implementation, you would integrate with actual payment processors
      // For MVP, we simulate the delay and process immediately
      setTimeout(async () => {
        await this.processDeposit(phone, amountUsd);
      }, 1000); // Reduced to 1 second for demo purposes

      return {
        status: 'success',
        usda: amountUsd,
        message: `Deposit of $${amountUsd} is being processed. You will receive ${amountUsd} USDA.`
      };
    } catch (error) {
      throw new Error(`Deposit failed: ${error}`);
    }
  }

  /**
   * Simulate crypto-to-fiat withdrawal
   * Returns success message with 2% fee deducted
   */
  public async withdrawFiat(phone: string, amountUsd: number): Promise<WithdrawResult> {
    try {
      if (amountUsd <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Check balance
      const balance = await this.getBalance(phone);
      if (balance < amountUsd) {
        throw new Error(`Insufficient balance. Available: ${balance} USDA`);
      }

      // Calculate amount after fee
      const amountAfterFee = amountUsd * (1 - this.WITHDRAWAL_FEE);
      
      // Deduct from balance
      await this.recordTransaction(phone, 'withdraw', amountUsd, 'completed');

      return {
        status: 'success',
        message: `$${amountAfterFee.toFixed(2)} sent to your bank account`,
        amount_sent: amountAfterFee
      };
    } catch (error) {
      throw new Error(`Withdrawal failed: ${error}`);
    }
  }

  private async processDeposit(phone: string, amount: number): Promise<void> {
    try {
      // No need to update a balance table, just update transaction status
      await this.updateTransactionStatus(phone, 'deposit', amount, 'completed');
      console.log(`Deposit processed: ${amount} USDA added to ${phone}`);
    } catch (error) {
      console.error('Error processing deposit:', error);
    }
  }

  private async checkWalletExists(phone: string): Promise<boolean> {
    const walletRepo = AppDataSource.getRepository(WalletEntity);
    const wallet = await walletRepo.findOneBy({ phone });
    return !!wallet;
  }

  private async getBalance(phone: string): Promise<number> {
    const txRepo = AppDataSource.getRepository(FiatTransactionEntity);
    // Sum all completed deposits and subtract all completed withdrawals
    const deposits = await txRepo.findBy({ phone, type: 'deposit', status: 'completed' });
    const withdrawals = await txRepo.findBy({ phone, type: 'withdraw', status: 'completed' });

    const depositSum = deposits.reduce((sum, tx) => sum + tx.amount, 0);
    const withdrawalSum = withdrawals.reduce((sum, tx) => sum + tx.amount, 0);

    return depositSum - withdrawalSum;
  }

  private async recordTransaction(phone: string, type: string, amount: number, status: string): Promise<void> {
    const txRepo = AppDataSource.getRepository(FiatTransactionEntity);
    const transaction = txRepo.create({
      phone,
      type,
      amount,
      status,
      created_at: new Date(),
      transactionhash: '', // You can fill this if you have a hash
    });
    await txRepo.save(transaction);
  }

  private async updateTransactionStatus(phone: string, type: string, amount: number, status: string): Promise<void> {
    const txRepo = AppDataSource.getRepository(FiatTransactionEntity);
    // Find the most recent pending transaction
    const transaction = await txRepo.findOne({
      where: { phone, type, amount, status: 'pending' },
      order: { created_at: 'DESC' }
    });
    if (transaction) {
      transaction.status = status;
      await txRepo.save(transaction);
    }
  }
}