import { useState, useEffect, useRef } from 'react';
import './CompanyThresholds.css';

interface MetricCard {
  label: string;
  unit: string;
  min: number;
  max: number;
  decimals?: number;
}

const METRICS: MetricCard[] = [
  { label: 'Morale Score', unit: '/100', min: 40, max: 98 },
  { label: 'Temperature', unit: '°C', min: 18, max: 42, decimals: 1 },
  { label: 'Magnetic Field', unit: 'μT', min: 20, max: 120 },
  { label: 'Pressure', unit: 'hPa', min: 980, max: 1050 },
  { label: 'Noise Score', unit: '/100', min: 30, max: 95 },
];

function randomInRange(min: number, max: number, decimals = 0): number {
  const val = Math.random() * (max - min) + min;
  return decimals > 0 ? parseFloat(val.toFixed(decimals)) : Math.round(val);
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const animRef = useRef<number | null>(null);
  const startRef = useRef(display);
  const startTime = useRef(0);
  const duration = 600; // ms

  useEffect(() => {
    startRef.current = display;
    startTime.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startRef.current + (value - startRef.current) * eased;
      setDisplay(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.round(current));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value]);

  return <span>{decimals > 0 ? display.toFixed(decimals) : display}</span>;
}

export default function CompanyThresholds() {
  const [values, setValues] = useState<number[]>(
    METRICS.map((m) => randomInRange(m.min, m.max, m.decimals))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setValues(METRICS.map((m) => randomInRange(m.min, m.max, m.decimals)));
    }, 3000); // update every 3 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="thresholds-page">
      <div className="hex-bg" />

      <h1 className="thresholds-brand">SafeShift</h1>

      <div className="thresholds-content">
        <h2 className="thresholds-heading">Company Thresholds</h2>

        <div className="thresholds-grid">
          {METRICS.map((metric, i) => (
            <div className="metric-card" key={metric.label}>
              <span className="metric-label">{metric.label}</span>
              <span className="metric-value">
                <AnimatedNumber value={values[i]} decimals={metric.decimals} />
              </span>
              <span className="metric-unit">{metric.unit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
