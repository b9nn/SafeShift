import { useState, useEffect } from 'react';
import { useSolana } from '../context/SolanaContext';
import { Company } from '../types/company';
import { CompanyService } from '../services/companyService';
import { AutomatedRewardService } from '../services/automatedRewardService';
import './Dashboard.css';
import RewardPanel from './RewardPanel';
import SafetyMonitor from './SafetyMonitor';
import AutomatedRewardsControl from './AutomatedRewardsControl';
import SessionAnalysis from './SessionAnalysis';

interface DashboardProps {
  selectedCompany: Company | null;
}

const Dashboard = ({ selectedCompany }: DashboardProps) => {
  const { isConnected, rewardService } = useSolana();
  const [automatedService, setAutomatedService] = useState<AutomatedRewardService | null>(null);

  useEffect(() => {
    if (isConnected && rewardService) {
      const service = new AutomatedRewardService(rewardService, {
        minSafetyScore: 80,
        baseRewardAmount: 0.1,
        maxRewardAmount: 0.2,
        checkInterval: 60000, // 1 minute
      });
      setAutomatedService(service);
      
      // Start automated rewards
      service.start();

      return () => {
        service.stop();
      };
    }
  }, [isConnected, rewardService]);

  if (!isConnected) {
    return (
      <div className="dashboard">
        <div className="dashboard-placeholder">
          <p>⏳ Loading main wallet...</p>
        </div>
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div className="dashboard">
        <div className="dashboard-placeholder">
          <p>👈 Select a company from the sidebar to view their dashboard</p>
          <p className="hint">Or register a new company to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>📊 {selectedCompany.name} Dashboard</h2>
        <AutomatedRewardsControl service={automatedService} />
      </div>
      
      <div className="dashboard-grid">
        <div className="dashboard-section">
          <SafetyMonitor company={selectedCompany} />
        </div>
        <div className="dashboard-section">
          <RewardPanel company={selectedCompany} />
        </div>
      </div>
      
      <div className="dashboard-section full-width">
        <SessionAnalysis company={selectedCompany} />
      </div>
    </div>
  );
};

export default Dashboard;
