import { useSolana } from '../context/SolanaContext';
import './WalletConnection.css';

const WalletConnection = () => {
  const { isConnected, walletAddress, balance, network } = useSolana();

  if (!isConnected) {
    return (
      <div className="wallet-connection">
        <div className="wallet-card error">
          <h3>⚠️ Main Wallet Not Configured</h3>
          <p>Please set up <code>config/main-wallet.json</code> with your main wallet private key.</p>
          <p className="hint">This wallet will be used to send rewards to companies.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-connection">
      <div className="wallet-card connected">
        <div className="wallet-header">
          <h3>💰 Main Reward Wallet</h3>
        </div>
        <div className="wallet-info">
          <div className="info-row">
            <span className="label">Address:</span>
            <span className="value">{walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}</span>
          </div>
          <div className="info-row">
            <span className="label">Balance:</span>
            <span className="value">{balance.toFixed(4)} SOL</span>
          </div>
          <div className="info-row">
            <span className="label">Network:</span>
            <span className="value">{network}</span>
          </div>
        </div>
        <div className="wallet-note">
          <small>This wallet automatically sends rewards to companies when safety scores are high.</small>
        </div>
      </div>
    </div>
  );
};

export default WalletConnection;
