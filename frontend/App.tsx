import { useState } from 'react'
import './App.css'
import SplashPage from './components/SplashPage'
import Dashboard from './components/Dashboard'
import CompanyRegistration from './components/CompanyRegistration'
import CompanyList from './components/CompanyList'
import MainWalletStatus from './components/MainWalletStatus'
import { SolanaProvider, useSolana } from './context/SolanaContext'
import { Company } from './types/company'

type AppView = 'splash' | 'dashboard';

const AppContent = () => {
  const { isConnected } = useSolana();
  const [view, setView] = useState<AppView>('splash');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);

  const handleCompanyRegistered = (company: Company) => {
    setSelectedCompany(company);
    setShowRegistration(false);
  };

  if (view === 'splash') {
    return <SplashPage onAccessWallet={() => setView('dashboard')} />;
  }

  if (!isConnected) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>SafeShift</h1>
          <p>Incentivized Factory Safety Monitoring</p>
        </header>
        <main>
          <div className="loading-state">
            <p>Loading main wallet...</p>
            <p className="hint">Please check config/wallet.json is configured correctly</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>SafeShift</h1>
        <p>Incentivized Factory Safety Monitoring - Reward Game</p>
      </header>
      <main>
        <MainWalletStatus />
        
        <div className="main-content">
          <div className="sidebar">
            <div className="sidebar-header">
              <h2>Companies</h2>
              <button 
                onClick={() => setShowRegistration(!showRegistration)}
                className="add-company-btn"
              >
                {showRegistration ? 'Cancel' : '+ Add Company'}
              </button>
            </div>
            
            {showRegistration ? (
              <CompanyRegistration onCompanyRegistered={handleCompanyRegistered} />
            ) : (
              <CompanyList 
                onSelectCompany={setSelectedCompany}
                selectedCompanyId={selectedCompany?.id}
              />
            )}
          </div>

          <div className="content-area">
            <Dashboard selectedCompany={selectedCompany} />
          </div>
          </div>
        </main>
    </div>
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
