export interface Wallet {
    phone: string;
    wallet_id: string;
    payment_addr: string;
    stake_addr: string;
    mnemonic?: string;
  }
  
  export interface StakeRecord {
    id?: number;
    phone: string;
    staked_amount: number;
    start_date: string;
    vesting_end_date: string;
    daily_reward: number;
    total_rewards: number;
    is_active: boolean;
  }
  
  export interface Balance {
    usda_balance: number;
    staked_usda: number;
    pending_rewards: number;
    total_rewards: number;
  }
  
  export interface DepositResult {
    status: string;
    usda: number;
    message?: string;
  }
  
  export interface WithdrawResult {
    status: string;
    message: string;
    amount_sent?: number;
  }
  