# 🏭 SafeShift

**Incentivized Factory Safety Monitoring Platform**

A hackathon project that monitors factory working conditions and automatically rewards safe operations using Solana blockchain.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:3000`

## 🏗️ Architecture

### Pure TypeScript/JavaScript (No Rust Required!)

This project uses **100% TypeScript/JavaScript** - no Rust needed!

- **Frontend**: React + TypeScript + Vite
- **Solana Integration**: `@solana/web3.js` + `@solana/spl-token`
- **Smart Contracts**: Uses existing Solana programs (System Program, Token Program)
- **No Rust**: Everything is client-side TypeScript

### Key Features

1. **Safety Monitoring Dashboard**
   - Real-time environmental metrics (temperature, humidity, air quality, noise, lighting)
   - Safety score calculation (0-100)
   - Multi-factory support

2. **Automated Reward System**
   - SOL transfers to factories/workers when safety score ≥ 80
   - Reward amount scales with safety score
   - On-chain compliance record storage

3. **Wallet Integration**
   - Connect wallet (demo mode with local storage)
   - View balance and transaction history
   - Send rewards directly from the dashboard

## 📁 Project Structure

```
SafeShift/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── SafetyMonitor.tsx # Safety metrics display
│   │   ├── RewardPanel.tsx  # Reward management
│   │   └── WalletConnection.tsx # Wallet UI
│   ├── services/
│   │   └── solanaRewardService.ts # Solana reward logic
│   ├── context/
│   │   └── SolanaContext.tsx # Solana state management
│   └── App.tsx              # Main app component
├── scripts/                 # Node.js utility scripts
├── config/                  # Configuration files
└── docs/                    # Documentation
```

## 🔧 Configuration

### Environment Variables (Optional)

Create a `.env` file:

```env
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Wallet Setup

The app uses a demo wallet stored in localStorage. For production, integrate with:
- Phantom Wallet
- Solflare
- Other Solana wallet adapters

## 💡 How It Works

1. **Safety Monitoring**: Sensors collect environmental data
2. **ML Scoring**: Calculate safety score (0-100) based on thresholds
3. **Reward Trigger**: When score ≥ 80, factory qualifies for reward
4. **Blockchain Payment**: Send SOL reward via Solana transaction
5. **Compliance Record**: Store compliance hash on-chain for transparency

## 🎯 Hackathon Features

- ✅ Pure TypeScript/JavaScript (no Rust)
- ✅ Real-time safety monitoring dashboard
- ✅ Automated Solana reward system
- ✅ Multi-factory support
- ✅ On-chain compliance records
- ✅ Beautiful, modern UI

## 📚 Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run verify-wallet # Verify Solana wallet connection
npm run check-networks # Check wallet across networks
```

## 🔗 Resources

- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Solana Cookbook](https://solanacookbook.com/)
- See `README-SOLANA.md` for Solana setup details
- See `docs/` for project context and ideas

## 🚧 Future Enhancements

- [ ] Integrate real sensor data (Arduino/ESP32)
- [ ] ML model for anomaly detection
- [ ] Phantom wallet integration
- [ ] Custom Solana program (Rust) for advanced features
- [ ] Token-based rewards (SPL tokens)
- [ ] Multi-signature wallet for fund management

## 📝 License

ISC

---

Built for hackathon - demonstrating Solana integration without Rust! 🚀
