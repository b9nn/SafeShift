import { useState, useRef } from 'react'
import './App.css'
import SplashPage from './components/SplashPage'
import WalletPage from './components/WalletPage'
import CompanyThresholds from './components/CompanyThresholds'
import LiveFeed from './components/LiveFeed'
import InsightsPage from './components/InsightsPage'
import SolanaResults from './components/SolanaResults'
import { SolanaProvider } from './context/SolanaContext'

type AppView = 'splash' | 'wallet' | 'thresholds' | 'monitoring' | 'insights' | 'solana-results';

const AppContent = () => {
  const [view, setView] = useState<AppView>('splash');
  const finalValuesRef = useRef<number[]>([75, 24, 45, 1013, 42]);

  return (
    <>
      {/* Persistent SafeShift brand in top-right — shown from frame 2 onwards */}
      {view !== 'splash' && (
        <h1 className="app-brand">SafeShift</h1>
      )}

      {view === 'splash' && (
        <SplashPage onAccessWallet={() => setView('wallet')} />
      )}
      {view === 'wallet' && (
        <WalletPage onContinue={() => setView('thresholds')} />
      )}
      {view === 'thresholds' && (
        <CompanyThresholds onStart={() => setView('monitoring')} />
      )}
      {view === 'monitoring' && (
        <LiveFeed onEndSession={(vals) => { finalValuesRef.current = vals; setView('insights'); }} />
      )}
      {view === 'insights' && (
        <InsightsPage
          finalValues={finalValuesRef.current}
          onViewSolana={() => setView('solana-results')}
        />
      )}
      {view === 'solana-results' && (
        <SolanaResults finalValues={finalValuesRef.current} />
      )}
    </>
  );
};

function App() {
  return (
    <SolanaProvider>
      <AppContent />
    </SolanaProvider>
  );
}

export default App
