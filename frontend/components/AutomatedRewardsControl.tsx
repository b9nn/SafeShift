import { useState, useEffect } from 'react';
import { AutomatedRewardService } from '../services/automatedRewardService';
import './AutomatedRewardsControl.css';

interface AutomatedRewardsControlProps {
  service: AutomatedRewardService | null;
}

const AutomatedRewardsControl = ({ service }: AutomatedRewardsControlProps) => {
  const [status, setStatus] = useState<{ isRunning: boolean; config: any } | null>(null);

  useEffect(() => {
    if (service) {
      const currentStatus = service.getStatus();
      setStatus(currentStatus);

      // Update status every 5 seconds
      const interval = setInterval(() => {
        setStatus(service.getStatus());
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [service]);

  if (!service || !status) {
    return null;
  }

  const handleToggle = () => {
    if (status.isRunning) {
      service.stop();
    } else {
      service.start();
    }
    setStatus(service.getStatus());
  };

  return (
    <div className="automated-rewards-control">
      <div className={`status-indicator ${status.isRunning ? 'running' : 'stopped'}`}>
        <span className="status-dot"></span>
        <span className="status-text">
          {status.isRunning ? '🤖 Auto-Rewards Active' : '⏸️ Auto-Rewards Paused'}
        </span>
      </div>
      <button onClick={handleToggle} className="toggle-btn">
        {status.isRunning ? 'Pause' : 'Start'}
      </button>
      <div className="config-info">
        <small>
          Min Score: {status.config.minSafetyScore} | 
          Reward: {status.config.baseRewardAmount}-{status.config.maxRewardAmount} SOL |
          Check: Every {status.config.checkInterval / 1000}s
        </small>
      </div>
    </div>
  );
};

export default AutomatedRewardsControl;
