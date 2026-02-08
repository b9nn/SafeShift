import { useMemo } from 'react';
import { computeRiskScore, computeReward } from './LiveFeed';
import './SolanaResults.css';

interface SolanaResultsProps {
  finalValues: number[];
}

// ---------------------------------------------------------------------------
// Generate a fake but realistic-looking Solana tx signature (base58)
// ---------------------------------------------------------------------------
function fakeTxSignature(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let sig = '';
  for (let i = 0; i < 88; i++) sig += chars[Math.floor(Math.random() * chars.length)];
  return sig;
}

function fakeWalletAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let addr = '';
  for (let i = 0; i < 44; i++) addr += chars[Math.floor(Math.random() * chars.length)];
  return addr;
}

function truncate(s: string, head = 6, tail = 6): string {
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SolanaResults({ finalValues }: SolanaResultsProps) {
  const data = useMemo(() => {
    const riskScore = computeRiskScore(finalValues);
    const qualifies = riskScore < 0.3;
    const rewardAmount = computeReward(riskScore);
    const txSig = fakeTxSignature();
    const senderWallet = fakeWalletAddress();
    const recipientWallet = fakeWalletAddress();
    const confidence = 0.85 + Math.random() * 0.14; // 0.85 – 0.99
    const timestamp = new Date();

    return {
      riskScore,
      qualifies,
      rewardAmount,
      txSig,
      senderWallet,
      recipientWallet,
      confidence,
      timestamp,
      lamports: Math.round(rewardAmount * 1_000_000_000),
      network: 'devnet' as const,
    };
  }, [finalValues]);

  return (
    <div className="solres-page">
      <div className="hex-bg" />

      <div className="solres-content">
        <h2 className="solres-heading">Solana Results</h2>
        <p className="solres-subtitle">On-chain safety reward transaction</p>

        {/* Status banner */}
        <div className={`solres-status-banner ${data.qualifies ? 'success' : 'fail'}`}>
          <span className="solres-status-icon">{data.qualifies ? '✅' : '❌'}</span>
          <div className="solres-status-text">
            <strong>{data.qualifies ? 'Reward Sent' : 'No Reward — Risk Too High'}</strong>
            <span>
              {data.qualifies
                ? `${data.rewardAmount.toFixed(4)} SOL transferred to company wallet`
                : `Risk score ${data.riskScore.toFixed(3)} exceeds 0.3 threshold`}
            </span>
          </div>
        </div>

        {/* Transaction card */}
        <div className="solres-card">
          <h4 className="solres-card-title">Transaction Details</h4>
          <div className="solres-row">
            <span className="solres-label">Status</span>
            <span className={`solres-value pill ${data.qualifies ? 'confirmed' : 'skipped'}`}>
              {data.qualifies ? 'Confirmed' : 'Skipped'}
            </span>
          </div>
          <div className="solres-row">
            <span className="solres-label">Network</span>
            <span className="solres-value">{data.network}</span>
          </div>
          {data.qualifies && (
            <>
              <div className="solres-row">
                <span className="solres-label">Signature</span>
                <span className="solres-value mono" title={data.txSig}>
                  {truncate(data.txSig, 8, 8)}
                </span>
              </div>
              <div className="solres-row">
                <span className="solres-label">Amount</span>
                <span className="solres-value highlight">{data.rewardAmount.toFixed(4)} SOL</span>
              </div>
              <div className="solres-row">
                <span className="solres-label">Lamports</span>
                <span className="solres-value mono">{data.lamports.toLocaleString()}</span>
              </div>
            </>
          )}
          <div className="solres-row">
            <span className="solres-label">Timestamp</span>
            <span className="solres-value">{data.timestamp.toLocaleString()}</span>
          </div>
        </div>

        {/* Model output card */}
        <div className="solres-card">
          <h4 className="solres-card-title">Model Output</h4>
          <div className="solres-row">
            <span className="solres-label">Risk Score</span>
            <span className={`solres-value ${data.qualifies ? 'green' : 'red'}`}>
              {data.riskScore.toFixed(4)}
            </span>
          </div>
          <div className="solres-row">
            <span className="solres-label">Confidence</span>
            <span className="solres-value">{(data.confidence * 100).toFixed(1)}%</span>
          </div>
          <div className="solres-row">
            <span className="solres-label">Is Safe</span>
            <span className={`solres-value pill ${data.qualifies ? 'confirmed' : 'skipped'}`}>
              {data.qualifies ? 'true' : 'false'}
            </span>
          </div>
        </div>

        {/* Wallet card */}
        {data.qualifies && (
          <div className="solres-card">
            <h4 className="solres-card-title">Wallets</h4>
            <div className="solres-row">
              <span className="solres-label">Sender (Main)</span>
              <span className="solres-value mono" title={data.senderWallet}>
                {truncate(data.senderWallet, 6, 6)}
              </span>
            </div>
            <div className="solres-row">
              <span className="solres-label">Recipient (Company)</span>
              <span className="solres-value mono" title={data.recipientWallet}>
                {truncate(data.recipientWallet, 6, 6)}
              </span>
            </div>
          </div>
        )}

        {/* Reward formula */}
        <div className="solres-formula">
          <span className="formula-label">Reward Formula</span>
          <code>rewardAmount = 0.1 + (0.3 − riskScore) × 0.1</code>
          <span className="formula-note">Clamped 0.1 – 0.2 SOL &middot; 1 hr cooldown per company</span>
        </div>

        {data.qualifies && (
          <button className="collect-btn" onClick={() => alert('Reward collection will be wired to Solana backend')}>
            Collect {data.rewardAmount.toFixed(4)} SOL
          </button>
        )}
      </div>
    </div>
  );
}
