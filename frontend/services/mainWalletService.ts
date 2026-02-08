/**
 * Main Wallet Service
 * 
 * Handles the main wallet (reward sender) configuration and connection.
 * This wallet is configured once and used automatically.
 */

import { Keypair } from '@solana/web3.js';

let mainWallet: Keypair | null = null;

/**
 * Initialize main wallet from config file
 */
export async function initializeMainWallet(): Promise<Keypair | null> {
  if (mainWallet) {
    return mainWallet;
  }

  try {
    // Try to load from config file
    const response = await fetch('/config/main-wallet.json');
    if (!response.ok) {
      console.warn('Main wallet config not found. Using environment variable or default.');
      return null;
    }

    const config = await response.json();
    
    if (!config.privateKey || !Array.isArray(config.privateKey)) {
      throw new Error('Invalid wallet config: privateKey must be an array');
    }

    if (config.privateKey.length !== 64) {
      throw new Error('Invalid wallet config: privateKey must be 64 bytes');
    }

    // Create keypair from private key
    mainWallet = Keypair.fromSecretKey(Uint8Array.from(config.privateKey));
    
    console.log('✅ Main wallet initialized:', mainWallet.publicKey.toString());
    return mainWallet;

  } catch (error) {
    console.error('Failed to initialize main wallet:', error);
    
    // Fallback: try environment variable
    const envKey = import.meta.env.VITE_MAIN_WALLET_PRIVATE_KEY;
    if (envKey) {
      try {
        const keyArray = JSON.parse(envKey);
        mainWallet = Keypair.fromSecretKey(Uint8Array.from(keyArray));
        console.log('✅ Main wallet initialized from environment variable');
        return mainWallet;
      } catch (e) {
        console.error('Failed to parse environment variable:', e);
      }
    }
    
    return null;
  }
}

/**
 * Get the main wallet (if initialized)
 */
export function getMainWallet(): Keypair | null {
  return mainWallet;
}

/**
 * Check if main wallet is initialized
 */
export function isMainWalletInitialized(): boolean {
  return mainWallet !== null;
}
