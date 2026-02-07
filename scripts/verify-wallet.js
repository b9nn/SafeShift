/**
 * Verify Wallet Connection Script
 * 
 * This script verifies the connection to Solana network and checks
 * the wallet balance for the configured wallet address.
 */

const { LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { connection, WALLET_ADDRESS, NETWORK } = require('../solana.config');

async function verifyWallet() {
  try {
    console.log('🔍 Verifying Solana wallet connection...\n');
    console.log(`Network: ${NETWORK}`);
    console.log(`Wallet Address: ${WALLET_ADDRESS.toString()}\n`);

    // Get account info
    const accountInfo = await connection.getAccountInfo(WALLET_ADDRESS);
    
    if (!accountInfo) {
      console.log('❌ Wallet not found or has no balance on this network.');
      console.log(`   Make sure you're connected to the correct network (${NETWORK})`);
      return;
    }

    // Get balance
    const balance = await connection.getBalance(WALLET_ADDRESS);
    const balanceInSOL = balance / LAMPORTS_PER_SOL;

    console.log('✅ Wallet verified successfully!\n');
    console.log('Account Details:');
    console.log(`  - Balance: ${balanceInSOL.toFixed(4)} SOL (${balance} lamports)`);
    console.log(`  - Owner: ${accountInfo.owner.toString()}`);
    console.log(`  - Executable: ${accountInfo.executable}`);
    console.log(`  - Rent Epoch: ${accountInfo.rentEpoch}\n`);

    if (balanceInSOL < 0.1) {
      console.log('⚠️  Warning: Low balance. You may need more SOL for transaction fees.');
    } else {
      console.log('✅ Sufficient balance for transactions.');
    }

  } catch (error) {
    console.error('❌ Error verifying wallet:', error.message);
    if (error.message.includes('Invalid public key')) {
      console.error('   Please check that your WALLET_ADDRESS is correct.');
    }
    process.exit(1);
  }
}

// Run verification
verifyWallet();
