import { useState, useEffect } from 'react';
import { useSolana } from '../context/SolanaContext';
import { Company } from '../types/company';
import { CompanyService } from '../services/companyService';
import './RewardPanel.css';

interface RewardPanelProps {
  company: Company;
}

const RewardPanel = ({ company }: RewardPanelProps) => {
  const { rewardService, refreshBalance } = useSolana();
  const [rewardAmount, setRewardAmount] = useState(0.1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentScore, setCurrentScore] = useState<number>(0);

  // Get latest safety report
  useEffect(() => {
    const latestReport = CompanyService.getLatestReport(company.id);
    if (latestReport) {
      setCurrentScore(latestReport.score);
    }
  }, [company.id]);

  const qualifiesForReward = currentScore >= 80;
  const calculatedReward = rewardService?.calculateRewardAmount(currentScore, 0.1) || 0.1;

  const handleSendReward = async () => {
    if (!rewardService) {
      setError('Reward service not available');
      return;
    }

    if (!qualifiesForReward) {
      setError('Company does not qualify for reward (score must be ≥ 80)');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const signature = await rewardService.sendSOLReward(company.walletAddress, rewardAmount);
      setLastTransaction(signature);
      
      // Record reward in company service
      CompanyService.recordReward(company.id, rewardAmount);
      
      await refreshBalance();
      
      // Also store compliance hash
      const latestReport = CompanyService.getLatestReport(company.id);
      if (latestReport) {
        try {
          await rewardService.storeComplianceHash(
            company.id,
            {
              factoryId: company.id,
              score: latestReport.score,
              timestamp: latestReport.timestamp,
              metrics: latestReport.metrics,
            },
            company.walletAddress
          );
        } catch (err) {
          console.warn('Could not store compliance hash:', err);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send reward');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="reward-panel">
      <h2>💰 Reward System</h2>
      
      <div className="reward-status">
        <div className={`status-badge ${qualifiesForReward ? 'qualified' : 'not-qualified'}`}>
          {qualifiesForReward ? '✅ Qualified for Reward' : '❌ Not Qualified'}
        </div>
        <p className="status-text">
          Current Safety Score: <strong>{currentScore}/100</strong>
          <br />
          Minimum Required: 80/100
        </p>
      </div>

      <div className="reward-form">
        <div className="form-group">
          <label>Recipient Address</label>
          <input
            type="text"
            value={company.walletAddress}
            disabled
            className="address-input"
          />
          <small className="form-hint">Company's registered wallet address</small>
        </div>

        {qualifiesForReward && (
          <>
          <div className="form-group">
            <label>Reward Amount (SOL)</label>
            <div className="amount-selector">
              <input
                type="number"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="amount-input"
              />
              <button
                onClick={() => setRewardAmount(calculatedReward)}
                className="use-calculated-btn"
              >
                Use Calculated ({calculatedReward.toFixed(3)} SOL)
              </button>
            </div>
            <p className="amount-hint">
              Calculated based on safety score: {calculatedReward.toFixed(3)} SOL
            </p>
          </div>

          <button
            onClick={handleSendReward}
            disabled={isProcessing}
            className="send-reward-btn"
          >
            {isProcessing ? 'Processing...' : '🚀 Send Manual Reward'}
          </button>
          </>
        )}

        {!qualifiesForReward && (
          <div className="info-message">
            ℹ️ Rewards are automatically sent when safety score ≥ 80. 
            Manual rewards can be sent once the score qualifies.
          </div>
        )}

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {lastTransaction && (
          <div className="success-message">
            ✅ Reward sent! Transaction: 
            <a
              href={`https://explorer.solana.com/tx/${lastTransaction}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-link"
            >
              {lastTransaction.slice(0, 16)}...
            </a>
          </div>
        )}
      </div>

      <div className="reward-info">
        <h3>📋 Reward Information</h3>
        <ul>
          <li>Rewards are sent automatically when safety score ≥ 80</li>
          <li>Reward amount scales with safety score (0.1 - 0.2 SOL)</li>
          <li>Compliance records are stored on-chain</li>
          <li>All transactions are transparent and verifiable</li>
        </ul>
      </div>
    </div>
  );
};

export default RewardPanel;
