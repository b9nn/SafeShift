import { useEffect, useState } from 'react';
import { useSolana } from '../context/SolanaContext';
import walletConfig from '../../config/wallet';
import './MainWalletStatus.css';

const MainWalletStatus = () => {
  const { wallet, balance, network, refreshBalance } = useSolana();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Refresh balance on mount and every 10 seconds
    refreshBalance();
    const interval = setInterval(() => {
      refreshBalance();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBalance();
    setIsRefreshing(false);
  };

  if (!wallet) {
    return null;
  }

  return (
    <div className="main-wallet-status">
      <div className="wallet-info-card">
        <div className="wallet-header">
          <div className="wallet-title">
            <span className="wallet-icon">💰</span>
            <div>
              <h3>Main Reward Wallet</h3>
              <p className="wallet-subtitle">Automated reward distribution wallet</p>
            </div>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="refresh-btn"
            title="Refresh balance"
          >
            {isRefreshing ? '⏳' : '🔄'}
          </button>
        </div>
        
        <div className="wallet-details">
          <div className="detail-row">
            <span className="detail-label">Address:</span>
            <span className="detail-value address">
              {walletConfig.address || wallet.publicKey.toString()}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Balance:</span>
            <span className="detail-value balance">
              {balance.toFixed(4)} SOL
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Network:</span>
            <span className="detail-value network">{network}</span>
          </div>
        </div>

        <div className="wallet-status-badge">
          ✅ Ready to distribute rewards
        </div>
      </div>
    </div>
  );
};

export default MainWalletStatus;
