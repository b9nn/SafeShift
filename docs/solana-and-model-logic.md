# Solana and ML Model Integration Logic

## Overview

This document explains how SafeShift integrates sensor data, ML model predictions, and Solana blockchain rewards to create an automated incentive system for factory safety.

## System Flow

```
Arduino Sensors → Backend Server → ML Model API → Risk Assessment → Solana Rewards
     (1s)              (HTTP)          (Python)        (< 0.3)         (Blockchain)
```

## Step-by-Step Process

### 1. Sensor Data Collection (Arduino → Server)

**Frequency:** Every second (1 Hz)

**Data Format:**
```json
{
  "deviceId": "device-001",
  "companyId": "company-001", 
  "timestamp": 1234567890,
  "metrics": {
    "temperature": 72.5,    // °F
    "humidity": 45.0,        // %RH
    "airQuality": 850,       // ppm CO2
    "noise": 75,             // dBA
    "lighting": 350,         // lux
    "pressure": 101.3        // kPa (optional)
  }
}
```

**Endpoint:** `POST /api/sensor-data`

**Processing:**
- Validates required fields
- Stores latest sensor readings per device
- Prepares data for ML model query

---

### 2. ML Model Query (Server → ML API)

**Current Implementation:** Fake/hardcoded model (simulates risk scoring)

**Future Implementation:** HTTP request to teammate's ML API

```javascript
// Current (fake)
const modelResponse = await queryMLModel(sensorData);
// Returns: { riskScore: 0.2345, confidence: 0.9297 }

// Future (real)
const response = await fetch('http://ml-api:8000/predict', {
  method: 'POST',
  body: JSON.stringify(sensorData),
});
const modelResponse = await response.json();
```

**Model Output:**
- `riskScore`: Float 0.0 to 1.0 (lower = safer)
- `confidence`: Float 0.0 to 1.0 (model confidence)

**Risk Score Interpretation:**
- `< 0.3` = **Safe** → Qualifies for reward
- `>= 0.3` = **Unsafe** → No reward

---

### 3. Risk Assessment & Reward Decision

**Decision Logic:**
```javascript
const riskScore = parseFloat(modelResponse.riskScore);
const isSafe = riskScore < 0.3; // Threshold

if (isSafe) {
  // Check cooldown (prevent spam)
  const timeSinceLastReward = Date.now() - company.lastRewardAt;
  if (timeSinceLastReward > 3600000) { // 1 hour
    // Calculate reward amount
    const rewardAmount = 0.1 + (0.3 - riskScore) * 0.1;
    // Range: 0.1 to 0.2 SOL
  }
}
```

**Reward Calculation:**
- Base reward: 0.1 SOL
- Bonus: (0.3 - riskScore) × 0.1 SOL
- Maximum: 0.2 SOL
- Minimum: 0.1 SOL

**Example:**
- Risk score 0.15 → Reward: 0.1 + (0.3 - 0.15) × 0.1 = **0.115 SOL**
- Risk score 0.25 → Reward: 0.1 + (0.3 - 0.25) × 0.1 = **0.105 SOL**
- Risk score 0.05 → Reward: 0.1 + (0.3 - 0.05) × 0.1 = **0.125 SOL**

---

### 4. Solana Reward Distribution

**Transaction Flow:**
```javascript
// 1. Create transfer instruction
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: mainWallet.publicKey,
    toPubkey: companyWalletAddress,
    lamports: rewardAmount * LAMPORTS_PER_SOL,
  })
);

// 2. Sign and send
const signature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [mainWallet]
);

// 3. Record transaction
rewardHistory.push({
  companyId,
  transactionSignature: signature,
  rewardAmount,
  timestamp: Date.now(),
});
```

**Blockchain Benefits:**
- **Transparent:** All rewards visible on Solana Explorer
- **Immutable:** Cannot be altered or deleted
- **Verifiable:** Anyone can verify reward transactions
- **Fast:** ~400ms confirmation time
- **Low Cost:** ~$0.00025 per transaction

---

### 5. Cooldown Mechanism

**Purpose:** Prevent reward spam and ensure sustainable incentives

**Rules:**
- Minimum 1 hour between rewards per company
- Prevents gaming the system with temporary fixes
- Encourages sustained safety compliance

**Implementation:**
```javascript
const timeSinceLastReward = Date.now() - company.lastRewardAt;
if (timeSinceLastReward < 3600000) { // 1 hour in milliseconds
  // Skip reward, already rewarded recently
}
```

---

## Data Flow Diagram

```
┌─────────────┐
│   Arduino   │  Reads sensors every 1 second
│   Device    │  Temperature, Humidity, Air Quality, etc.
└──────┬──────┘
       │ HTTP POST
       ▼
┌─────────────┐
│   Server    │  Receives sensor data
│  (Node.js)  │  Validates and stores
└──────┬──────┘
       │ Query ML Model
       ▼
┌─────────────┐
│  ML Model   │  Returns risk score (0.0 - 1.0)
│    API      │  Lower = safer
└──────┬──────┘
       │ Risk Score
       ▼
┌─────────────┐
│  Decision   │  Is riskScore < 0.3?
│   Logic     │  Check cooldown period
└──────┬──────┘
       │ Yes + Cooldown OK
       ▼
┌─────────────┐
│   Solana    │  Send SOL reward
│ Blockchain  │  Record transaction
└─────────────┘
```

## Key Components

### 1. Main Wallet (Reward Sender)
- **Address:** `376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF`
- **Network:** Devnet
- **Balance:** 5 SOL (for testing)
- **Purpose:** Sends rewards to company wallets

### 2. Company Wallets (Reward Recipients)
- Each company registers with their Solana wallet address
- Receives SOL rewards when safety conditions are met
- All transactions are transparent and verifiable

### 3. ML Model Integration
- **Current:** Fake model with simple scoring logic
- **Future:** HTTP API call to teammate's ML service
- **Input:** Sensor metrics (temperature, humidity, etc.)
- **Output:** Risk score (0.0 - 1.0) and confidence

### 4. Reward Threshold
- **Safe Threshold:** Risk score < 0.3
- **Reward Range:** 0.1 - 0.2 SOL
- **Cooldown:** 1 hour minimum between rewards

## Security Considerations

1. **API Authentication:** Add API keys for Arduino devices
2. **Rate Limiting:** Prevent spam requests
3. **Wallet Security:** Main wallet private key stored securely
4. **Transaction Validation:** Verify all Solana transactions
5. **Data Validation:** Validate all sensor inputs

## Future Enhancements

1. **Real ML Model:** Replace fake model with actual ML API
2. **Database:** Replace in-memory storage with PostgreSQL/MongoDB
3. **WebSocket:** Real-time updates to frontend
4. **Analytics:** Track reward patterns and safety trends
5. **Multi-signature:** Require multiple approvals for large rewards
6. **Streaming Payments:** Continuous reward streams instead of one-time payments

## Testing

**Test Sensor Data:**
```bash
curl -X POST http://localhost:3001/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device-001",
    "companyId": "company-001",
    "metrics": {
      "temperature": 72,
      "humidity": 45,
      "airQuality": 850,
      "noise": 75,
      "lighting": 350
    }
  }'
```

**Check Health:**
```bash
curl http://localhost:3001/api/health
```

## Summary

The system creates a **closed-loop incentive mechanism**:
1. Sensors measure conditions → 2. ML model assesses risk → 3. Safe conditions trigger → 4. Automatic Solana rewards

This incentivizes companies to maintain safe working conditions through **transparent, automated, blockchain-backed rewards**.
