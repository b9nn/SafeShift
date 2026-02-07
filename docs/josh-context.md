# SafeShift - Complete Implementation Context

## Overview

SafeShift is a hackathon project that monitors factory working conditions using Arduino sensors, ML models for risk assessment, and Solana blockchain for automated reward distribution. This document explains the complete logic and implementation details.

---

## System Architecture

```
Arduino Sensors → Backend Server → ML Model API → Risk Assessment → Solana Rewards
   (1 second)        (Express)      (Python/API)     (< 0.3)        (Blockchain)
```

### Components

1. **Arduino Devices**: Collect sensor data (temperature, humidity, air quality, noise, lighting)
2. **Backend Server**: Receives data, queries ML model, manages rewards
3. **ML Model**: Assesses risk from sensor data (returns 0.0-1.0 score)
4. **Solana Blockchain**: Distributes SOL rewards automatically when conditions are safe

---

## ML Model Integration

### Current Implementation (Fake/Hardcoded)

The server currently uses a **simulated ML model** that calculates risk scores based on safety thresholds:

```javascript
// server/index.js - queryMLModel()
async function queryMLModel(sensorData) {
  const { temperature, humidity, airQuality, noise, lighting } = sensorData;
  let riskScore = 0;
  
  // Temperature risk (ideal: 68-76°F)
  if (temperature < 68 || temperature > 76) riskScore += 0.1;
  if (temperature < 65 || temperature > 80) riskScore += 0.15;
  
  // Humidity risk (ideal: 20-60%)
  if (humidity < 20 || humidity > 60) riskScore += 0.1;
  
  // Air quality risk (ideal: < 1000 ppm CO2)
  if (airQuality > 1000) riskScore += (airQuality - 1000) / 10000;
  
  // Noise risk (ideal: < 85 dBA)
  if (noise > 85) riskScore += (noise - 85) / 500;
  
  // Lighting risk (ideal: > 300 lux)
  if (lighting < 300) riskScore += (300 - lighting) / 3000;
  
  // Add randomness to simulate model uncertainty
  riskScore += (Math.random() - 0.5) * 0.05;
  riskScore = Math.max(0, Math.min(1, riskScore));
  
  return {
    riskScore: riskScore.toFixed(4),
    confidence: (1 - riskScore * 0.3).toFixed(4),
    timestamp: Date.now(),
  };
}
```

### Real ML Model Integration (READY)

The ML API is built and ready at `src/api.py`. To connect:

**1. Start the ML API (separate terminal):**
```bash
pip install -r requirements.txt
python -m src.api
# Runs on http://localhost:8000
```

**2. Replace `queryMLModel()` in `server/index.js`:**
```javascript
async function queryMLModel(sensorData) {
  const response = await fetch('http://localhost:8000/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sensorData),
  });

  if (!response.ok) {
    throw new Error(`ML API error: ${response.statusText}`);
  }

  return await response.json();
  // Returns: { riskScore: "0.2345", confidence: "0.9297", timestamp: 1234567890 }
}
```

**Health check:** `GET http://localhost:8000/health`

The ML API accepts the same sensor fields the server already sends (temperature, humidity, airQuality, noise, lighting, pressure). No changes needed to the request format.

### Risk Score Interpretation

- **Risk Score Range**: 0.0 to 1.0
- **Safe Threshold**: `< 0.3` → Qualifies for reward
- **Unsafe Threshold**: `>= 0.3` → No reward

**Examples:**
- Risk score `0.15` → Very safe → Reward sent
- Risk score `0.25` → Safe → Reward sent
- Risk score `0.35` → Unsafe → No reward
- Risk score `0.75` → Very unsafe → No reward

---

## Solana Integration

### Main Wallet Configuration

**Location**: `config/wallet.js` (or `config/wallet.ts` for frontend)

```javascript
module.exports = {
  privateKey: [252,253,41,114,...], // 64-byte array
  address: "376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF",
  network: "devnet",
};
```

**Security**: 
- File is in `.gitignore` (never committed)
- Private key stays on server (never exposed to frontend)
- Main wallet sends all rewards to company wallets

### Reward Distribution Logic

**Flow:**
1. Sensor data received → ML model queried
2. Risk score calculated → Check if `< 0.3`
3. If safe → Check cooldown (1 hour minimum)
4. Calculate reward amount → 0.1 to 0.2 SOL
5. Send Solana transaction → Transfer SOL
6. Record transaction → Store in history

**Reward Calculation:**
```javascript
// Base reward: 0.1 SOL
// Bonus: (0.3 - riskScore) × 0.1 SOL
// Range: 0.1 to 0.2 SOL

const rewardAmount = 0.1 + (0.3 - riskScore) * 0.1;
const clampedReward = Math.min(0.2, Math.max(0.1, rewardAmount));
```

**Examples:**
- Risk score `0.10` → Reward: 0.1 + (0.3 - 0.10) × 0.1 = **0.12 SOL**
- Risk score `0.20` → Reward: 0.1 + (0.3 - 0.20) × 0.1 = **0.11 SOL**
- Risk score `0.05` → Reward: 0.1 + (0.3 - 0.05) × 0.1 = **0.125 SOL**

### Solana Transaction Implementation

**Location**: `server/index.js` - `sendSOLReward()`

```javascript
async function sendSOLReward(recipientAddress, amountSOL) {
  const { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } = require('@solana/web3.js');
  
  const recipientPubkey = new PublicKey(recipientAddress);
  const amountLamports = amountSOL * LAMPORTS_PER_SOL; // Convert SOL to lamports
  
  // Create transfer transaction
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: mainWallet.publicKey,
      toPubkey: recipientPubkey,
      lamports: amountLamports,
    })
  );
  
  // Sign and send
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [mainWallet] // Signer
  );
  
  return signature; // Transaction signature for verification
}
```

**Transaction Details:**
- **Network**: Devnet (for testing)
- **Fee**: ~0.000005 SOL per transaction
- **Confirmation**: ~400ms average
- **Verification**: All transactions visible on Solana Explorer

### Cooldown Mechanism

**Purpose**: Prevent reward spam and ensure sustainable incentives

**Implementation:**
```javascript
const timeSinceLastReward = Date.now() - company.lastRewardAt;
if (timeSinceLastReward < 3600000) { // 1 hour in milliseconds
  // Skip reward - already rewarded recently
  return { sent: false, reason: 'Already rewarded recently' };
}
```

**Rules:**
- Minimum 1 hour between rewards per company
- Prevents gaming the system with temporary fixes
- Encourages sustained safety compliance

---

## API Endpoints

### POST /api/sensor-data

**Purpose**: Receive sensor data from Arduino devices

**Request:**
```json
{
  "deviceId": "device-001",
  "companyId": "company-001",
  "timestamp": 1234567890,
  "metrics": {
    "temperature": 72.5,
    "humidity": 45.0,
    "airQuality": 850,
    "noise": 75,
    "lighting": 350,
    "pressure": 101.3
  }
}
```

**Response:**
```json
{
  "success": true,
  "deviceId": "device-001",
  "companyId": "company-001",
  "modelResponse": {
    "riskScore": "0.2345",
    "confidence": "0.9297",
    "isSafe": true
  },
  "reward": {
    "sent": true,
    "amount": 0.1655,
    "transactionSignature": "5KJvsngHeM..."
  },
  "timestamp": 1234567890
}
```

**Processing Steps:**
1. Validate required fields
2. Store latest sensor data
3. Query ML model
4. Check risk score threshold
5. If safe + cooldown OK → Send Solana reward
6. Return response with reward status

### POST /api/register-company

**Purpose**: Register a company for rewards

**Request:**
```json
{
  "companyId": "company-001",
  "name": "Factory ABC",
  "walletAddress": "376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF",
  "deviceIds": ["device-001"]
}
```

### GET /api/companies

**Purpose**: Get all registered companies

### GET /api/rewards

**Purpose**: Get reward transaction history

### GET /api/health

**Purpose**: Health check endpoint

---

## Data Flow

### Complete Flow Diagram

```
┌─────────────┐
│   Arduino   │  Reads sensors every 1 second
│   Device    │  Temperature, Humidity, Air Quality, Noise, Lighting
└──────┬──────┘
       │ HTTP POST /api/sensor-data
       ▼
┌─────────────┐
│   Server    │  Express.js backend
│  (Node.js)  │  Validates data, stores latest readings
└──────┬──────┘
       │ Query ML Model
       ▼
┌─────────────┐
│  ML Model   │  Returns risk score (0.0 - 1.0)
│    API      │  Lower score = safer conditions
└──────┬──────┘
       │ Risk Score
       ▼
┌─────────────┐
│  Decision   │  Is riskScore < 0.3?
│   Logic     │  Check cooldown (1 hour)
│             │  Calculate reward amount
└──────┬──────┘
       │ Yes + Cooldown OK
       ▼
┌─────────────┐
│   Solana    │  Create transfer transaction
│ Blockchain  │  Sign with main wallet
│             │  Send SOL to company wallet
│             │  Record transaction signature
└─────────────┘
```

### Step-by-Step Process

1. **Sensor Data Collection** (Arduino)
   - Reads sensors every 1 second
   - Formats data as JSON
   - POSTs to `/api/sensor-data`

2. **Server Receives Data** (Express)
   - Validates required fields
   - Stores latest sensor readings per device
   - Prepares data for ML model

3. **ML Model Query** (Python/API)
   - Receives sensor metrics
   - Returns risk score (0.0-1.0) and confidence
   - Lower score = safer conditions

4. **Risk Assessment** (Server)
   - Check if riskScore < 0.3 (safe threshold)
   - If safe → Check cooldown period
   - Calculate reward amount based on risk score

5. **Solana Reward** (Blockchain)
   - Create transfer transaction
   - Sign with main wallet
   - Send SOL to company wallet
   - Get transaction signature

6. **Record Transaction** (Server)
   - Store in reward history
   - Update company reward totals
   - Log transaction for audit

---

## Safety Thresholds

Based on OSHA and international standards (see `config/safety_thresholds.json`):

- **Temperature**: 68-76°F (ideal), <65°F or >80°F (unsafe)
- **Humidity**: 20-60% RH (ideal)
- **Air Quality**: <1000 ppm CO2 (ideal), >5000 ppm (unsafe)
- **Noise**: <85 dBA (ideal), >90 dBA (unsafe)
- **Lighting**: >300 lux (ideal), <110 lux (unsafe)

These thresholds are used in the fake ML model and should align with your real ML model's training data.

---

## Company Registration

Companies register via frontend or API with:
- **Company ID**: Unique identifier
- **Name**: Company name
- **Wallet Address**: Solana wallet for receiving rewards
- **Device IDs**: List of sensor devices

**Storage**: Currently in-memory (Map). Replace with database in production.

---

## Reward System Details

### Reward Amounts

- **Minimum**: 0.1 SOL
- **Maximum**: 0.2 SOL
- **Calculation**: `0.1 + (0.3 - riskScore) × 0.1`

### Reward Conditions

1. **Risk Score**: Must be < 0.3
2. **Cooldown**: Must be > 1 hour since last reward
3. **Company Registered**: Company must exist in registry
4. **Wallet Valid**: Company wallet address must be valid Solana address

### Transaction Verification

All transactions are:
- **Transparent**: Visible on Solana Explorer
- **Immutable**: Cannot be altered
- **Verifiable**: Anyone can verify transactions
- **Fast**: ~400ms confirmation
- **Low Cost**: ~$0.00025 per transaction

**Explorer URL Format:**
```
https://explorer.solana.com/tx/{transactionSignature}?cluster=devnet
```

---

## Frontend Integration

The React frontend (`src/`) provides:
- Company registration UI
- Real-time safety monitoring dashboard
- Reward history display
- Main wallet status

**Connection**: Frontend can call server API endpoints or use WebSocket for real-time updates.

---

## Testing

### Test Server

```bash
npm run test-server
```

Tests:
1. Health check
2. Company registration
3. Sensor data (safe conditions)
4. Sensor data (unsafe conditions)
5. Reward history

### Manual Testing

```bash
# Start server
npm run server

# Test sensor data endpoint
curl -X POST http://localhost:3001/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test-device",
    "companyId": "test-company",
    "metrics": {
      "temperature": 72,
      "humidity": 45,
      "airQuality": 850,
      "noise": 75,
      "lighting": 350
    }
  }'
```

---

## Production Considerations

### Security
- Add API authentication for Arduino devices
- Implement rate limiting
- Secure wallet private key storage
- Validate all inputs
- Use HTTPS

### Scalability
- Replace in-memory storage with database (PostgreSQL/MongoDB)
- Add caching layer
- Implement message queue for high-frequency sensor data
- Use WebSocket for real-time updates

### Monitoring
- Add logging (Winston, Pino)
- Set up error tracking (Sentry)
- Monitor Solana transaction success rates
- Track ML model API response times

### ML Model Integration
- Replace fake model with real API
- Add retry logic for ML API failures
- Cache model responses (if appropriate)
- Monitor model performance

---

## Key Files

- **`server/index.js`**: Main server logic
- **`config/wallet.js`**: Main wallet configuration
- **`config/safety_thresholds.json`**: Safety thresholds
- **`docs/solana-and-model-logic.md`**: Detailed technical docs
- **`server/README.md`**: API documentation
- **`server/example-arduino-code.ino`**: Arduino integration example

---

## Summary

SafeShift creates a **closed-loop incentive system**:

1. **Sensors measure** factory conditions every second
2. **ML model assesses** risk from sensor data
3. **Safe conditions trigger** automatic Solana rewards
4. **Companies are incentivized** to maintain safe working conditions

The system is **transparent** (all transactions on-chain), **automated** (no manual intervention), and **verifiable** (anyone can audit rewards).

---

## Next Steps

1. **Integrate Real ML Model**: Replace fake model with teammate's API
2. **Add Database**: Replace in-memory storage
3. **Add Authentication**: Secure API endpoints
4. **Deploy Server**: Host on cloud (AWS, GCP, etc.)
5. **Connect Arduino**: Deploy sensor devices to factories
6. **Monitor & Optimize**: Track performance and adjust thresholds

---

*Last Updated: 2025-02-06*
*Branch: joshe-dev*
