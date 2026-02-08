import { useState, useEffect } from 'react';
import { CompanyService } from '../services/companyService';
import { Company } from '../types/company';
import './CompanyList.css';

interface CompanyListProps {
  onSelectCompany: (company: Company) => void;
  selectedCompanyId?: string;
}

const CompanyList = ({ onSelectCompany, selectedCompanyId }: CompanyListProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    loadCompanies();
    // Refresh every 5 seconds
    const interval = setInterval(loadCompanies, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadCompanies = () => {
    const allCompanies = CompanyService.getAllCompanies();
    setCompanies(allCompanies);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (companies.length === 0) {
    return (
      <div className="company-list empty">
        <p>No companies registered yet.</p>
        <p className="hint">Companies can register to start receiving rewards!</p>
      </div>
    );
  }

  return (
    <div className="company-list">
      <div className="company-list-header">
        <h3>📋 Registered Companies ({companies.length})</h3>
      </div>
      <div className="companies-grid">
        {companies.map((company) => (
          <div
            key={company.id}
            className={`company-card ${selectedCompanyId === company.id ? 'selected' : ''}`}
            onClick={() => onSelectCompany(company)}
          >
            <div className="company-card-header">
              <h4>{company.name}</h4>
              <span className={`status-badge ${company.isActive ? 'active' : 'inactive'}`}>
                {company.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="company-card-body">
              <div className="company-info-row">
                <span className="label">Wallet:</span>
                <span className="value wallet-address">
                  {company.walletAddress.slice(0, 8)}...{company.walletAddress.slice(-8)}
                </span>
              </div>
              <div className="company-info-row">
                <span className="label">Devices:</span>
                <span className="value">{company.deviceIds.length}</span>
              </div>
              <div className="company-info-row">
                <span className="label">Total Rewards:</span>
                <span className="value reward-amount">
                  {company.totalRewardsReceived.toFixed(4)} SOL
                </span>
              </div>
              <div className="company-info-row">
                <span className="label">Last Reward:</span>
                <span className="value">{formatTimeAgo(company.lastRewardAt)}</span>
              </div>
              <div className="company-info-row">
                <span className="label">Registered:</span>
                <span className="value">{formatDate(company.registeredAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompanyList;
