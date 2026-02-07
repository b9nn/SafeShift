import { useState, useEffect } from 'react';
import { Company } from '../types/company';
import { CompanyService } from '../services/companyService';
import { SafetyReport } from '../types/company';
import './SafetyMonitor.css';

interface SafetyMonitorProps {
  company: Company;
}

const SafetyMonitor = ({ company }: SafetyMonitorProps) => {
  const [safetyScore, setSafetyScore] = useState<number>(85);
  const [metrics, setMetrics] = useState({
    temperature: 72,
    humidity: 45,
    airQuality: 850,
    noise: 75,
    lighting: 350,
  });

  // Simulate real-time updates and store reports
  useEffect(() => {
    let currentMetrics = { ...metrics };
    
    const updateMetrics = () => {
      // Simulate slight variations in metrics
      const newMetrics = {
        temperature: Math.max(68, Math.min(80, currentMetrics.temperature + (Math.random() - 0.5) * 2)),
        humidity: Math.max(20, Math.min(60, currentMetrics.humidity + (Math.random() - 0.5) * 2)),
        airQuality: Math.max(400, Math.min(1200, currentMetrics.airQuality + (Math.random() - 0.5) * 50)),
        noise: Math.max(60, Math.min(90, currentMetrics.noise + (Math.random() - 0.5) * 3)),
        lighting: Math.max(200, Math.min(500, currentMetrics.lighting + (Math.random() - 0.5) * 20)),
      };

      currentMetrics = newMetrics;
      setMetrics(newMetrics);

      // Calculate safety score
      const score = calculateSafetyScore(newMetrics);
      setSafetyScore(score);

      // Store safety report (simulate device reporting)
      const deviceId = company.deviceIds[0] || `device-${company.id}`;
      const report: SafetyReport = {
        companyId: company.id,
        deviceId,
        timestamp: Date.now(),
        score,
        metrics: newMetrics,
      };
      CompanyService.storeSafetyReport(report);
    };

    // Initial update
    updateMetrics();

    // Update every 3 seconds
    const interval = setInterval(updateMetrics, 3000);

    return () => clearInterval(interval);
  }, [company.id]);

  const calculateSafetyScore = (m: typeof metrics): number => {
    // Simplified scoring algorithm
    let score = 100;
    
    // Temperature penalty (ideal: 68-76°F)
    if (m.temperature < 68 || m.temperature > 76) {
      score -= 10;
    }
    if (m.temperature < 65 || m.temperature > 80) {
      score -= 10;
    }

    // Humidity penalty (ideal: 20-60%)
    if (m.humidity < 20 || m.humidity > 60) {
      score -= 5;
    }

    // Air quality penalty (ideal: <1000 ppm CO2)
    if (m.airQuality > 1000) {
      score -= (m.airQuality - 1000) / 20;
    }

    // Noise penalty (ideal: <85 dBA)
    if (m.noise > 85) {
      score -= (m.noise - 85) * 2;
    }

    // Lighting penalty (ideal: >300 lux)
    if (m.lighting < 300) {
      score -= (300 - m.lighting) / 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="safety-monitor">
      <div className="monitor-header">
        <h2>📊 Safety Monitor</h2>
        <div className="company-info">
          <span className="company-name">{company.name}</span>
          <span className="device-count">{company.deviceIds.length} device(s)</span>
        </div>
      </div>

      <div className="score-display">
        <div className="score-circle" style={{ borderColor: getScoreColor(safetyScore) }}>
          <div className="score-value" style={{ color: getScoreColor(safetyScore) }}>
            {safetyScore}
          </div>
          <div className="score-label">Safety Score</div>
        </div>
      </div>

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
          label="Air Quality"
          value={metrics.airQuality}
          unit="ppm CO₂"
          status={metrics.airQuality < 1000 ? 'good' : 'warning'}
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
          status={metrics.lighting >= 300 ? 'good' : 'warning'}
        />
      </div>
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
        {value.toFixed(status === 'good' ? 0 : 1)} <span className="metric-unit">{unit}</span>
      </div>
      <div className="metric-status">
        {status === 'good' ? '✅' : '⚠️'}
      </div>
    </div>
  );
};

export default SafetyMonitor;
