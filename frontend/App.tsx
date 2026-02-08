import { useState } from 'react'
import './App.css'
import SplashPage from './components/SplashPage'
import WalletPage from './components/WalletPage'
import CompanyThresholds from './components/CompanyThresholds'
import { SolanaProvider } from './context/SolanaContext'

type AppView = 'splash' | 'wallet' | 'thresholds';

const AppContent = () => {
  const [view, setView] = useState<AppView>('splash');

  if (view === 'splash') {
    return <SplashPage onAccessWallet={() => setView('wallet')} />;
  }

  if (view === 'wallet') {
    return <WalletPage onContinue={() => setView('thresholds')} />;
  }

  return <CompanyThresholds />;
};

function App() {
  return (
    <SolanaProvider>
      <AppContent />
    </SolanaProvider>
  );
}

export default App
