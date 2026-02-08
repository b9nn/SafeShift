/**
 * Company/Factory Types
 */

export interface Company {
  id: string;
  name: string;
  walletAddress: string; // Solana wallet address for receiving rewards
  registeredAt: number;
  deviceIds: string[]; // Sensor device IDs linked to this company
  totalRewardsReceived: number; // Total SOL received
  lastRewardAt: number | null;
  isActive: boolean;
}

export interface Device {
  id: string;
  companyId: string;
  name: string;
  location: string;
  registeredAt: number;
  isActive: boolean;
}

export interface SafetyReport {
  companyId: string;
  deviceId: string;
  timestamp: number;
  score: number;
  metrics: {
    temperature: number;
    humidity: number;
    noise: number;
    lighting: number;
    pressure?: number;
    vibration?: number;
    magnetic_uT?: number;
  };
  riskScore?: string;
  confidence?: string;
  isSafe?: boolean;
}
