import { useState, useEffect } from 'react';
import { Company } from '../types/company';
import './NLPWarnings.css';

interface NLPWarning {
  timestamp: number;
  severity: 'high' | 'medium';
  categories: string[];
  message: string;
}

interface NLPWarningsProps {
  company: Company;
}

const NLPWarnings = ({ company }: NLPWarningsProps) => {
  const [warnings, setWarnings] = useState<NLPWarning[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWarnings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/nlp-warnings/${company.id}?limit=10`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch NLP warnings');
      }
      
      const data = await response.json();
      setWarnings(data.warnings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching NLP warnings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarnings();
    // Refresh every 30 seconds
    const interval = setInterval(fetchWarnings, 30000);
    return () => clearInterval(interval);
  }, [company.id]);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      toxic: '⚠️',
      severe_toxic: '🔴',
      obscene: '🚫',
      threat: '⚔️',
      insult: '💬',
      identity_hate: '🚨',
    };
    return icons[category] || '⚠️';
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading && warnings.length === 0) {
    return (
      <div className="nlp-warnings">
        <div className="warnings-loading">
          <p>Loading abuse reports...</p>
        </div>
      </div>
    );
  }

  if (error && warnings.length === 0) {
    return (
      <div className="nlp-warnings">
        <div className="warnings-error">
          <p>⚠️ Error loading warnings: {error}</p>
          <button onClick={fetchWarnings} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nlp-warnings">
      <div className="warnings-header">
        <h3>🚨 Verbal Abuse Warnings</h3>
        <button onClick={fetchWarnings} className="refresh-btn" title="Refresh warnings">
          🔄
        </button>
      </div>

      {warnings.length === 0 ? (
        <div className="warnings-empty">
          <div className="empty-icon">✅</div>
          <p>No verbal abuse detected</p>
          <p className="hint">All worker reports are clean</p>
        </div>
      ) : (
        <div className="warnings-list">
          {warnings.map((warning, index) => (
            <div key={index} className={`warning-item ${warning.severity}`}>
              <div className="warning-header">
                <span className="warning-time">{formatTime(warning.timestamp)}</span>
                <span className={`severity-badge ${warning.severity}`}>
                  {warning.severity === 'high' ? '🔴 High' : '🟡 Medium'}
                </span>
              </div>
              <div className="warning-message">
                <p>{warning.message}</p>
              </div>
              <div className="warning-categories">
                {warning.categories.map((category, catIndex) => (
                  <span key={catIndex} className="category-tag">
                    {getCategoryIcon(category)} {category.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NLPWarnings;
