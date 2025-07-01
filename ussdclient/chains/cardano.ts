import * as CardanoWasm from '@emurgo/cardano-serialization-lib-nodejs';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

// Initialize BlockFrost API (you'll need to get an API key from blockfrost.io)
const blockfrost = new BlockFrostAPI({
  projectId: 'your_blockfrost_project_id', // Replace with your actual project ID
  network: 'preview' 
});

interface WalletKeys {
  paymentKey: CardanoWasm.PrivateKey;
  stakeKey: CardanoWasm.PrivateKey;
  address: CardanoWasm.Address;
  paymentAddress: string;
}

interface TransactionResult {
  txHash: string;
  success: boolean;
  error?: string;
}

interface StakeRewards {
  totalRewards: string;
  availableRewards: string;
  currentEpoch: number;
  nextEpochTime: Date;
}

/**
 * Generate a new Cardano address with payment and stake keys
 */
export function generateCardanoKeys(): WalletKeys {
  try {
    // Generate payment key pair
    const paymentKey = CardanoWasm.PrivateKey.generate_ed25519();
    const paymentPubKey = paymentKey.to_public();
    
    // Generate stake key pair
    const stakeKey = CardanoWasm.PrivateKey.generate_ed25519();
    const stakePubKey = stakeKey.to_public();
    
    // Create payment credential
    const paymentCred = CardanoWasm.Credential.from_keyhash(
      paymentPubKey.hash()
    );
    
    // Create stake credential
    const stakeCred = CardanoWasm.Credential.from_keyhash(
      stakePubKey.hash()
    );
    
    // Create base address (mainnet = 1, testnet = 0)
    const networkId = 0; 
    const baseAddress = CardanoWasm.BaseAddress.new(
      networkId,
      paymentCred,
      stakeCred
    );
    
    const address = baseAddress.to_address();
    const paymentAddress = address.to_bech32();
    
    return {
      paymentKey,
      stakeKey,
      address,
      paymentAddress
    };
  } catch (error) {
    throw new Error(`Failed to generate Cardano address: ${error}`);
  }
}

// /**
//  * Send ADA from one wallet to a public address
//  */
// export async function sendADA(
//   fromWallet: WalletKeys,
//   toAddress: string,
//   amountADA: number
// ): Promise<TransactionResult> {
//   try {
//     // Convert ADA to lovelace (1 ADA = 1,000,000 lovelace)
//     const amountLovelace = Math.floor(amountADA * 1_000_000);
    
//     // Get UTXOs for the sender address
//     const utxos = await blockfrost.addressesUtxos(fromWallet.paymentAddress);
    
//     if (utxos.length === 0) {
//       throw new Error('No UTXOs found for sender address');
//     }
    
//     // Get protocol parameters
//     const protocolParams = await blockfrost.epochsLatestParameters();
    
//     // Create transaction builder
//     const txBuilder = CardanoWasm.TransactionBuilder.new(
//       CardanoWasm.LinearFee.new(
//         CardanoWasm.BigNum.from_str(protocolParams.min_fee_a.toString()),
//         CardanoWasm.BigNum.from_str(protocolParams.min_fee_b.toString())
//       ),
//       CardanoWasm.BigNum.from_str(protocolParams.min_utxo.toString()),
//       CardanoWasm.BigNum.from_str(protocolParams.pool_deposit.toString()),
//       CardanoWasm.BigNum.from_str(protocolParams.key_deposit.toString())
//     );
    
//     // Add inputs from UTXOs
//     const inputs = CardanoWasm.TransactionInputs.new();
//     let totalInput = 0;
    
//     for (const utxo of utxos) {
//       const input = CardanoWasm.TransactionInput.new(
//         CardanoWasm.TransactionHash.from_bytes(
//           Buffer.from(utxo.tx_hash, 'hex')
//         ),
//         utxo.output_index
//       );
//       inputs.add(input);
//       totalInput += parseInt(utxo.amount[0].quantity);
      
//       // Break if we have enough input
//       if (totalInput >= amountLovelace + 2_000_000) { // 2 ADA buffer for fees
//         break;
//       }
//     }
    
//     // Add output to recipient
//     const outputAddress = CardanoWasm.Address.from_bech32(toAddress);
//     const outputValue = CardanoWasm.Value.new(
//       CardanoWasm.BigNum.from_str(amountLovelace.toString())
//     );
    
//     const output = CardanoWasm.TransactionOutput.new(outputAddress, outputValue);
//     txBuilder.add_output(output);
    
//     // Calculate change
//     const fee = 200_000; // Estimate fee (will be refined)
//     const change = totalInput - amountLovelace - fee;
    
//     if (change > 0) {
//       const changeOutput = CardanoWasm.TransactionOutput.new(
//         fromWallet.address,
//         CardanoWasm.Value.new(CardanoWasm.BigNum.from_str(change.toString()))
//       );
//       txBuilder.add_output(changeOutput);
//     }
    
//     // Set TTL (time to live)
//     const currentSlot = await getCurrentSlot();
//     txBuilder.set_ttl(currentSlot + 3600); // 1 hour TTL
    
//     // Build transaction body
//     const txBody = txBuilder.build();
    
//     // Create witness set
//     const witnessSet = CardanoWasm.TransactionWitnessSet.new();
//     const vkeyWitnesses = CardanoWasm.Vkeywitnesses.new();
    
//     // Sign with payment key
//     const txHash = CardanoWasm.hash_transaction(txBody);
//     const paymentWitness = CardanoWasm.make_vkey_witness(txHash, fromWallet.paymentKey);
//     vkeyWitnesses.add(paymentWitness);
    
//     witnessSet.set_vkeys(vkeyWitnesses);
    
//     // Create final transaction
//     const transaction = CardanoWasm.Transaction.new(txBody, witnessSet);
    
//     // Submit transaction
//     const txBytes = transaction.to_bytes();
//     const result = await blockfrost.txSubmit(txBytes);
    
//     return {
//       txHash: result,
//       success: true
//     };
    
//   } catch (error) {
//     return {
//       txHash: '',
//       success: false,
//       error: `Transaction failed: ${error}`
//     };
//   }
// }

// /**
//  * Stake ADA to a stake pool
//  */
// export async function stakeADA(
//   wallet: WalletKeys,
//   poolId: string
// ): Promise<TransactionResult> {
//   try {
//     // Create stake registration certificate
//     const stakeCredential = CardanoWasm.StakeCredential.from_keyhash(
//       wallet.stakeKey.to_public().hash()
//     );
    
//     const stakeRegistration = CardanoWasm.Certificate.new_stake_registration(
//       CardanoWasm.StakeRegistration.new(stakeCredential)
//     );
    
//     // Create stake delegation certificate
//     const poolKeyHash = CardanoWasm.Ed25519KeyHash.from_bytes(
//       Buffer.from(poolId, 'hex')
//     );
    
//     const stakeDelegation = CardanoWasm.Certificate.new_stake_delegation(
//       CardanoWasm.StakeDelegation.new(stakeCredential, poolKeyHash)
//     );
    
//     // Get protocol parameters
//     const protocolParams = await blockfrost.epochsLatestParameters();
    
//     // Create transaction builder
//     const txBuilder = CardanoWasm.TransactionBuilder.new(
//       CardanoWasm.LinearFee.new(
//         CardanoWasm.BigNum.from_str(protocolParams.min_fee_a.toString()),
//         CardanoWasm.BigNum.from_str(protocolParams.min_fee_b.toString())
//       ),
//       CardanoWasm.BigNum.from_str(protocolParams.min_utxo.toString()),
//       CardanoWasm.BigNum.from_str(protocolParams.pool_deposit.toString()),
//       CardanoWasm.BigNum.from_str(protocolParams.key_deposit.toString())
//     );
    
//     // Add certificates
//     const certs = CardanoWasm.Certificates.new();
//     certs.add(stakeRegistration);
//     certs.add(stakeDelegation);
//     txBuilder.set_certs(certs);
    
//     // Get UTXOs and add inputs
//     const utxos = await blockfrost.addressesUtxos(wallet.paymentAddress);
    
//     // Add sufficient inputs to cover key deposit (2 ADA) and fees
//     let totalInput = 0;
//     const requiredAmount = 2_000_000 + 500_000; // 2 ADA deposit + 0.5 ADA for fees
    
//     for (const utxo of utxos) {
//       const input = CardanoWasm.TransactionInput.new(
//         CardanoWasm.TransactionHash.from_bytes(
//           Buffer.from(utxo.tx_hash, 'hex')
//         ),
//         utxo.output_index
//       );
      
//       const value = CardanoWasm.Value.new(
//         CardanoWasm.BigNum.from_str(utxo.amount[0].quantity)
//       );
      
//       txBuilder.add_input(utxo.address, input, value);
//       totalInput += parseInt(utxo.amount[0].quantity);
      
//       if (totalInput >= requiredAmount) break;
//     }
    
//     // Set TTL
//     const currentSlot = await getCurrentSlot();
//     txBuilder.set_ttl(currentSlot + 3600);
    
//     // Build transaction
//     const txBody = txBuilder.build();
//     const txHash = CardanoWasm.hash_transaction(txBody);
    
//     // Create witnesses
//     const witnessSet = CardanoWasm.TransactionWitnessSet.new();
//     const vkeyWitnesses = CardanoWasm.Vkeywitnesses.new();
    
//     // Sign with both payment and stake keys
//     const paymentWitness = CardanoWasm.make_vkey_witness(txHash, wallet.paymentKey);
//     const stakeWitness = CardanoWasm.make_vkey_witness(txHash, wallet.stakeKey);
    
//     vkeyWitnesses.add(paymentWitness);
//     vkeyWitnesses.add(stakeWitness);
//     witnessSet.set_vkeys(vkeyWitnesses);
    
//     // Create and submit transaction
//     const transaction = CardanoWasm.Transaction.new(txBody, witnessSet);
//     const txBytes = transaction.to_bytes();
//     const result = await blockfrost.txSubmit(txBytes);
    
//     return {
//       txHash: result,
//       success: true
//     };
    
//   } catch (error) {
//     return {
//       txHash: '',
//       success: false,
//       error: `Staking failed: ${error}`
//     };
//   }
// }

// /**
//  * Check rewards of staked ADA and epoch information
//  */
// export async function checkStakeRewards(stakeAddress: string): Promise<StakeRewards> {
//   try {
//     // Get current epoch info
//     const currentEpoch = await blockfrost.epochsLatest();
    
//     // Get account information (rewards)
//     const accountInfo = await blockfrost.accounts(stakeAddress);
    
//     // Calculate next epoch time
//     const epochParams = await blockfrost.epochsParameters(currentEpoch.epoch);
//     const nextEpochTime = new Date(currentEpoch.end_time * 1000);
    
//     return {
//       totalRewards: (parseInt(accountInfo.rewards_sum) / 1_000_000).toFixed(6), // Convert to ADA
//       availableRewards: (parseInt(accountInfo.withdrawable_amount) / 1_000_000).toFixed(6), // Convert to ADA
//       currentEpoch: currentEpoch.epoch,
//       nextEpochTime: nextEpochTime
//     };
    
//   } catch (error) {
//     throw new Error(`Failed to check stake rewards: ${error}`);
//   }
// }

// /**
//  * Withdraw staking rewards
//  */
// export async function withdrawRewards(
//   wallet: WalletKeys,
//   stakeAddress: string
// ): Promise<TransactionResult> {
//   try {
//     // Get account info to check withdrawable amount
//     const accountInfo = await blockfrost.accounts(stakeAddress);
//     const withdrawableAmount = parseInt(accountInfo.withdrawable_amount);
    
//     if (withdrawableAmount === 0) {
//       throw new Error('No rewards available to withdraw');
//     }
    
//     // Create withdrawal
//     const withdrawals = CardanoWasm.Withdrawals.new();
//     const stakeCredential = CardanoWasm.StakeCredential.from_keyhash(
//       wallet.stakeKey.to_public().hash()
//     );
    
//     const rewardAddress = CardanoWasm.RewardAddress.new(
//       1, // mainnet
//       stakeCredential
//     );
    
//     withdrawals.insert(
//       rewardAddress,
//       CardanoWasm.BigNum.from_str(withdrawableAmount.toString())
//     );
    
//     // Get protocol parameters
//     const protocolParams = await blockfrost.epochsLatestParameters();
    
//     // Create transaction builder
//     const txBuilder = CardanoWasm.TransactionBuilder.new(
//       CardanoWasm.LinearFee.new(
//         CardanoWasm.BigNum.from_str(protocolParams.min_fee_a.toString()),
//         CardanoWasm.BigNum.from_str(protocolParams.min_fee_b.toString())
//       ),
//       CardanoWasm.BigNum.from_str(protocolParams.min_utxo.toString()),
//       CardanoWasm.BigNum.from_str(protocolParams.pool_deposit.toString()),
//       CardanoWasm.BigNum.from_str(protocolParams.key_deposit.toString())
//     );
    
//     // Set withdrawals
//     txBuilder.set_withdrawals(withdrawals);
    
//     // Add inputs to cover fees
//     const utxos = await blockfrost.addressesUtxos(wallet.paymentAddress);
//     const feeEstimate = 200_000; // 0.2 ADA estimate
    
//     for (const utxo of utxos) {
//       if (parseInt(utxo.amount[0].quantity) >= feeEstimate) {
//         const input = CardanoWasm.TransactionInput.new(
//           CardanoWasm.TransactionHash.from_bytes(
//             Buffer.from(utxo.tx_hash, 'hex')
//           ),
//           utxo.output_index
//         );
        
//         const value = CardanoWasm.Value.new(
//           CardanoWasm.BigNum.from_str(utxo.amount[0].quantity)
//         );
        
//         txBuilder.add_input(utxo.address, input, value);
//         break;
//       }
//     }
    
//     // Set TTL
//     const currentSlot = await getCurrentSlot();
//     txBuilder.set_ttl(currentSlot + 3600);
    
//     // Build and sign transaction
//     const txBody = txBuilder.build();
//     const txHash = CardanoWasm.hash_transaction(txBody);
    
//     const witnessSet = CardanoWasm.TransactionWitnessSet.new();
//     const vkeyWitnesses = CardanoWasm.Vkeywitnesses.new();
    
//     // Sign with both keys
//     const paymentWitness = CardanoWasm.make_vkey_witness(txHash, wallet.paymentKey);
//     const stakeWitness = CardanoWasm.make_vkey_witness(txHash, wallet.stakeKey);
    
//     vkeyWitnesses.add(paymentWitness);
//     vkeyWitnesses.add(stakeWitness);
//     witnessSet.set_vkeys(vkeyWitnesses);
    
//     // Submit transaction
//     const transaction = CardanoWasm.Transaction.new(txBody, witnessSet);
//     const txBytes = transaction.to_bytes();
//     const result = await blockfrost.txSubmit(txBytes);
    
//     return {
//       txHash: result,
//       success: true
//     };
    
//   } catch (error) {
//     return {
//       txHash: '',
//       success: false,
//       error: `Withdrawal failed: ${error}`
//     };
//   }
// }

// /**
//  * Unstake ADA (deregister stake key and withdraw remaining rewards)
//  */
// export async function unstakeADA(
//   wallet: WalletKeys,
//   stakeAddress: string
// ): Promise<TransactionResult> {
//   try {
//     // Get account info to check if there are rewards to withdraw
//     const accountInfo = await blockfrost.accounts(stakeAddress);
//     const withdrawableAmount = parseInt(accountInfo.withdrawable_amount);
//     const isActive = accountInfo.active;
    
//     if (!isActive) {
//       throw new Error('Stake key is not currently registered');
//     }
    
//     // Create stake deregistration certificate
//     const stakeCredential = CardanoWasm.StakeCredential.from_keyhash(
//       wallet.stakeKey.to_public().hash()
//     );
    
//     const stakeDeregistration = CardanoWasm.Certificate.new_stake_deregistration(
//       CardanoWasm.StakeDeregistration.new(stakeCredential)
//     );
    
//     // Get protocol parameters
//     const protocolParams = await blockfrost.epochsLatestParameters();
    
//     // Create transaction builder
//     const txBuilder = CardanoWasm.TransactionBuilder.new(
//       CardanoWasm.LinearFee.new(
//         CardanoWasm.BigNum.from_str(protocolParams.min_fee_a.toString()),
//         CardanoWasm.BigNum.from_str(protocolParams.min_fee_b.toString())
//       ),
//       CardanoWasm.BigNum.from_str(protocolParams.min_utxo.toString()),
//       CardanoWasm.BigNum.from_str(protocolParams.pool_deposit.toString()),
//       CardanoWasm.BigNum.from_str(protocolParams.key_deposit.toString())
//     );
    
//     // Add deregistration certificate
//     const certs = CardanoWasm.Certificates.new();
//     certs.add(stakeDeregistration);
//     txBuilder.set_certs(certs);
    
//     // Add withdrawals if there are rewards to withdraw
//     if (withdrawableAmount > 0) {
//       const withdrawals = CardanoWasm.Withdrawals.new();
//       const rewardAddress = CardanoWasm.RewardAddress.new(
//         1, // mainnet (change to 0 for testnet)
//         stakeCredential
//       );
      
//       withdrawals.insert(
//         rewardAddress,
//         CardanoWasm.BigNum.from_str(withdrawableAmount.toString())
//       );
      
//       txBuilder.set_withdrawals(withdrawals);
//     }
    
//     // Get UTXOs for input (need to cover transaction fees)
//     const utxos = await blockfrost.addressesUtxos(wallet.paymentAddress);
    
//     if (utxos.length === 0) {
//       throw new Error('No UTXOs found for wallet address');
//     }
    
//     // Add sufficient inputs to cover fees
//     // Note: Key deposit (2 ADA) will be returned automatically
//     const feeEstimate = 300_000; // 0.3 ADA estimate for fees
//     let totalInput = 0;
    
//     for (const utxo of utxos) {
//       const input = CardanoWasm.TransactionInput.new(
//         CardanoWasm.TransactionHash.from_bytes(
//           Buffer.from(utxo.tx_hash, 'hex')
//         ),
//         utxo.output_index
//       );
      
//       const value = CardanoWasm.Value.new(
//         CardanoWasm.BigNum.from_str(utxo.amount[0].quantity)
//       );
      
//       txBuilder.add_input(utxo.address, input, value);
//       totalInput += parseInt(utxo.amount[0].quantity);
      
//       if (totalInput >= feeEstimate) break;
//     }
    
//     // Set TTL (time to live)
//     const currentSlot = await getCurrentSlot();
//     txBuilder.set_ttl(currentSlot + 3600); // 1 hour TTL
    
//     // Build transaction body
//     const txBody = txBuilder.build();
//     const txHash = CardanoWasm.hash_transaction(txBody);
    
//     // Create witness set and sign
//     const witnessSet = CardanoWasm.TransactionWitnessSet.new();
//     const vkeyWitnesses = CardanoWasm.Vkeywitnesses.new();
    
//     // Sign with both payment and stake keys
//     const paymentWitness = CardanoWasm.make_vkey_witness(txHash, wallet.paymentKey);
//     const stakeWitness = CardanoWasm.make_vkey_witness(txHash, wallet.stakeKey);
    
//     vkeyWitnesses.add(paymentWitness);
//     vkeyWitnesses.add(stakeWitness);
//     witnessSet.set_vkeys(vkeyWitnesses);
    
//     // Create final transaction
//     const transaction = CardanoWasm.Transaction.new(txBody, witnessSet);
    
//     // Submit transaction
//     const txBytes = transaction.to_bytes();
//     const result = await blockfrost.txSubmit(txBytes);
    
//     console.log(`Unstaking successful. Withdrawing ${withdrawableAmount / 1_000_000} ADA in rewards and returning 2 ADA key deposit.`);
    
//     return {
//       txHash: result,
//       success: true
//     };
    
//   } catch (error) {
//     return {
//       txHash: '',
//       success: false,
//       error: `Unstaking failed: ${error}`
//     };
//   }
// }

// /**
//  * Helper function to get current slot
//  */
// async function getCurrentSlot(): Promise<number> {
//   const latestBlock = await blockfrost.blocksLatest();
//   return latestBlock.slot || 0;
// }

// // Example usage:
// /*
// // Generate a new wallet
// const wallet = generateCardanoAddress();
// console.log('New wallet address:', wallet.paymentAddress);

// // Send ADA
// const sendResult = await sendADA(
//   wallet,
//   'addr1q8example...', // recipient address
//   5 // amount in ADA
// );

// // Stake ADA to a pool
// const stakeResult = await stakeADA(
//   wallet,
//   'pool1example...' // pool ID
// );

// // Check rewards
// const rewards = await checkStakeRewards('stake1u8example...');
// console.log('Rewards:', rewards);

// // Withdraw rewards
// const withdrawResult = await withdrawRewards(
//   wallet,
//   'stake1u8example...'
// );

// // Unstake ADA (deregister and withdraw all remaining rewards)
// const unstakeResult = await unstakeADA(
//   wallet,
//   'stake1u8example...'
// );
// console.log('Unstaking result:', unstakeResult);
// */