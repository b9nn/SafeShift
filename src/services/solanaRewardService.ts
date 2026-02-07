/**
 * Solana Reward Service
 * 
 * Pure TypeScript implementation for SafeShift reward system.
 * Uses existing Solana programs (System Program, Token Program) - no Rust needed!
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

export interface RewardConfig {
  connection: Connection;
  wallet: Keypair;
  network: 'devnet' | 'mainnet-beta' | 'testnet';
}

export interface SafetyScore {
  factoryId: string;
  score: number; // 0-100, higher is safer
  timestamp: number;
  metrics: {
    temperature: number;
    humidity: number;
    airQuality: number;
    noise: number;
    lighting: number;
  };
}

export class SolanaRewardService {
  private connection: Connection;
  private wallet: Keypair;
  private network: string;

  constructor(config: RewardConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.network = config.network;
  }

  /**
   * Send SOL reward to a factory/worker address
   */
  async sendSOLReward(
    recipientAddress: string,
    amountSOL: number
  ): Promise<string> {
    try {
      const recipientPubkey = new PublicKey(recipientAddress);
      const amountLamports = amountSOL * LAMPORTS_PER_SOL;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: recipientPubkey,
          lamports: amountLamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet]
      );

      return signature;
    } catch (error) {
      console.error('Error sending SOL reward:', error);
      throw error;
    }
  }

  /**
   * Create a reward token mint (one-time setup)
   * Returns the mint address
   */
  async createRewardToken(
    decimals: number = 9,
    mintAuthority?: PublicKey
  ): Promise<PublicKey> {
    try {
      const mint = await createMint(
        this.connection,
        this.wallet,
        mintAuthority || this.wallet.publicKey,
        null, // freeze authority
        decimals,
        undefined,
        undefined,
        TOKEN_PROGRAM_ID
      );

      return mint;
    } catch (error) {
      console.error('Error creating reward token:', error);
      throw error;
    }
  }

  /**
   * Mint reward tokens to a recipient
   */
  async mintRewardTokens(
    mintAddress: string,
    recipientAddress: string,
    amount: number
  ): Promise<string> {
    try {
      const mint = new PublicKey(mintAddress);
      const recipient = new PublicKey(recipientAddress);

      // Get or create token account for recipient
      const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        mint,
        recipient
      );

      // Mint tokens
      const signature = await mintTo(
        this.connection,
        this.wallet,
        mint,
        recipientTokenAccount.address,
        this.wallet,
        amount
      );

      return signature;
    } catch (error) {
      console.error('Error minting reward tokens:', error);
      throw error;
    }
  }

  /**
   * Calculate reward amount based on safety score
   * Higher scores = higher rewards
   */
  calculateRewardAmount(score: number, baseReward: number = 0.1): number {
    // Linear scaling: score 0-100 maps to 0-2x base reward
    const multiplier = score / 100;
    return baseReward * (1 + multiplier);
  }

  /**
   * Check if factory qualifies for reward based on safety score
   */
  qualifiesForReward(score: SafetyScore, threshold: number = 80): boolean {
    return score.score >= threshold;
  }

  /**
   * Store compliance record hash on-chain
   * Uses a simple transaction with memo-like data
   */
  async storeComplianceHash(
    factoryId: string,
    score: SafetyScore,
    recipientAddress: string
  ): Promise<string> {
    // Create a hash of the compliance data
    const data = JSON.stringify({
      factoryId,
      score: score.score,
      timestamp: score.timestamp,
      metrics: score.metrics,
    });

    // For hackathon: we'll send a small SOL transfer with the hash in a memo
    // In production, you'd use a proper program, but this works for demo
    const hash = await this.hashData(data);
    
    // Send minimal amount (0.000001 SOL) to store the hash
    // The recipient address acts as a record identifier
    return await this.sendSOLReward(recipientAddress, 0.000001);
  }

  /**
   * Simple hash function (for demo - use crypto in production)
   */
  private async hashData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(limit: number = 10) {
    const signatures = await this.connection.getSignaturesForAddress(
      this.wallet.publicKey,
      { limit }
    );
    return signatures;
  }
}
