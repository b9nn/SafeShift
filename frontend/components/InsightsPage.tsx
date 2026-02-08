import { useMemo } from 'react';
import { METRICS, computeRiskScore, getStatus } from './LiveFeed';
import type { MetricConfig } from './LiveFeed';
import './InsightsPage.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Insight {
  icon: string;
  title: string;
  body: string;
  recommendation: string;
  severity: 'warning' | 'danger' | 'info';
}

interface InsightsPageProps {
  finalValues: number[];
  onViewSolana: () => void;
}

// ---------------------------------------------------------------------------
// Generate insights from final sensor values
// ---------------------------------------------------------------------------
function generateInsights(values: number[]): Insight[] {
  const insights: Insight[] = [];
  const [morale, temp, mag, pressure, noise] = values;

  // Noise insights
  if (noise > 70) {
    insights.push({
      icon: '⚠️',
      title: 'Chronic Noise Exposure Risk',
      body: `Noise levels averaging ${Math.round(noise)}/100 during this session—exceeding safe thresholds for extended work periods. Prolonged exposure may cause hearing damage, increased stress hormones (cortisol), and cardiovascular strain.`,
      recommendation: 'Implement noise barriers or hearing protection',
      severity: noise > 85 ? 'danger' : 'warning',
    });
  } else {
    insights.push({
      icon: '🔇',
      title: 'Noise Levels Within Safe Range',
      body: `Noise averaged ${Math.round(noise)}/100 throughout the session—well within acceptable occupational limits. No corrective action required.`,
      recommendation: 'Continue monitoring to maintain safe levels',
      severity: 'info',
    });
  }

  // Temperature insights
  if (temp > 28 || temp < 18) {
    const hot = temp > 28;
    insights.push({
      icon: hot ? '🌡️' : '❄️',
      title: hot ? 'Temperature-Related Fatigue Risk' : 'Cold Stress Risk',
      body: hot
        ? `Temperature fluctuating around ${temp.toFixed(1)}°C (${(temp * 9 / 5 + 32).toFixed(0)}°F). Studies show productivity drops 4% per degree above 25°C. Workers may experience dehydration, reduced focus, and heat-related discomfort affecting performance.`
        : `Temperature dropping to ${temp.toFixed(1)}°C (${(temp * 9 / 5 + 32).toFixed(0)}°F). Cold environments impair manual dexterity, increase muscle tension, and raise the risk of slips and falls.`,
      recommendation: hot
        ? 'Adjust thermostat and monitor hydration stations'
        : 'Provide warming breaks and insulated workwear',
      severity: (temp > 34 || temp < 14) ? 'danger' : 'warning',
    });
  } else {
    insights.push({
      icon: '✅',
      title: 'Optimal Temperature Maintained',
      body: `Temperature held steady at ${temp.toFixed(1)}°C throughout the session—within the ideal 18-28°C range for workplace comfort and productivity.`,
      recommendation: 'Maintain current HVAC settings',
      severity: 'info',
    });
  }

  // Magnetic field insights
  if (mag > 80) {
    insights.push({
      icon: '🧲',
      title: 'Elevated Magnetic Field Detected',
      body: `Magnetic field strength at ${Math.round(mag)} μT—above the 80 μT safe threshold. Prolonged exposure to elevated EMF may interfere with electronic medical devices and has been flagged by occupational health guidelines.`,
      recommendation: 'Identify EMF sources and increase safe distance',
      severity: mag > 120 ? 'danger' : 'warning',
    });
  }

  // Pressure insights
  if (pressure < 990 || pressure > 1030) {
    insights.push({
      icon: '📊',
      title: 'Atmospheric Pressure Anomaly',
      body: `Pressure reading at ${Math.round(pressure)} hPa—outside the stable 990-1030 hPa range. Rapid pressure changes can cause headaches, fatigue, and disorientation in sensitive individuals.`,
      recommendation: 'Ensure proper ventilation and monitor for symptoms',
      severity: 'warning',
    });
  }

  // Morale insights
  if (morale < 60) {
    insights.push({
      icon: '😔',
      title: 'Low Workforce Morale Detected',
      body: `Morale score at ${Math.round(morale)}/100—below the 60-point threshold. Low morale correlates with increased workplace incidents, higher absenteeism, and reduced safety awareness. Contributing factors may include workload, environment, or management practices.`,
      recommendation: 'Conduct team check-ins and review working conditions',
      severity: morale < 40 ? 'danger' : 'warning',
    });
  } else if (morale >= 80) {
    insights.push({
      icon: '🎉',
      title: 'Excellent Workforce Morale',
      body: `Morale score of ${Math.round(morale)}/100 indicates a positive and engaged workforce. High morale is strongly associated with proactive safety behavior and fewer incident reports.`,
      recommendation: 'Recognize and reinforce current positive practices',
      severity: 'info',
    });
  }

  // Overall risk summary
  const riskScore = computeRiskScore(values);
  if (riskScore >= 0.3) {
    insights.push({
      icon: '🚨',
      title: 'High Overall Risk Score',
      body: `Combined risk score of ${riskScore.toFixed(3)} exceeds the 0.3 safety threshold. Multiple environmental factors are contributing to elevated risk. Immediate review of workplace conditions is recommended before the next shift.`,
      recommendation: 'Review all flagged metrics and implement corrective actions',
      severity: 'danger',
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function InsightsPage({ finalValues, onViewSolana }: InsightsPageProps) {
  const insights = useMemo(() => generateInsights(finalValues), [finalValues]);
  const riskScore = computeRiskScore(finalValues);
  const isSafe = riskScore < 0.3;

  return (
    <div className="insights-page">
      <div className="hex-bg" />

      <div className="insights-content">
        <h2 className="insights-heading">AI Insights</h2>
        <p className="insights-subtitle">
          Session analysis based on sensor readings
        </p>

        <div className="insights-summary-row">
          <div className={`insights-score-badge ${isSafe ? 'safe' : 'danger'}`}>
            <span className="score-label">Risk Score</span>
            <span className="score-value">{riskScore.toFixed(3)}</span>
          </div>
          <div className="insights-metric-pills">
            {METRICS.map((m, i) => {
              const status = getStatus(finalValues[i], m);
              return (
                <span key={m.label} className="metric-pill" style={{ borderColor: status.color }}>
                  {m.label}: <strong>{m.decimals ? finalValues[i].toFixed(m.decimals) : Math.round(finalValues[i])}{m.unit}</strong>
                </span>
              );
            })}
          </div>
        </div>

        <div className="insights-cards">
          {insights.map((insight, i) => (
            <div className={`insight-card ${insight.severity}`} key={i}>
              <div className="insight-card-inner">
                <div className="insight-header">
                  <span className="insight-icon">{insight.icon}</span>
                  <h3 className="insight-title">{insight.title}</h3>
                </div>
                <p className="insight-body">{insight.body}</p>
                <span className="insight-rec">{insight.recommendation} &rarr;</span>
              </div>
            </div>
          ))}
        </div>

        <button className="view-solana-btn" onClick={onViewSolana}>
          View Solana Results
        </button>
      </div>
    </div>
  );
}
