# SafeShift

**Incentivized Factory Safety Monitoring Platform**

A hackathon project that monitors factory working conditions and automatically rewards safe operations using Solana blockchain.

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Python 3.11+ (for ML model)

### Installation

```bash
# Install frontend + server dependencies
npm install

# Install ML dependencies
pip install -r requirements.txt

# Start development server
npm run dev
```

The app will open at `http://localhost:3000`

## Architecture

```
Arduino --> Express Server --> ML API --> Risk Score --> Solana Reward
               |                  |             |
           Snowflake          Snowflake      Snowflake
        (raw readings)    (compliance scores) (reward txns)
```

### Components

- **Hardware**: Arduino Nano 33 BLE Sense (temperature, humidity, pressure, proximity, vibration, noise)
- **ML Model**: LSTM Autoencoder for anomaly detection + risk scoring (Python/PyTorch)
- **ML API**: FastAPI bridge wrapping trained model (`src/api.py`)
- **Backend**: Express server receiving sensor data, querying ML, distributing rewards (`server/index.js`)
- **Frontend**: React + TypeScript + Vite dashboard
- **Blockchain**: Solana devnet for automated reward payouts
- **Data Warehouse**: Snowflake (6 schemas, 30+ features) for analytics, compliance scoring, and governance

### Key Features

1. **Safety Monitoring Dashboard**
   - Real-time environmental metrics (temperature, humidity, air quality, noise, lighting)
   - Safety score calculation (0-100)
   - Multi-factory support

2. **ML-Powered Risk Detection**
   - LSTM autoencoder trained on ~57k rows of environmental data
   - Anomaly detection + OSHA threshold violation scoring
   - Risk index: 0-100 (Safe / Caution / Warning / Critical)

3. **Automated Reward System**
   - SOL transfers to factories when risk score < 0.3
   - Reward amount scales with safety score (0.1-0.2 SOL)
   - On-chain compliance record storage

4. **Snowflake Data Warehouse**
   - Automated ETL pipeline (Streams + Tasks DAG)
   - Cortex ML anomaly detection + forecasting
   - Cortex LLM-powered compliance reports
   - RBAC, data masking, row access policies
   - Secure data sharing for regulators/NGOs

5. **Wallet Integration**
   - Connect wallet (demo mode with local storage)
   - View balance and transaction history
   - Send rewards directly from the dashboard

## Project Structure

```
SafeShift/
├── src/                        # ML model + React frontend
│   ├── model.py               # LSTM Autoencoder
│   ├── preprocess.py          # Data preprocessing pipeline
│   ├── train.py               # Model training
│   ├── api.py                 # FastAPI ML bridge
│   ├── nlp.py                 # NLP verbal abuse detection
│   ├── components/            # React components
│   ├── services/              # Solana reward services
│   └── context/               # React context
├── server/                     # Express backend
│   └── index.js               # API server + reward distribution
├── snowflake/                  # Snowflake data warehouse
│   ├── 00-08_*.sql            # Individual setup scripts
│   ├── 09_test_validation.sql # Validation tests
│   └── RUN_ALL.sql            # Single deployment script
├── models/                     # Trained ML artifacts
├── config/                     # Safety thresholds + wallet config
├── data/                       # Training datasets
├── docs/                       # Documentation
├── ProximitySensor/            # Arduino proximity sensor
├── ReadPressure/               # Arduino pressure sensor
└── ArduinoToJson/              # Arduino JSON output
```

## Scripts

```bash
npm run dev          # Start frontend dev server
npm run build        # Build for production
npm run server       # Start Express backend
npm run dev:all      # Start frontend + backend concurrently

python -m src.api    # Start ML API (port 8000)
python -m src.train  # Train ML model
```

## Resources

- See `docs/context.md` for full project context
- See `docs/models.md` for ML model architecture
- See `docs/solana-and-model-logic.md` for Solana integration
- See `snowflake/RUN_ALL.sql` for complete database deployment

## License

ISC
