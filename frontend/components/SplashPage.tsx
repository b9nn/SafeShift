import { useState, useEffect } from 'react';
import './SplashPage.css';
import solanaLogo from '../assets/solana-logo.png';
import snowflakeLogo from '../assets/snowflake-logo.png';

interface SplashPageProps {
  onEnter?: () => void;
}

export default function SplashPage({ onEnter }: SplashPageProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % 2);
    }, 3000); // swap every 3 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="splash-page">
      {/* Hexagonal background pattern */}
      <div className="hex-bg" />

      <div className="splash-content">
        <h1 className="splash-title">SafeShift</h1>

        <div className="powered-by">
          <span className="powered-text">Powered By</span>
          <div className="brand-carousel">
            <div className={`brand-slide ${activeIndex === 0 ? 'active' : 'inactive'}`}>
              <img src={solanaLogo} alt="Solana" className="brand-logo" />
            </div>
            <div className={`brand-slide ${activeIndex === 1 ? 'active' : 'inactive'}`}>
              <img src={snowflakeLogo} alt="Snowflake" className="brand-logo" />
            </div>
          </div>
        </div>
      </div>

      {onEnter && (
        <button className="enter-btn" onClick={onEnter}>
          Get Started
        </button>
      )}
    </div>
  );
}
