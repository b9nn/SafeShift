import { useState } from 'react'
import './App.css'
import SplashPage from './components/SplashPage'
import WalletPage from './components/WalletPage'
import CompanyThresholds from './components/CompanyThresholds'
import { SolanaProvider } from './context/SolanaContext'

type AppView = 'splash' | 'wallet' | 'thresholds';

const AppContent = () => {
  const [view, setView] = useState<AppView>('splash');

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
        <CompanyThresholds />
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
