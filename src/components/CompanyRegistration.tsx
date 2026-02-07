import { useState } from 'react';
import { CompanyService } from '../services/companyService';
import { Company } from '../types/company';
import './CompanyRegistration.css';

interface CompanyRegistrationProps {
  onCompanyRegistered: (company: Company) => void;
}

const CompanyRegistration = ({ onCompanyRegistered }: CompanyRegistrationProps) => {
  const [name, setName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateWalletAddress = (address: string): boolean => {
    // Basic Solana address validation (base58, 32-44 chars)
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim()) {
      setError('Company name is required');
      return;
    }

    if (!walletAddress.trim()) {
      setError('Wallet address is required');
      return;
    }

    if (!validateWalletAddress(walletAddress)) {
      setError('Invalid Solana wallet address');
      return;
    }

    // Check if wallet already registered
    const existing = CompanyService.getCompanyByWallet(walletAddress);
    if (existing) {
      setError('This wallet address is already registered');
      return;
    }

    setIsSubmitting(true);

    try {
      const company = CompanyService.registerCompany(name.trim(), walletAddress.trim());
      setSuccess(true);
      setName('');
      setWalletAddress('');
      onCompanyRegistered(company);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to register company');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="company-registration">
      <h2>🏢 Company Registration</h2>
      <p className="registration-description">
        Register your company to start receiving automated safety rewards.
        When your safety scores are high, rewards will be sent to your wallet automatically.
      </p>

      <form onSubmit={handleSubmit} className="registration-form">
        <div className="form-group">
          <label htmlFor="company-name">Company Name</label>
          <input
            id="company-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your company name"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="wallet-address">Solana Wallet Address</label>
          <input
            id="wallet-address"
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter your Solana wallet address (for receiving rewards)"
            disabled={isSubmitting}
            required
          />
          <small className="form-hint">
            This is where rewards will be sent when your safety scores are high
          </small>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            ✅ Company registered successfully!
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="submit-btn"
        >
          {isSubmitting ? 'Registering...' : 'Register Company'}
        </button>
      </form>
    </div>
  );
};

export default CompanyRegistration;
