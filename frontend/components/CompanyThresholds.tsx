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
          <span className="reward-label">SOL Reward</span>
          <span className="reward-amount">0.1 — 0.2 SOL</span>
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
