//@ts-nocheck
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import env from 'env-var';
import axios from 'axios';

// Initialize BIP32 with tiny-secp256k1
const BIP32Factory = bip32.BIP32Factory;
const bip32Instance = BIP32Factory(ecc);

// Initialize ECPair with tiny-secp256k1
const ECPair = ECPairFactory(ecc);

// Lightning Network node configuration
const LN_API_URL = env.get('LN_API_URL').default('http://localhost:8080').asString();
const LN_API_KEY = env.get('LN_API_KEY').asString();

// Bitcoin network (testnet or mainnet)
const NETWORK = env.get('BTC_NETWORK').default('testnet').asString();
const network = NETWORK === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

interface LightningWallet {
  address: string;
  pubkey: string;
  mnemonic: string;
  path: string;
  privateKey?: string;
}

interface TransactionResult {
  txHash?: string;
  paymentHash?: string;
  success: boolean;
  error?: string;
  invoice?: string;
}

interface Balance {
  onchain: number; // Bitcoin balance in BTC
  lightning: number; // Lightning balance in sats
  wallet: string;
}

interface Invoice {
  paymentRequest: string;
  paymentHash: string;
  amount: number;
  description: string;
  expiresAt: Date;
  isPaid: boolean;
}

/**
 * Generate a new Lightning-compatible Bitcoin wallet
 */
export function generateLightningWallet(): LightningWallet {
  try {
    // Generate 24-word mnemonic
    const mnemonic = bip39.generateMnemonic(256);
    
    // Convert mnemonic to seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    
    // Generate master key from seed
    const root = bip32Instance.fromSeed(seed, network);
    
    // Derive key using BIP84 path for native segwit (bc1...)
    // m/84'/0'/0'/0/0 for mainnet, m/84'/1'/0'/0/0 for testnet
    const coinType = NETWORK === 'mainnet' ? 0 : 1;
    const path = `m/84'/${coinType}'/0'/0/0`;
    const child = root.derivePath(path);
    
    if (!child.privateKey) {
      throw new Error('Failed to derive private key');
    }
    
    // Generate native segwit address (P2WPKH)
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: network,
    });
    
    if (!address) {
      throw new Error('Failed to generate address');
    }
    
    // Get node public key (in real implementation, this would be from LN node)
    const nodePubkey = child.publicKey.toString('hex');
    
    return {
      address,
      pubkey: nodePubkey,
      mnemonic,
      path,
      privateKey: child.privateKey.toString('hex'),
    };
  } catch (error) {
    throw new Error(`Failed to generate Lightning wallet: ${error}`);
  }
}

/**
 * Get balance for both on-chain Bitcoin and Lightning Network
 */
export async function getLightningBalance(address: string, nodePubkey?: string): Promise<Balance> {
  try {
    let onchainBalance = 0;
    let lightningBalance = 0;
    
    // Get on-chain Bitcoin balance using blockchain API
    try {
      const blockchainApi = NETWORK === 'mainnet' 
        ? `https://blockchain.info/q/addressbalance/${address}`
        : `https://blockstream.info/testnet/api/address/${address}`;
      
      const response = await axios.get(blockchainApi);
      
      if (NETWORK === 'mainnet') {
        // blockchain.info returns balance in satoshis
        onchainBalance = response.data / 100000000;
      } else {
        // blockstream.info returns object with balance
        const balanceData = response.data;
        onchainBalance = (balanceData.chain_stats.funded_txo_sum - balanceData.chain_stats.spent_txo_sum) / 100000000;
      }
    } catch (error) {
      console.warn(`Failed to fetch on-chain balance: ${error}`);
    }
    
    // Get Lightning Network balance from node
    if (nodePubkey) {
      try {
        const lnResponse = await axios.get(`${LN_API_URL}/api/v1/balance`, {
          headers: {
            'X-Api-Key': LN_API_KEY,
          },
        });
        
        lightningBalance = lnResponse.data.balance || 0;
      } catch (error) {
        console.warn(`Failed to fetch Lightning balance: ${error}`);
      }
    }
    
    return {
      wallet: address,
      onchain: onchainBalance,
      lightning: lightningBalance,
    };
  } catch (error) {
    throw new Error(`Failed to fetch balances: ${error}`);
  }
}

/**
 * Create a Lightning Network invoice
 */
export async function createLightningInvoice(
  amountSats: number,
  description: string,
  expirySeconds: number = 3600
): Promise<Invoice> {
  try {
    const response = await axios.post(
      `${LN_API_URL}/api/v1/payments`,
      {
        out: false,
        amount: amountSats,
        memo: description,
        expiry: expirySeconds,
      },
      {
        headers: {
          'X-Api-Key': LN_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const data = response.data;
    
    return {
      paymentRequest: data.payment_request,
      paymentHash: data.payment_hash,
      amount: amountSats,
      description: description,
      expiresAt: new Date(Date.now() + expirySeconds * 1000),
      isPaid: false,
    };
  } catch (error) {
    throw new Error(`Failed to create Lightning invoice: ${error}`);
  }
}

/**
 * Pay a Lightning Network invoice
 */
export async function payLightningInvoice(
  paymentRequest: string
): Promise<TransactionResult> {
  try {
    const response = await axios.post(
      `${LN_API_URL}/api/v1/payments`,
      {
        out: true,
        bolt11: paymentRequest,
      },
      {
        headers: {
          'X-Api-Key': LN_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const data = response.data;
    
    return {
      paymentHash: data.payment_hash,
      success: true,
      invoice: paymentRequest,
    };
  } catch (error) {
    return {
      success: false,
      error: `Payment failed: ${error}`,
    };
  }
}

/**
 * Check invoice payment status
 */
export async function checkInvoiceStatus(paymentHash: string): Promise<boolean> {
  try {
    const response = await axios.get(
      `${LN_API_URL}/api/v1/payments/${paymentHash}`,
      {
        headers: {
          'X-Api-Key': LN_API_KEY,
        },
      }
    );
    
    return response.data.paid || false;
  } catch (error) {
    throw new Error(`Failed to check invoice status: ${error}`);
  }
}

/**
 * Send Bitcoin on-chain transaction
 */
export async function sendBitcoin(
  fromWallet: LightningWallet,
  toAddress: string,
  amountBTC: number,
  feeRate: number = 5 // satoshis per byte
): Promise<TransactionResult> {
  try {
    if (!fromWallet.privateKey) {
      throw new Error('Private key not available');
    }
    
    // Get UTXOs for the address
    const utxoApi = NETWORK === 'mainnet'
      ? `https://blockchain.info/unspent?active=${fromWallet.address}`
      : `https://blockstream.info/testnet/api/address/${fromWallet.address}/utxo`;
    
    const utxoResponse = await axios.get(utxoApi);
    const utxos = NETWORK === 'mainnet' ? utxoResponse.data.unspent_outputs : utxoResponse.data;
    
    if (!utxos || utxos.length === 0) {
      throw new Error('No UTXOs found for address');
    }
    
    // Create transaction
    const psbt = new bitcoin.Psbt({ network });
    
    // Convert BTC to satoshis
    const amountSats = Math.floor(amountBTC * 100000000);
    
    let totalInput = 0;
    const selectedUtxos = [];
    
    // Select UTXOs
    for (const utxo of utxos) {
      const value = NETWORK === 'mainnet' ? utxo.value : utxo.value;
      const txid = NETWORK === 'mainnet' ? utxo.tx_hash_big_endian : utxo.txid;
      const vout = NETWORK === 'mainnet' ? utxo.tx_output_n : utxo.vout;
      
      // Fetch the full transaction to get witness data
      const txApi = NETWORK === 'mainnet'
        ? `https://blockchain.info/rawtx/${txid}?format=hex`
        : `https://blockstream.info/testnet/api/tx/${txid}/hex`;
      
      const txHexResponse = await axios.get(txApi);
      const txHex = NETWORK === 'mainnet' ? txHexResponse.data : txHexResponse.data;
      
      psbt.addInput({
        hash: txid,
        index: vout,
        witnessUtxo: {
          script: bitcoin.payments.p2wpkh({
            pubkey: Buffer.from(fromWallet.pubkey, 'hex'),
            network,
          }).output!,
          value: value,
        },
      });
      
      totalInput += value;
      selectedUtxos.push({ txid, vout, value });
      
      // Break if we have enough
      if (totalInput >= amountSats + 1000) break; // +1000 for estimated fees
    }
    
    // Calculate fee (rough estimation)
    const estimatedSize = selectedUtxos.length * 148 + 2 * 34 + 10;
    const fee = estimatedSize * feeRate;
    
    const change = totalInput - amountSats - fee;
    
    if (change < 0) {
      throw new Error('Insufficient funds for transaction including fees');
    }
    
    // Add output to recipient
    psbt.addOutput({
      address: toAddress,
      value: amountSats,
    });
    
    // Add change output if significant
    if (change > 546) { // 546 sats is dust limit
      psbt.addOutput({
        address: fromWallet.address,
        value: change,
      });
    }
    
    // Sign all inputs
    const keyPair = ECPair.fromPrivateKey(
      Buffer.from(fromWallet.privateKey, 'hex'),
      { network }
    );
    
    for (let i = 0; i < selectedUtxos.length; i++) {
      psbt.signInput(i, keyPair);
    }
    
    // Finalize and extract transaction
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    
    // Broadcast transaction
    const broadcastApi = NETWORK === 'mainnet'
      ? 'https://blockchain.info/pushtx'
      : 'https://blockstream.info/testnet/api/tx';
    
    const broadcastResponse = await axios.post(broadcastApi, 
      NETWORK === 'mainnet' ? `tx=${txHex}` : txHex,
      {
        headers: {
          'Content-Type': NETWORK === 'mainnet' ? 'application/x-www-form-urlencoded' : 'text/plain',
        },
      }
    );
    
    const txHash = tx.getId();
    
    return {
      txHash,
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: `Transaction failed: ${error}`,
    };
  }
}

/**
 * Open a Lightning channel with another node
 */
export async function openLightningChannel(
  nodePubkey: string,
  amountSats: number,
  pushAmountSats: number = 0
): Promise<TransactionResult> {
  try {
    const response = await axios.post(
      `${LN_API_URL}/api/v1/channels`,
      {
        node_id: nodePubkey,
        local_amount: amountSats,
        push_amount: pushAmountSats,
      },
      {
        headers: {
          'X-Api-Key': LN_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return {
      txHash: response.data.funding_txid,
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to open channel: ${error}`,
    };
  }
}

/**
 * Close a Lightning channel
 */
export async function closeLightningChannel(
  channelId: string,
  force: boolean = false
): Promise<TransactionResult> {
  try {
    const response = await axios.delete(
      `${LN_API_URL}/api/v1/channels/${channelId}`,
      {
        headers: {
          'X-Api-Key': LN_API_KEY,
        },
        params: {
          force,
        },
      }
    );
    
    return {
      txHash: response.data.closing_txid,
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to close channel: ${error}`,
    };
  }
}

/**
 * Get list of Lightning channels
 */
export async function getChannels(): Promise<any[]> {
  try {
    const response = await axios.get(`${LN_API_URL}/api/v1/channels`, {
      headers: {
        'X-Api-Key': LN_API_KEY,
      },
    });
    
    return response.data || [];
  } catch (error) {
    throw new Error(`Failed to get channels: ${error}`);
  }
}

/**
 * Decode a Lightning invoice
 */
export async function decodeInvoice(paymentRequest: string): Promise<any> {
  try {
    const response = await axios.get(
      `${LN_API_URL}/api/v1/payments/decode`,
      {
        headers: {
          'X-Api-Key': LN_API_KEY,
        },
        params: {
          bolt11: paymentRequest,
        },
      }
    );
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to decode invoice: ${error}`);
  }
}

/**
 * Get payment history
 */
export async function getPaymentHistory(limit: number = 50): Promise<any[]> {
  try {
    const response = await axios.get(`${LN_API_URL}/api/v1/payments`, {
      headers: {
        'X-Api-Key': LN_API_KEY,
      },
      params: {
        limit,
      },
    });
    
    return response.data || [];
  } catch (error) {
    throw new Error(`Failed to get payment history: ${error}`);
  }
}

/**
 * Convert satoshis to BTC
 */
export function satsToBTC(sats: number): number {
  return sats / 100000000;
}

/**
 * Convert BTC to satoshis
 */
export function btcToSats(btc: number): number {
  return Math.floor(btc * 100000000);
}

export default {
  generateLightningWallet,
  getLightningBalance,
  createLightningInvoice,
  payLightningInvoice,
  checkInvoiceStatus,
  sendBitcoin,
  openLightningChannel,
  closeLightningChannel,
  getChannels,
  decodeInvoice,
  getPaymentHistory,
  satsToBTC,
  btcToSats,
};

