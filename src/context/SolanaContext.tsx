import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { SolanaRewardService } from '../services/solanaRewardService';
import walletConfig from '../../config/wallet.ts';

interface SolanaContextType {
  connection: Connection | null;
  rewardService: SolanaRewardService | null;
  wallet: Keypair | null;
  network: string;
  isConnected: boolean;
  balance: number;
  refreshBalance: () => Promise<void>;
}

const SolanaContext = createContext<SolanaContextType | undefined>(undefined);

export const useSolana = () => {
  const context = useContext(SolanaContext);
  if (!context) {
    throw new Error('useSolana must be used within SolanaProvider');
  }
  return context;
};

// Load main wallet from config
const loadMainWallet = (): Keypair => {
  try {
    const privateKeyArray = walletConfig.privateKey;
    if (!Array.isArray(privateKeyArray) || privateKeyArray.length !== 64) {
      throw new Error('Invalid wallet configuration');
    }
    return Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
  } catch (error) {
    console.error('Failed to load main wallet:', error);
    throw new Error('Main wallet configuration is invalid. Please check config/wallet.json');
  }
};

interface SolanaProviderProps {
  children: ReactNode;
}

export const SolanaProvider: React.FC<SolanaProviderProps> = ({ children }) => {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [wallet, setWallet] = useState<Keypair | null>(null);
  const [rewardService, setRewardService] = useState<SolanaRewardService | null>(null);
  const [network, setNetwork] = useState<string>(walletConfig.network || 'devnet');
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    // Initialize connection and main wallet
    const networkName = walletConfig.network || import.meta.env.VITE_SOLANA_NETWORK || 'devnet';
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(networkName);
    const conn = new Connection(rpcUrl, 'confirmed');
    setConnection(conn);
    setNetwork(networkName);
    
    // Load main wallet from config
    try {
      const mainWallet = loadMainWallet();
      setWallet(mainWallet);
      
      const service = new SolanaRewardService({
        connection: conn,
        wallet: mainWallet,
        network: networkName as 'devnet' | 'mainnet-beta' | 'testnet',
      });
      setRewardService(service);
      
      // Refresh balance
      setTimeout(() => {
        refreshBalance();
      }, 100);
    } catch (error) {
      console.error('Failed to initialize main wallet:', error);
    }
  }, []);

  const refreshBalance = async () => {
    if (rewardService) {
      try {
        const bal = await rewardService.getBalance();
        setBalance(bal);
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    } else if (wallet && connection) {
      // Fallback: get balance directly if service not ready
      try {
        const bal = await connection.getBalance(wallet.publicKey);
        setBalance(bal / 1e9); // Convert lamports to SOL
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    }
  };

  useEffect(() => {
    if (wallet && connection) {
      refreshBalance();
      // Refresh balance every 10 seconds
      const interval = setInterval(refreshBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [wallet, connection]);

  return (
    <SolanaContext.Provider
      value={{
        connection,
        rewardService,
        wallet,
        network,
        isConnected: !!wallet,
        balance,
        refreshBalance,
      }}
    >
      {children}
    </SolanaContext.Provider>
  );
};
