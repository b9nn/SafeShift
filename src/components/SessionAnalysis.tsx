import { useState, useEffect } from 'react';
import { Company } from '../types/company';
import './SessionAnalysis.css';

interface HealthWarning {
  metric: string;
  metricName: string;
  value: number;
  unit: string;
  threshold: string;
  violationRate: string;
  warning: string;
  severity: 'high' | 'medium';
}

interface SessionAnalysis {
  warnings: HealthWarning[];
  summary: string;
  totalReadings?: number;
  sessionPeriod?: string;
}

interface SessionAnalysisProps {
  company: Company;
}

const SessionAnalysis = ({ company }: SessionAnalysisProps) => {
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async (hoursBack = 24) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `http://localhost:3001/api/session-analysis/${company.id}?hours=${hoursBack}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch session analysis');
      }
      
      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching session analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMetricIcon = (metric: string) => {
    const icons: Record<string, string> = {
      temperature: '🌡️',
      humidity: '💧',
      airQuality: '💨',
      noise: '🔊',
      lighting: '💡',
    };
    return icons[metric] || '⚠️';
  };

  const getSeverityColor = (severity: string) => {
    return severity === 'high' ? 'high-severity' : 'medium-severity';
  };

  if (loading) {
    return (
      <div className="session-analysis">
        <div className="analysis-loading">
          <p>🤖 Analyzing session data with AI...</p>
          <p className="hint">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="session-analysis">
        <div className="analysis-error">
          <p>❌ Error: {error}</p>
          <button onClick={() => fetchAnalysis()} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-analysis">
      <div className="analysis-header">
        <h3>📋 Session Health Analysis</h3>
        <div className="analysis-controls">
          <select 
            onChange={(e) => fetchAnalysis(parseInt(e.target.value))}
            className="time-select"
            defaultValue="24"
          >
            <option value="1">Last 1 hour</option>
            <option value="6">Last 6 hours</option>
            <option value="24">Last 24 hours</option>
            <option value="168">Last 7 days</option>
          </select>
          <button onClick={() => fetchAnalysis()} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>

      {!analysis ? (
        <div className="analysis-placeholder">
          <p>Click "Generate Analysis" to get AI-powered health warnings</p>
          <button onClick={() => fetchAnalysis()} className="generate-btn">
            🤖 Generate Analysis
          </button>
        </div>
      ) : (
        <>
          <div className="analysis-summary">
            <p>{analysis.summary}</p>
            {analysis.totalReadings && (
              <p className="analysis-stats">
                📊 {analysis.totalReadings} readings analyzed
                {analysis.sessionPeriod && ` • ${analysis.sessionPeriod}`}
              </p>
            )}
          </div>

          {analysis.warnings.length === 0 ? (
            <div className="analysis-success">
              <div className="success-icon">✅</div>
              <h4>All Clear!</h4>
              <p>No safety concerns detected. Working conditions are within safe ranges.</p>
            </div>
          ) : (
            <div className="warnings-list">
              <h4>⚠️ Health Warnings ({analysis.warnings.length})</h4>
              {analysis.warnings.map((warning, index) => (
                <div key={index} className={`warning-card ${getSeverityColor(warning.severity)}`}>
                  <div className="warning-header">
                    <span className="metric-icon">{getMetricIcon(warning.metric)}</span>
                    <div className="metric-info">
                      <h5>{warning.metricName.charAt(0).toUpperCase() + warning.metricName.slice(1)}</h5>
                      <p className="metric-value">
                        {warning.value.toFixed(1)} {warning.unit} 
                        <span className="threshold"> (Safe: {warning.threshold})</span>
                      </p>
                      <p className="violation-rate">
                        {warning.violationRate}% of readings outside safe range
                      </p>
                    </div>
                    <span className={`severity-badge ${warning.severity}`}>
                      {warning.severity === 'high' ? '🔴 High' : '🟡 Medium'}
                    </span>
                  </div>
                  <div className="warning-message">
                    <p>{warning.warning}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SessionAnalysis;
