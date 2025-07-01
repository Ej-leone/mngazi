import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import { AppDataSource } from './database';
import { WalletEntity } from './database'; // adjust import if needed
import * as ecc from 'tiny-secp256k1';

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

      // Generate mnemonic and seed
      const mnemonic = bip39.generateMnemonic();
      const seed = await bip39.mnemonicToSeed(mnemonic);
      
      // Derive Cardano keys (using Cardano's derivation path)
      const root = bip32.BIP32Factory(ecc).fromSeed(seed);
      const accountKey = root.derivePath("m/1852'/1815'/0'"); // Cardano mainnet path
      const paymentKey = accountKey.derivePath('0/0');
      const stakeKey = accountKey.derivePath('2/0');

      // Generate addresses (simplified for MVP - in production use Cardano-specific address generation)
      const wallet_id = this.generateWalletId();
      const payment_addr = this.generateCardanoAddress(paymentKey.publicKey, 'payment');
     
      const stake_addr = this.generateCardanoAddress(stakeKey.publicKey, 'stake');

      console.log({
        stake_addr,
        payment_addr,
        wallet_id,
        phone,
        mnemonic
      })

      // Create and save wallet entity
      const walletRepo = AppDataSource.getRepository(WalletEntity);
      const wallet = walletRepo.create({
        phone,
        wallet_id,
        payment_addr,
        stake_addr,
        mnemonic,
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



  public async getBalance(phone: string): Promise<{ balance: number }> {
    const wallet = await this.getWallet(phone);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    //todo implement
    return  { balance: 1000 };
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

  private generateCardanoAddress(publicKey: Buffer, type: 'payment' | 'stake'): string {
    // Simplified address generation for MVP
    // In production, use proper Cardano address generation with @emurgo/cardano-serialization-lib
    const prefix = type === 'payment' ? 'addr_test1' : 'stake_test1';
    const hash = publicKey.toString('hex').substring(0, 56);
    return prefix + hash;
  }
}
