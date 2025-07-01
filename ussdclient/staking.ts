
// src/modules/staking.ts
import { Database } from 'sqlite3';
import { StakeRecord, Balance } from './types';

export class StakingModule {
  private db: Database;
  private readonly APR = 0.10; // 10% annual
  private readonly VESTING_DAYS = 14;
  private readonly ADA_TO_USDA_RATE = 0.22; // 1 ADA = 0.22 USDA

  constructor(database: Database) {
    this.db = database;
    this.startRewardCalculation();
  }

  /**
   * Stake USDA tokens
   */
  public async stakeUSDA(phone: string, amount: number): Promise<StakeRecord> {
    try {
      if (amount <= 0) {
        throw new Error('Stake amount must be greater than 0');
      }

      // Check balance
      const balance = await this.getBalance(phone);
      if (balance < amount) {
        throw new Error(`Insufficient balance. Available: ${balance} USDA`);
      }

      // Calculate daily reward
      const dailyReward = amount * (this.APR / 365);
      
      // Set dates
      const startDate = new Date().toISOString();
      const vestingEndDate = new Date(Date.now() + this.VESTING_DAYS * 24 * 60 * 60 * 1000).toISOString();

      // Create stake record
      const stakeRecord: StakeRecord = {
        phone,
        staked_amount: amount,
        start_date: startDate,
        vesting_end_date: vestingEndDate,
        daily_reward: dailyReward,
        total_rewards: 0,
        is_active: true
      };

      // Save stake record
      const stakeId = await this.saveStakeRecord(stakeRecord);
      stakeRecord.id = stakeId;

      // Deduct from balance
      await this.updateBalance(phone, -amount);

      // Record transaction
      await this.recordTransaction(phone, 'stake', amount);

      return stakeRecord;
    } catch (error) {
      throw new Error(`Staking failed: ${error}`);
    }
  }

  /**
   * Get user's staking information
   */
  public async getStakingInfo(phone: string): Promise<StakeRecord[]> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM stakes WHERE phone = ? AND is_active = 1';
      this.db.all(query, [phone], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get complete balance information
   */
  public async getCompleteBalance(phone: string): Promise<Balance> {
    try {
      const usdaBalance = await this.getBalance(phone);
      const stakingInfo = await this.getStakingInfo(phone);
      
      const stakedUsda = stakingInfo.reduce((total, stake) => total + stake.staked_amount, 0);
      const pendingRewards = stakingInfo.reduce((total, stake) => total + stake.total_rewards, 0);
      
      return {
        usda_balance: usdaBalance,
        staked_usda: stakedUsda,
        pending_rewards: pendingRewards,
        total_rewards: pendingRewards
      };
    } catch (error) {
      throw new Error(`Failed to get balance: ${error}`);
    }
  }

  /**
   * Unstake and withdraw (convert rewards to fiat)
   */
  public async unstakeAndWithdraw(phone: string): Promise<{ message: string; totalUsda: number; adaEquivalent: number }> {
    try {
      const stakingInfo = await this.getStakingInfo(phone);
      
      if (stakingInfo.length === 0) {
        throw new Error('No active stakes found');
      }

      let totalUsda = 0;
      let totalRewards = 0;

      // Calculate total USDA (staked + rewards)
      for (const stake of stakingInfo) {
        // Check if vesting period is complete
        const vestingEnd = new Date(stake.vesting_end_date);
        const now = new Date();
        
        if (now < vestingEnd) {
          const daysRemaining = Math.ceil((vestingEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          throw new Error(`Vesting period not complete. ${daysRemaining} days remaining.`);
        }

        totalUsda += stake.staked_amount + stake.total_rewards;
        totalRewards += stake.total_rewards;
        
        // Mark stake as inactive
        await this.deactivateStake(stake.id!);
      }

      // Convert to ADA equivalent
      const adaEquivalent = totalUsda / this.ADA_TO_USDA_RATE;

      // Add back to balance
      await this.updateBalance(phone, totalUsda);

      // Record transaction
      await this.recordTransaction(phone, 'unstake', totalUsda);

      return {
        message: `Unstaked successfully! Total: ${totalUsda.toFixed(2)} USDA (${adaEquivalent.toFixed(2)} ADA equivalent)`,
        totalUsda,
        adaEquivalent
      };
    } catch (error) {
      throw new Error(`Unstaking failed: ${error}`);
    }
  }

  /**
   * Start daily reward calculation (runs every 24 hours)
   */
  private startRewardCalculation(): void {
    setInterval(() => {
      this.calculateDailyRewards();
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Also calculate immediately for testing
    setTimeout(() => {
      this.calculateDailyRewards();
    }, 5000); // 5 seconds after startup
  }

  /**
   * Calculate and distribute daily rewards
   */
  private async calculateDailyRewards(): Promise<void> {
    try {
      const activeStakes = await this.getAllActiveStakes();
      
      for (const stake of activeStakes) {
        const newTotalRewards = stake.total_rewards + stake.daily_reward;
        await this.updateStakeRewards(stake.id!, newTotalRewards);
      }
      
      console.log(`Daily rewards calculated for ${activeStakes.length} active stakes`);
    } catch (error) {
      console.error('Error calculating daily rewards:', error);
    }
  }

  private async getAllActiveStakes(): Promise<StakeRecord[]> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM stakes WHERE is_active = 1';
      this.db.all(query, [], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  private async updateStakeRewards(stakeId: number, totalRewards: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE stakes SET total_rewards = ? WHERE id = ?';
      this.db.run(query, [totalRewards, stakeId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async saveStakeRecord(stakeRecord: StakeRecord): Promise<number> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO stakes (phone, staked_amount, start_date, vesting_end_date, daily_reward, total_rewards, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      this.db.run(query, [
        stakeRecord.phone,
        stakeRecord.staked_amount,
        stakeRecord.start_date,
        stakeRecord.vesting_end_date,
        stakeRecord.daily_reward,
        stakeRecord.total_rewards,
        stakeRecord.is_active ? 1 : 0
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  private async deactivateStake(stakeId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE stakes SET is_active = 0 WHERE id = ?';
      this.db.run(query, [stakeId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async getBalance(phone: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT usda_balance FROM balances WHERE phone = ?';
      this.db.get(query, [phone], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.usda_balance : 0);
        }
      });
    });
  }

  private async updateBalance(phone: string, amount: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE balances 
        SET usda_balance = usda_balance + ?, updated_at = CURRENT_TIMESTAMP 
        WHERE phone = ?
      `;
      this.db.run(query, [amount, phone], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async recordTransaction(phone: string, type: string, amount: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO transactions (phone, type, amount, status)
        VALUES (?, ?, ?, 'completed')
      `;
      this.db.run(query, [phone, type, amount], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}