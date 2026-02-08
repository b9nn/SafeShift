import { useSolana } from '../context/SolanaContext';
import './WalletPage.css';

interface WalletPageProps {
  onContinue: () => void;
}

function truncateAddr(addr: string, head = 6, tail = 6) {
  if (!addr || addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

export default function WalletPage({ onContinue }: WalletPageProps) {
  const { wallet, balance, network, isConnected, refreshBalance } = useSolana();
  const address = wallet?.publicKey.toString() ?? '';
  const displayAddress = truncateAddr(address, 6, 6);

  return (
    <div className="wallet-page">
      <div className="hex-bg" />

      <div className="wallet-page-content">
        <div className="wallet-placeholder-card">
          <h2>Wallet Connected</h2>
          {!isConnected ? (
            <p className="wallet-loading">Loading wallet from config…</p>
          ) : (
            <>
              <div className="wallet-address-preview">
                <span className="wallet-dot" />
                <span className="wallet-addr" title={address}>{displayAddress}</span>
              </div>
              <p className="wallet-balance">Balance: {balance.toFixed(4)} SOL</p>
              <p className="wallet-network">Network: {network}</p>
              <button type="button" className="wallet-refresh-btn" onClick={() => refreshBalance()} title="Refresh balance">
                Refresh balance
              </button>
            </>
          )}
        </div>

        <button className="wallet-continue-btn" onClick={onContinue}>
          View Dashboard
        </button>
      </div>
    </div>
  );
}
