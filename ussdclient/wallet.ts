
import { AppDataSource } from './database';
import { WalletEntity } from './database'; // adjust import if needed
import * as ecc from 'tiny-secp256k1';
import { generateCardanoKeys, getCardanoBalance } from './chains/cardano';

export class WalletModule {
  

  constructor() {
   
  }

  /**
   * Generate a new Cardano wallet using BIP32/BIP39
   */
  public async generateWallet(phone: string): Promise<WalletEntity> {
    try {
      // Validate phone number format
      if (!this.isValidPhoneNumber(phone)) {
        throw new Error('Invalid phone number format. Use +[country][number]');
      }

      // Check if wallet already exists
      const existingWallet = await this.getWallet(phone);
      if (existingWallet) {
        throw new Error('Wallet already exists for this phone number');
      }

      const {   mnemonic,
        paymentAddress }  =     generateCardanoKeys()
    
      // 
      const wallet_id = this.generateWalletId();
    


      // Create and save wallet entity
      const walletRepo = AppDataSource.getRepository(WalletEntity);
      const wallet = walletRepo.create({
        phone,
        wallet_id,
        payment_addr:paymentAddress,
        mnemonic
   
      });
      await walletRepo.save(wallet);
      
      // Initialize balance
      await this.initializeBalance(phone);

      return wallet;
    } catch (error) {
      console.error(error)
      throw new Error(`Failed to generate wallet: ${error}`);
    }
  }

  /**
   * Retrieve wallet by phone number
   */
  public async getWallet(phone: string): Promise<WalletEntity | null> {
    const walletRepo = AppDataSource.getRepository(WalletEntity);
    return await walletRepo.findOneBy({ phone });
  }



  public async getBalance(phone: string): Promise<{ balance: number ; ada: string; wallet: string }> {
    const wallet = await this.getWallet(phone);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
   
    const result = await getCardanoBalance(wallet.payment_addr)

    return  { balance:Number.parseFloat(result.usda) , ada: result.ada  , wallet: result.wallet};
  }
  /**
   * Get all wallets
   */
  public async getAllWallets(): Promise<WalletEntity[]> {
    const walletRepo = AppDataSource.getRepository(WalletEntity);
    return await walletRepo.find();
  }

  private async initializeBalance(address : string): Promise<boolean> {
    //  load initial balance for activation from mngazi hot wallet
    return true
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Simple validation for +[country][number] format
    const phoneRegex = /^\+\d{8,15}$/;
    return phoneRegex.test(phone);
  }

  private generateWalletId(): string {
    return 'wallet_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }


}
