/**
 * Automated Reward Distribution Service
 * 
 * Automatically sends rewards from main wallet to companies
 * when their safety scores are high enough
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SolanaRewardService, SafetyScore } from './solanaRewardService';
import { CompanyService } from './companyService';
import { Company } from '../types/company';

export interface RewardConfig {
  minSafetyScore: number; // Minimum score to qualify (default: 80)
  baseRewardAmount: number; // Base reward in SOL (default: 0.1)
  maxRewardAmount: number; // Maximum reward in SOL (default: 0.2)
  checkInterval: number; // How often to check (ms) (default: 60000 = 1 min)
}

export class AutomatedRewardService {
  private rewardService: SolanaRewardService;
  private config: RewardConfig;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(
    rewardService: SolanaRewardService,
    config: Partial<RewardConfig> = {}
  ) {
    this.rewardService = rewardService;
    this.config = {
      minSafetyScore: config.minSafetyScore || 80,
      baseRewardAmount: config.baseRewardAmount || 0.1,
      maxRewardAmount: config.maxRewardAmount || 0.2,
      checkInterval: config.checkInterval || 60000, // 1 minute
    };
  }

  /**
   * Start automated reward checking
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Automated reward service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🤖 Automated reward service started');

    // Check immediately
    this.checkAndDistributeRewards();

    // Then check at intervals
    this.checkIntervalId = setInterval(() => {
      this.checkAndDistributeRewards();
    }, this.config.checkInterval);
  }

  /**
   * Stop automated reward checking
   */
  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Automated reward service stopped');
  }

  /**
   * Check all companies and distribute rewards if qualified
   */
  async checkAndDistributeRewards(): Promise<void> {
    const companies = CompanyService.getAllCompanies().filter(c => c.isActive);
    
    if (companies.length === 0) {
      return;
    }

    console.log(`🔍 Checking ${companies.length} companies for rewards...`);

    for (const company of companies) {
      try {
        await this.checkCompanyAndReward(company);
      } catch (error) {
        console.error(`Error checking company ${company.name}:`, error);
      }
    }
  }

  /**
   * Check a single company and send reward if qualified
   */
  async checkCompanyAndReward(company: Company): Promise<boolean> {
    // Get latest safety report
    const latestReport = CompanyService.getLatestReport(company.id);

    if (!latestReport) {
      // No data yet, skip
      return false;
    }

    // Check if company qualifies
    const safetyScore: SafetyScore = {
      factoryId: company.id,
      score: latestReport.score,
      timestamp: latestReport.timestamp,
      metrics: latestReport.metrics,
    };

    const qualifies = this.rewardService.qualifiesForReward(
      safetyScore,
      this.config.minSafetyScore
    );

    if (!qualifies) {
      return false;
    }

    // Check if we've already rewarded recently (prevent spam)
    const timeSinceLastReward = company.lastRewardAt
      ? Date.now() - company.lastRewardAt
      : Infinity;

    // Only reward if last reward was more than 1 hour ago
    if (timeSinceLastReward < 3600000) {
      console.log(`⏳ Company ${company.name} already rewarded recently, skipping`);
      return false;
    }

    // Calculate reward amount
    const rewardAmount = this.calculateReward(safetyScore.score);

    try {
      // Send reward
      console.log(`💰 Sending ${rewardAmount} SOL to ${company.name}...`);
      const signature = await this.rewardService.sendSOLReward(
        company.walletAddress,
        rewardAmount
      );

      // Record the reward
      CompanyService.recordReward(company.id, rewardAmount);

      // Store compliance hash
      try {
        await this.rewardService.storeComplianceHash(
          company.id,
          safetyScore,
          company.walletAddress
        );
      } catch (err) {
        console.warn('Could not store compliance hash:', err);
      }

      console.log(`✅ Reward sent! Transaction: ${signature}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send reward to ${company.name}:`, error);
      throw error;
    }
  }

  /**
   * Calculate reward amount based on safety score
   */
  private calculateReward(score: number): number {
    // Scale from baseRewardAmount to maxRewardAmount based on score
    const scoreRange = 100 - this.config.minSafetyScore; // e.g., 100 - 80 = 20
    const scoreAboveMin = score - this.config.minSafetyScore; // e.g., 85 - 80 = 5
    const ratio = scoreAboveMin / scoreRange; // e.g., 5 / 20 = 0.25

    const rewardRange = this.config.maxRewardAmount - this.config.baseRewardAmount;
    const reward = this.config.baseRewardAmount + (rewardRange * ratio);

    return Math.min(reward, this.config.maxRewardAmount);
  }

  /**
   * Manually trigger reward check for a specific company
   */
  async rewardCompany(companyId: string): Promise<boolean> {
    const company = CompanyService.getCompanyById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    return await this.checkCompanyAndReward(company);
  }

  /**
   * Get status of automated service
   */
  getStatus(): { isRunning: boolean; config: RewardConfig } {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }
}
