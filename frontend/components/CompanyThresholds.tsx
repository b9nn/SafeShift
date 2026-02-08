import './CompanyThresholds.css';

interface MetricCard {
  label: string;
  value: string;
  unit: string;
}

const THRESHOLDS: MetricCard[] = [
  { label: 'Morale Score', value: '75', unit: '/100' },
  { label: 'Temperature', value: '24', unit: '°C' },
  { label: 'Magnetic Field', value: '50', unit: 'μT' },
  { label: 'Pressure', value: '1013', unit: 'hPa' },
  { label: 'Noise Score', value: '70', unit: '/100' },
];

interface CompanyThresholdsProps {
  onStart?: () => void;
}

export default function CompanyThresholds({ onStart }: CompanyThresholdsProps) {
  return (
    <div className="thresholds-page">
      <div className="hex-bg" />

      <div className="thresholds-content">
        <h2 className="thresholds-heading">Company Thresholds</h2>

        <div className="thresholds-grid">
          {THRESHOLDS.map((metric) => (
            <div className="metric-card" key={metric.label}>
              <span className="metric-label">{metric.label}</span>
              <span className="metric-value">{metric.value}</span>
              <span className="metric-unit">{metric.unit}</span>
            </div>
          ))}
        </div>

        <div className="reward-info">
          <div className="reward-badge">
            <span className="reward-label">Solana Safety Incentive</span>
            <span className="reward-amount">0.1 — 0.2 SOL</span>
            <span className="reward-steps">
              <span className="step">Sensors monitor conditions in real-time</span>
              <span className="step-arrow">→</span>
              <span className="step">ML model scores workplace risk</span>
              <span className="step-arrow">→</span>
              <span className="step">Safe score triggers automatic SOL payout</span>
            </span>
            <span className="reward-detail">
              Earned hourly when risk score &lt; 0.3 · paid directly to your Solana wallet on Devnet
            </span>
          </div>
        </div>

        {onStart && (
          <button className="start-monitoring-btn" onClick={onStart}>
            Start Monitoring
          </button>
        )}
      </div>
    </div>
  );
}
