import { useState, useEffect } from 'react';
import './SplashPage.css';
import solanaLogo from '../assets/solana-logo.png';
import snowflakeLogo from '../assets/snowflake-logo.png';
import solanaIcon from '../assets/solana-icon.png';

interface SplashPageProps {
  onAccessWallet?: () => void;
}

type PageState = 'splash' | 'transitioning' | 'wallet';

export default function SplashPage({ onAccessWallet }: SplashPageProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageState, setPageState] = useState<PageState>('splash');

  useEffect(() => {
    if (pageState !== 'splash') return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % 2);
    }, 3000);
    return () => clearInterval(interval);
  }, [pageState]);

  const handleGetStarted = () => {
    setPageState('transitioning');
    // After the CSS transition finishes, switch to wallet state
    setTimeout(() => setPageState('wallet'), 900);
  };

  return (
    <div className="splash-page">
      {/* Hexagonal background pattern */}
      <div className="hex-bg" />

      {/* SafeShift title - animates from center to top-right */}
      <h1 className={`splash-title ${pageState !== 'splash' ? 'title-corner' : ''}`}>
        SafeShift
      </h1>

      {/* Splash center content - fades out on transition */}
      <div className={`splash-center ${pageState !== 'splash' ? 'fade-out' : ''}`}>
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

      {/* Get Started button - only on splash */}
      {pageState === 'splash' && (
        <button className="enter-btn" onClick={handleGetStarted}>
          Get Started
        </button>
      )}

      {/* Wallet content - fades in after transition */}
      <div className={`wallet-content ${pageState === 'wallet' ? 'visible' : ''}`}>
        {/* Solana icon */}
        <div className="solana-icon-wrapper">
          <img src={solanaIcon} alt="Solana" className="solana-icon" />
        </div>

        <button className="access-wallet-btn" onClick={onAccessWallet}>
          Access Wallet
        </button>
      </div>
    </div>
  );
}
