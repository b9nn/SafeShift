/**
 * Example Solana Usage
 * 
 * This file demonstrates basic Solana operations you can use
 * for the SafeShift reward system.
 */

const { LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { connection, WALLET_ADDRESS, NETWORK } = require('../solana.config');

async function examples() {
  console.log('📚 Solana Usage Examples for SafeShift\n');
  console.log(`Network: ${NETWORK}`);
  console.log(`Wallet: ${WALLET_ADDRESS.toString()}\n`);

  // Example 1: Get Balance
  console.log('1️⃣  Getting wallet balance...');
  const balance = await connection.getBalance(WALLET_ADDRESS);
  console.log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  // Example 2: Get Recent Blockhash (needed for transactions)
  console.log('2️⃣  Getting recent blockhash...');
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  console.log(`   Blockhash: ${blockhash.toString().substring(0, 20)}...\n`);

  // Example 3: Get Account Info
  console.log('3️⃣  Getting account info...');
  const accountInfo = await connection.getAccountInfo(WALLET_ADDRESS);
  if (accountInfo) {
    console.log(`   Owner: ${accountInfo.owner.toString()}`);
    console.log(`   Executable: ${accountInfo.executable}`);
    console.log(`   Data length: ${accountInfo.data.length} bytes\n`);
  }

  // Example 4: Get Slot (current blockchain slot)
  console.log('4️⃣  Getting current slot...');
  const slot = await connection.getSlot();
  console.log(`   Current slot: ${slot}\n`);

  console.log('✅ Examples completed!\n');
  console.log('💡 Next steps for SafeShift:');
  console.log('   - Create a Solana program for reward distribution');
  console.log('   - Set up token mint for reward tokens');
  console.log('   - Implement automated reward triggers');
  console.log('   - Store compliance records on-chain');
}

examples().catch(console.error);
