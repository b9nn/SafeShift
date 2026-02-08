import { useState, useEffect, useRef } from 'react';
import { Company } from '../types/company';
import './SafetyMonitor.css';

const API_BASE = '/api';
const POLL_INTERVAL = 3000; // ms

interface LiveMetrics {
  temperature: number;
  humidity: number;
  noise: number;
  lighting: number;
  pressure?: number;
  vibration?: number;
  magnetic_uT?: number;
}

interface SafetyMonitorProps {
  company: Company;
}

const SafetyMonitor = ({ company }: SafetyMonitorProps) => {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isSafe, setIsSafe] = useState<boolean | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const deviceId = company.deviceIds[0] || `device-${company.id}`;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/sensor-data/${deviceId}`);
        const data = await res.json();
        if (data.success && data.metrics) {
          setMetrics(data.metrics);
          setRiskScore(data.riskScore != null ? parseFloat(data.riskScore) : null);
          setConfidence(data.confidence != null ? parseFloat(data.confidence) : null);
          setIsSafe(data.isSafe ?? null);
          setLastUpdate(data.timestamp ?? Date.now());
          setError(null);
        } else {
          setError('Waiting for sensor data...');
        }
      } catch {
        setError('Cannot reach server');
      }
    };

    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [company.id, company.deviceIds]);

  // Convert ML risk score (0-1) to a 0-100 safety score for display
  const safetyScore = riskScore != null ? Math.round((1 - riskScore) * 100) : null;

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="safety-monitor">
      <div className="monitor-header">
        <h2>Safety Monitor</h2>
        <div className="company-info">
          <span className="company-name">{company.name}</span>
          <span className="device-count">{company.deviceIds.length} device(s)</span>
        </div>
      </div>

      {error && !metrics ? (
        <div className="score-display">
          <div className="score-circle" style={{ borderColor: '#666' }}>
            <div className="score-value" style={{ color: '#666', fontSize: '1.2rem' }}>--</div>
            <div className="score-label">{error}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="score-display">
            <div className="score-circle" style={{ borderColor: safetyScore != null ? getScoreColor(safetyScore) : '#666' }}>
              <div className="score-value" style={{ color: safetyScore != null ? getScoreColor(safetyScore) : '#666' }}>
                {safetyScore ?? '--'}
              </div>
              <div className="score-label">
                {isSafe === true ? 'Safe' : isSafe === false ? 'At Risk' : 'Safety Score'}
              </div>
              {confidence != null && (
                <div className="score-confidence">
                  {Math.round(confidence * 100)}% confidence
                </div>
              )}
            </div>
          </div>

          {metrics && (
            <div className="metrics-grid">
              <MetricCard
                label="Temperature"
                value={metrics.temperature}
                unit="°F"
                status={metrics.temperature >= 68 && metrics.temperature <= 76 ? 'good' : 'warning'}
              />
              <MetricCard
                label="Humidity"
                value={metrics.humidity}
                unit="%RH"
                status={metrics.humidity >= 20 && metrics.humidity <= 60 ? 'good' : 'warning'}
              />
              <MetricCard
                label="Noise Level"
                value={metrics.noise}
                unit="dBA"
                status={metrics.noise < 85 ? 'good' : 'warning'}
              />
              <MetricCard
                label="Lighting"
                value={metrics.lighting}
                unit="lux"
                status={metrics.lighting >= 50 ? 'good' : 'warning'}
              />
              {metrics.pressure != null && (
                <MetricCard
                  label="Pressure"
                  value={metrics.pressure}
                  unit="hPa"
                  status={metrics.pressure >= 980 && metrics.pressure <= 1050 ? 'good' : 'warning'}
                />
              )}
              {metrics.vibration != null && (
                <MetricCard
                  label="Vibration"
                  value={metrics.vibration}
                  unit="m/s²"
                  status={metrics.vibration < 2.5 ? 'good' : 'warning'}
                />
              )}
              {metrics.magnetic_uT != null && (
                <MetricCard
                  label="Magnetic"
                  value={metrics.magnetic_uT}
                  unit="µT"
                  status={metrics.magnetic_uT < 80 ? 'good' : 'warning'}
                />
              )}
            </div>
          )}

          {lastUpdate && (
            <div className="last-update">
              Last reading: {new Date(lastUpdate).toLocaleTimeString()}
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  status: 'good' | 'warning';
}

const MetricCard = ({ label, value, unit, status }: MetricCardProps) => {
  return (
    <div className={`metric-card ${status}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value.toFixed(1)} <span className="metric-unit">{unit}</span>
      </div>
      <div className="metric-status">
        {status === 'good' ? '✅' : '⚠️'}
      </div>
    </div>
  );
};

export default SafetyMonitor;
