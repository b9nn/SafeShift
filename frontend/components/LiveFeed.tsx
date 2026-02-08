import { useState, useEffect, useRef } from 'react';
import './LiveFeed.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MetricConfig {
  label: string;
  unit: string;
  min: number;
  max: number;
  thresholdLow: number;
  thresholdHigh: number;
  decimals?: number;
}

const METRICS: MetricConfig[] = [
  { label: 'Morale Score', unit: '/100', min: 0, max: 100, thresholdLow: 60, thresholdHigh: 100 },
  { label: 'Temperature', unit: '°C', min: 10, max: 50, thresholdLow: 18, thresholdHigh: 30, decimals: 1 },
  { label: 'Magnetic Field', unit: 'μT', min: 0, max: 150, thresholdLow: 0, thresholdHigh: 80 },
  { label: 'Pressure', unit: 'hPa', min: 950, max: 1080, thresholdLow: 990, thresholdHigh: 1030 },
  { label: 'Noise Score', unit: '/100', min: 0, max: 100, thresholdLow: 50, thresholdHigh: 100 },
];

function randomInRange(min: number, max: number, decimals = 0): number {
  const val = Math.random() * (max - min) + min;
  return decimals > 0 ? parseFloat(val.toFixed(decimals)) : Math.round(val);
}

function getStatus(value: number, config: MetricConfig): { text: string; color: string } {
  // For noise: lower is better (inverted)
  if (config.label === 'Noise Score') {
    if (value <= 60) return { text: 'Quiet', color: '#2ecc71' };
    if (value <= 75) return { text: 'Elevated', color: '#e8a825' };
    return { text: 'Loud', color: '#e74c3c' };
  }
  // For morale: higher is better
  if (config.label === 'Morale Score') {
    if (value >= 80) return { text: 'Excellent', color: '#2ecc71' };
    if (value >= 60) return { text: 'Good', color: '#2ecc71' };
    if (value >= 40) return { text: 'Fair', color: '#e8a825' };
    return { text: 'Low', color: '#e74c3c' };
  }
  // For temperature
  if (config.label === 'Temperature') {
    if (value >= 18 && value <= 28) return { text: 'Optimal', color: '#2ecc71' };
    if (value >= 14 && value <= 34) return { text: 'Acceptable', color: '#e8a825' };
    return { text: 'Extreme', color: '#e74c3c' };
  }
  // For magnetic field
  if (config.label === 'Magnetic Field') {
    if (value <= 60) return { text: 'Safe', color: '#2ecc71' };
    if (value <= 100) return { text: 'Moderate', color: '#e8a825' };
    return { text: 'High', color: '#e74c3c' };
  }
  // For pressure
  if (value >= config.thresholdLow && value <= config.thresholdHigh) return { text: 'Stable', color: '#2ecc71' };
  return { text: 'Unstable', color: '#e8a825' };
}

// ---------------------------------------------------------------------------
// Circular Gauge SVG
// ---------------------------------------------------------------------------
function CircularGauge({ value, min, max, color }: { value: number; min: number; max: number; color: string }) {
  const radius = 52;
  const stroke = 7;
  const circumference = 2 * Math.PI * radius;
  const range = max - min;
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / range;
  const dashOffset = circumference * (1 - ratio * 0.75); // 270deg arc (0.75 of full circle)
  const bgDash = circumference * 0.75;

  return (
    <svg className="gauge-svg" viewBox="0 0 120 120">
      {/* Background arc */}
      <circle
        cx="60" cy="60" r={radius}
        fill="none"
        stroke="#3a3a4e"
        strokeWidth={stroke}
        strokeDasharray={`${bgDash} ${circumference}`}
        strokeDashoffset={0}
        strokeLinecap="round"
        transform="rotate(135 60 60)"
      />
      {/* Value arc */}
      <circle
        cx="60" cy="60" r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${bgDash} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform="rotate(135 60 60)"
        style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease' }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Animated number
// ---------------------------------------------------------------------------
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const animRef = useRef<number | null>(null);
  const startRef = useRef(display);
  const startTime = useRef(0);

  useEffect(() => {
    startRef.current = display;
    startTime.current = performance.now();
    const duration = 700;

    const animate = (now: number) => {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startRef.current + (value - startRef.current) * eased;
      setDisplay(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.round(current));
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value]);

  return <>{decimals > 0 ? display.toFixed(decimals) : display}</>;
}

// ---------------------------------------------------------------------------
// Risk score calculation (mirrors server/index.js logic)
// Maps sensor values -> 0-1 risk score
// ---------------------------------------------------------------------------
function computeRiskScore(values: number[]): number {
  let risk = 0;
  const [morale, temp, mag, pressure, noise] = values;

  // Morale: lower morale = higher risk
  if (morale < 60) risk += 0.15;
  else if (morale < 75) risk += 0.05;

  // Temperature (°C): ideal 18-28
  const tempF = temp * 9 / 5 + 32; // convert to °F for backend alignment
  if (tempF < 68 || tempF > 76) risk += 0.1;
  if (tempF < 65 || tempF > 80) risk += 0.15;

  // Magnetic field: higher = more risk
  if (mag > 80) risk += 0.1;
  if (mag > 120) risk += 0.1;

  // Pressure: outside stable range
  if (pressure < 990 || pressure > 1030) risk += 0.05;

  // Noise: higher = more risk (scale 0-100 mapped roughly to dBA)
  if (noise > 70) risk += (noise - 70) / 300;
  if (noise > 85) risk += 0.1;

  return Math.max(0, Math.min(1, risk));
}

function computeReward(riskScore: number): number {
  // From server: rewardAmount = 0.1 + (0.3 - riskScore) * 0.1, clamped 0.1-0.2
  if (riskScore >= 0.3) return 0;
  const reward = 0.1 + (0.3 - riskScore) * 0.1;
  return Math.min(0.2, Math.max(0.1, reward));
}

// ---------------------------------------------------------------------------
// SOL Projections overlay
// ---------------------------------------------------------------------------
function SolProjections({ values, onClose }: { values: number[]; onClose: () => void }) {
  const riskScore = computeRiskScore(values);
  const qualifies = riskScore < 0.3;
  const rewardPerHour = computeReward(riskScore);
  const daily = rewardPerHour * 24;
  const weekly = daily * 7;
  const monthly = daily * 30;

  return (
    <div className="sol-overlay" onClick={onClose}>
      <div className="sol-modal" onClick={(e) => e.stopPropagation()}>
        <button className="sol-close" onClick={onClose}>&times;</button>

        <h3 className="sol-title">SOL Projections</h3>
        <p className="sol-subtitle">Based on current sensor readings</p>

        <div className="sol-risk-row">
          <span className="sol-risk-label">Current Risk Score</span>
          <span className={`sol-risk-value ${qualifies ? 'safe' : 'danger'}`}>
            {riskScore.toFixed(3)}
          </span>
        </div>

        <div className={`sol-status-pill ${qualifies ? 'qualifying' : 'not-qualifying'}`}>
          {qualifies ? 'Qualifying for rewards' : 'Not qualifying — risk too high'}
        </div>

        {qualifies ? (
          <div className="sol-projections-grid">
            <div className="sol-proj-card">
              <span className="sol-proj-label">Per Hour</span>
              <span className="sol-proj-value">{rewardPerHour.toFixed(4)} SOL</span>
            </div>
            <div className="sol-proj-card">
              <span className="sol-proj-label">Per Day</span>
              <span className="sol-proj-value">{daily.toFixed(3)} SOL</span>
            </div>
            <div className="sol-proj-card">
              <span className="sol-proj-label">Per Week</span>
              <span className="sol-proj-value">{weekly.toFixed(2)} SOL</span>
            </div>
            <div className="sol-proj-card highlight">
              <span className="sol-proj-label">Per Month</span>
              <span className="sol-proj-value">{monthly.toFixed(2)} SOL</span>
            </div>
          </div>
        ) : (
          <p className="sol-hint">
            Improve conditions to bring risk below 0.3 to start earning.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiveFeed component
// ---------------------------------------------------------------------------
export default function LiveFeed() {
  const [values, setValues] = useState<number[]>(
    METRICS.map((m) => randomInRange(m.min, m.max, m.decimals))
  );
  const [showProjections, setShowProjections] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setValues((prev) =>
        METRICS.map((m, i) => {
          const drift = (m.max - m.min) * 0.08;
          const next = prev[i] + (Math.random() - 0.5) * drift * 2;
          const clamped = Math.max(m.min, Math.min(m.max, next));
          return m.decimals ? parseFloat(clamped.toFixed(m.decimals)) : Math.round(clamped);
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="livefeed-page">
      <div className="hex-bg" />

      <div className="livefeed-content">
        <h2 className="livefeed-heading">Live Feed</h2>

        <div className="livefeed-grid">
          {METRICS.map((metric, i) => {
            const status = getStatus(values[i], metric);
            return (
              <div className="gauge-card" key={metric.label}>
                <span className="gauge-label">{metric.label}</span>
                <div className="gauge-wrapper">
                  <CircularGauge
                    value={values[i]}
                    min={metric.min}
                    max={metric.max}
                    color={status.color}
                  />
                  <div className="gauge-center">
                    <span className="gauge-value">
                      <AnimatedNumber value={values[i]} decimals={metric.decimals} />
                    </span>
                    <span className="gauge-unit">{metric.unit}</span>
                  </div>
                </div>
                <span className="gauge-status" style={{ color: status.color }}>
                  {status.text}
                </span>
              </div>
            );
          })}
        </div>

        <button className="sol-projections-btn" onClick={() => setShowProjections(true)}>
          SOL Projections
        </button>
      </div>

      {showProjections && (
        <SolProjections values={values} onClose={() => setShowProjections(false)} />
      )}
    </div>
  );
}
