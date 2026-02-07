/**
 * Solana Configuration for SafeShift
 * 
 * This file contains configuration for connecting to Solana networks
 * and managing wallet addresses for the reward system.
 */

require('dotenv').config();
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

// Network configuration
// Default to devnet (your wallet has 5 SOL on devnet)
const NETWORK = process.env.SOLANA_NETWORK || 'devnet'; // 'mainnet-beta', 'devnet', or 'testnet'
const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl(NETWORK);

// Wallet configuration
// Your wallet address with 5 SOL
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF';

// Create connection
const connection = new Connection(RPC_URL, 'confirmed');

// Export configuration
module.exports = {
  connection,
  NETWORK,
  RPC_URL,
  WALLET_ADDRESS: new PublicKey(WALLET_ADDRESS),
  getWalletPublicKey: () => new PublicKey(WALLET_ADDRESS),
};
