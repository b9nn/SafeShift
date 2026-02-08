import './WalletPage.css';

interface WalletPageProps {
  onContinue: () => void;
}

export default function WalletPage({ onContinue }: WalletPageProps) {
  return (
    <div className="wallet-page">
      <div className="hex-bg" />

      <h1 className="wallet-page-brand">SafeShift</h1>

      <div className="wallet-page-content">
        <div className="wallet-placeholder-card">
          <h2>Wallet Connected</h2>
          <div className="wallet-address-preview">
            <span className="wallet-dot" />
            <span className="wallet-addr">7xKX...9f3D</span>
          </div>
          <p className="wallet-balance">Balance: 2.45 SOL</p>
          <p className="wallet-network">Network: Devnet</p>
        </div>

        <button className="wallet-continue-btn" onClick={onContinue}>
          View Dashboard
        </button>
      </div>
    </div>
  );
}
