# Solana Workflow - Complete Summary

## 🎯 Overview

SafeShift uses **Solana blockchain** to automatically distribute SOL rewards to companies when their factory conditions are safe. The entire process is automated, transparent, and verifiable on-chain.

---

## 🔄 Complete Workflow (Step-by-Step)

### **Step 1: Setup & Configuration**

**Main Wallet Setup:**
- Main wallet configured in `config/wallet.js`
- Wallet address: `376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF`
- Network: **Devnet** (for testing)
- Balance: 5 SOL (for sending rewards)
- Private key stored securely (in `.gitignore`)

**Server Initialization:**
```javascript
// server/index.js
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const mainWallet = Keypair.fromSecretKey(Uint8Array.from(walletConfig.privateKey));
```

---

### **Step 2: Company Registration**

**Companies Register with Wallet:**
- Company provides: name, companyId, **Solana wallet address**
- Wallet address is where they'll receive rewards
- Stored in system: `companies.set(companyId, { walletAddress, ... })`

**Example:**
```json
{
  "companyId": "factory-abc",
  "name": "Factory ABC",
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

---

### **Step 3: Arduino Sends Sensor Data**

**Every Second:**
- Arduino device reads sensors (temperature, humidity, air quality, noise, lighting)
- Sends HTTP POST to `/api/sensor-data`
- Data includes: `deviceId`, `companyId`, `metrics`

**Example Request:**
```json
POST /api/sensor-data
{
  "deviceId": "arduino-001",
  "companyId": "factory-abc",
  "metrics": {
    "temperature": 72,
    "humidity": 45,
    "airQuality": 850,
    "noise": 75,
    "lighting": 350
  }
}
```

---

### **Step 4: ML Model Assessment**

**Risk Score Calculation:**
- Server queries ML model API (`http://localhost:8000/predict`)
- ML model returns: `riskScore` (0.0-1.0, lower = safer)
- Server checks: `isSafe = riskScore < 0.3`

**Example Response:**
```json
{
  "riskScore": "0.2345",
  "confidence": "0.9297"
}
```

---

### **Step 5: Reward Qualification Check**

**Conditions Must Be Met:**
1. ✅ **Risk Score < 0.3** (safe conditions)
2. ✅ **Company is registered** (has wallet address)
3. ✅ **Cooldown period passed** (1 hour minimum since last reward)

**Cooldown Logic:**
```javascript
const timeSinceLastReward = Date.now() - company.lastRewardAt;
if (timeSinceLastReward > 3600000) { // 1 hour
  // Proceed with reward
}
```

---

### **Step 6: Reward Amount Calculation**

**Dynamic Reward Based on Safety:**
- Base reward: **0.1 SOL**
- Bonus: `(0.3 - riskScore) × 0.1 SOL`
- Range: **0.1 to 0.2 SOL**

**Formula:**
```javascript
rewardAmount = 0.1 + (0.3 - riskScore) * 0.1;
rewardAmount = Math.min(0.2, Math.max(0.1, rewardAmount));
```

**Examples:**
- Risk score `0.10` → Reward: **0.12 SOL** (very safe)
- Risk score `0.20` → Reward: **0.11 SOL** (safe)
- Risk score `0.05` → Reward: **0.125 SOL** (extremely safe)

---

### **Step 7: Solana Transaction Creation**

**Create Transfer Transaction:**
```javascript
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: mainWallet.publicKey,      // Your wallet
    toPubkey: companyWalletAddress,         // Company wallet
    lamports: rewardAmount * LAMPORTS_PER_SOL,  // Convert SOL to lamports
  })
);
```

**Key Details:**
- Uses Solana **System Program** (built-in transfer)
- Converts SOL to lamports (1 SOL = 1,000,000,000 lamports)
- Transaction includes: sender, recipient, amount

---

### **Step 8: Sign & Send Transaction**

**Sign with Main Wallet:**
```javascript
const signature = await sendAndConfirmTransaction(
  connection,        // Solana connection
  transaction,       // Transfer transaction
  [mainWallet]       // Signer (your wallet)
);
```

**What Happens:**
1. Transaction is signed with main wallet's private key
2. Sent to Solana network (devnet)
3. Network validates and confirms (~400ms)
4. Returns transaction signature (hash)

**Transaction Signature Example:**
```
5FkD6AEXxxPY3PfR2BZAmLHcReJ9TWxSs41EqVScfjrAcxEEwk3oUJ8TTCMyrR5KhntQokjM58WVKGoaHJuhsEPp
```

---

### **Step 9: Record & Store**

**Update Company Records:**
```javascript
company.totalRewardsReceived += rewardAmount;
company.lastRewardAt = Date.now();
```

**Store in Reward History:**
```javascript
rewardHistory.push({
  companyId,
  deviceId,
  timestamp: Date.now(),
  riskScore,
  rewardAmount,
  transactionSignature,  // On-chain proof
});
```

**Store in Snowflake:**
```javascript
snowflake.insertRewardPayout({
  factoryId: companyId,
  solanaTxHash: transactionSignature,
  rewardAmountSOL: rewardAmount,
  riskScore,
});
```

---

### **Step 10: Verification & Transparency**

**Transaction is Public:**
- View on Solana Explorer: `https://explorer.solana.com/tx/{signature}?cluster=devnet`
- Anyone can verify the reward was sent
- Immutable record on blockchain

**Benefits:**
- ✅ **Transparent** - All rewards visible
- ✅ **Immutable** - Cannot be altered
- ✅ **Verifiable** - Anyone can check
- ✅ **Fast** - ~400ms confirmation
- ✅ **Low Cost** - ~$0.00025 per transaction

---

## 📊 Complete Flow Diagram

```
┌─────────────┐
│   Arduino   │  Reads sensors every 1 second
│   Device    │  Temperature, Humidity, Air Quality, Noise, Lighting
└──────┬──────┘
       │ HTTP POST /api/sensor-data
       ▼
┌─────────────┐
│   Server    │  Express.js backend
│  (Node.js)  │  Validates data, stores in Snowflake
└──────┬──────┘
       │ Query ML Model
       ▼
┌─────────────┐
│  ML Model   │  Returns risk score (0.0 - 1.0)
│    API      │  Lower score = safer conditions
└──────┬──────┘
       │ riskScore < 0.3?
       ▼
┌─────────────┐
│  Decision   │  Is safe? Company registered? Cooldown OK?
│   Logic     │  Calculate reward amount (0.1-0.2 SOL)
└──────┬──────┘
       │ Yes + All conditions met
       ▼
┌─────────────┐
│   Solana    │  Create transfer transaction
│ Blockchain  │  Sign with main wallet
│             │  Send SOL to company wallet
│             │  Get transaction signature
└──────┬──────┘
       │ Transaction confirmed
       ▼
┌─────────────┐
│   Record    │  Update company reward history
│   Storage   │  Store in Snowflake
│             │  Log transaction signature
└─────────────┘
```

---

## 🔑 Key Components

### **1. Main Wallet**
- **Purpose**: Sends all rewards to companies
- **Location**: `config/wallet.js`
- **Network**: Devnet
- **Balance**: 5 SOL (for testing)

### **2. Company Wallets**
- **Purpose**: Receive rewards
- **Registration**: Companies provide wallet address during registration
- **Storage**: Stored with company info

### **3. Reward Service**
- **Function**: `sendSOLReward(recipientAddress, amountSOL)`
- **Location**: `server/index.js` (line 36)
- **Uses**: Solana System Program for transfers

### **4. Cooldown System**
- **Purpose**: Prevent reward spam
- **Rule**: Minimum 1 hour between rewards per company
- **Implementation**: Checks `company.lastRewardAt`

---

## 💰 Reward Details

### **Reward Amounts**
- **Minimum**: 0.1 SOL
- **Maximum**: 0.2 SOL
- **Calculation**: `0.1 + (0.3 - riskScore) × 0.1`

### **Reward Conditions**
1. Risk score < 0.3 (safe)
2. Company registered
3. Cooldown passed (1 hour)
4. Main wallet has sufficient balance

### **Transaction Costs**
- **Network Fee**: ~0.000005 SOL per transaction
- **Total Cost**: Reward amount + network fee
- **Example**: 0.1 SOL reward + 0.000005 SOL fee = **0.100005 SOL total**

---

## 📝 Example Complete Flow

### **Input:**
```
Arduino sends:
- Temperature: 72°F
- Humidity: 45%
- Air Quality: 850 ppm
- Noise: 75 dBA
- Lighting: 350 lux
```

### **Processing:**
```
1. ML Model: riskScore = 0.2345 (safe)
2. Check: riskScore < 0.3 ✅
3. Check: Company registered ✅
4. Check: Cooldown passed ✅
5. Calculate: rewardAmount = 0.1 + (0.3 - 0.2345) × 0.1 = 0.10655 SOL
```

### **Solana Transaction:**
```
From: 376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF (Main Wallet)
To:   7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU (Company Wallet)
Amount: 0.10655 SOL
Signature: 5FkD6AEXxxPY3PfR2BZAmLHcReJ9TWxSs41EqVScfjrAcxEEwk3oUJ8TTCMyrR5KhntQokjM58WVKGoaHJuhsEPp
```

### **Result:**
```
✅ Reward sent successfully
✅ Company receives 0.10655 SOL
✅ Transaction recorded in history
✅ Stored in Snowflake database
✅ Verifiable on Solana Explorer
```

---

## 🎯 Summary

**Solana Workflow in SafeShift:**

1. **Setup** - Main wallet configured with 5 SOL
2. **Registration** - Companies register with their wallet addresses
3. **Data Collection** - Arduino sends sensor data every second
4. **ML Assessment** - Risk score calculated (0.0-1.0)
5. **Qualification** - Check if safe (< 0.3), registered, cooldown passed
6. **Calculation** - Reward amount: 0.1-0.2 SOL based on safety
7. **Transaction** - Create Solana transfer from main wallet to company wallet
8. **Confirmation** - Transaction confirmed on Solana blockchain (~400ms)
9. **Recording** - Stored in reward history and Snowflake database
10. **Verification** - Transaction visible on Solana Explorer

**Result**: Automated, transparent, verifiable reward distribution on Solana blockchain! 🚀
