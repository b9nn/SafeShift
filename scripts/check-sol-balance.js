#!/usr/bin/env node
/**
 * Check SOL balance for a Solana address (devnet by default).
 * Use to verify that rewards were deposited into a company wallet.
 *
 * Usage:
 *   node scripts/check-sol-balance.js [address]
 *   node scripts/check-sol-balance.js 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
 *
 * Env: SOLANA_NETWORK=devnet (default) or mainnet-beta
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } = require('@solana/web3.js');

const network = process.env.SOLANA_NETWORK || 'devnet';
const walletConfig = require('../config/wallet.js');
const address = process.argv[2] || process.env.WALLET_ADDRESS || walletConfig.address;
const isDefaultDestination = !process.argv[2] && !process.env.WALLET_ADDRESS;

async function main() {
  const connection = new Connection(clusterApiUrl(network), 'confirmed');
  let pubkey;
  try {
    pubkey = new PublicKey(address);
  } catch (e) {
    console.error('Invalid address:', address);
    process.exit(1);
  }

  if (isDefaultDestination) {
    console.log('Reward destination (config main wallet):');
  }
  console.log(`Network: ${network}`);
  console.log(`Address: ${address}\n`);

  try {
    const balance = await connection.getBalance(pubkey);
    const sol = balance / LAMPORTS_PER_SOL;
    console.log(`Balance: ${sol.toFixed(6)} SOL (${balance} lamports)`);
    const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
    console.log(`\nView in browser: https://explorer.solana.com/address/${address}${cluster}`);
  } catch (e) {
    console.error('Error fetching balance:', e.message);
    process.exit(1);
  }
}

main();
