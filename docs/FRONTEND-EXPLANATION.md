# SafeShift Frontend - What It Does

## Overview

The SafeShift frontend is a **React + TypeScript web application** that provides a user interface for managing the factory safety monitoring and reward system. It's the **control panel** where you can see everything happening in real-time.

---

## What the Frontend Does

### 1. **Main Wallet Status Display** 💰

**Component**: `MainWalletStatus`

**What it shows:**
- Main wallet address (the wallet that sends rewards)
- Current SOL balance
- Network (devnet/mainnet)
- Status indicator (ready to distribute rewards)

**Purpose**: 
- Shows you the wallet that's automatically sending rewards to companies
- Lets you monitor the balance
- Confirms the system is ready

---

### 2. **Company Management** 🏢

**Components**: `CompanyList`, `CompanyRegistration`

**What it does:**

**Company Registration:**
- Companies can register with:
  - Company name
  - Their Solana wallet address (where they'll receive rewards)
- Stores company info locally (localStorage)

**Company List:**
- Shows all registered companies in a sidebar
- Displays for each company:
  - Company name
  - Wallet address
  - Number of devices
  - Total rewards received
  - Last reward time
  - Registration date
- Click a company to view their dashboard

**Purpose**:
- Manage which companies are in the system
- Track which companies are receiving rewards
- Easy navigation between companies

---

### 3. **Real-Time Safety Monitoring** 📊

**Component**: `SafetyMonitor`

**What it shows:**
- **Safety Score** (0-100): Large circular display
  - Green: Score ≥ 80 (safe)
  - Yellow: Score 60-79 (moderate)
  - Red: Score < 60 (unsafe)
  
- **Live Sensor Metrics**:
  - Temperature (°F)
  - Humidity (%RH)
  - Air Quality (ppm CO₂)
  - Noise Level (dBA)
  - Lighting (lux)
  
- **Status Indicators**:
  - ✅ Green badge = within safe range
  - ⚠️ Yellow badge = outside safe range

**Updates**: Every 3 seconds (simulated for now)

**Purpose**:
- Visualize factory conditions in real-time
- See if conditions are safe or unsafe
- Monitor multiple metrics at once
- Understand why safety score is what it is

---

### 4. **Reward Management Panel** 💸

**Component**: `RewardPanel`

**What it shows:**

**Reward Status:**
- Whether company qualifies for reward (score ≥ 80)
- Current safety score
- Minimum required score (80)

**Reward Information:**
- Company's wallet address (where rewards go)
- Calculated reward amount (based on safety score)
- Manual reward button (if qualified)

**Reward History:**
- Transaction signatures (links to Solana Explorer)
- Success/error messages
- Reward amount sent

**Purpose**:
- See if company qualifies for rewards
- Manually trigger rewards if needed
- View reward transaction history
- Verify rewards were sent successfully

---

### 5. **Automated Reward Control** 🤖

**Component**: `AutomatedRewardsControl`

**What it shows:**
- Status indicator (running/paused)
- Start/Pause button
- Configuration info:
  - Minimum safety score (80)
  - Reward range (0.1-0.2 SOL)
  - Check interval (every 60 seconds)

**Purpose**:
- Control the automated reward service
- See if rewards are being distributed automatically
- Pause/start the service if needed

---

## How It All Works Together

### User Flow:

1. **Start**: Frontend loads, connects to main wallet automatically
2. **Register Companies**: Add companies with their wallet addresses
3. **Monitor**: Select a company to see their real-time safety metrics
4. **Rewards**: Watch as rewards are automatically sent when scores are high
5. **Track**: See reward history and transaction details

### Data Flow:

```
Frontend (React) 
  ↓
LocalStorage (Company Data)
  ↓
Safety Monitor (Simulated Sensor Data)
  ↓
Reward Panel (Displays Reward Status)
  ↓
Solana Context (Connects to Blockchain)
  ↓
Backend Server (Receives Real Sensor Data)
```

---

## Key Features

### ✅ **Real-Time Updates**
- Safety scores update every 3 seconds
- Company list refreshes every 5 seconds
- Wallet balance updates every 10 seconds

### ✅ **Visual Feedback**
- Color-coded safety scores
- Status badges (✅/⚠️)
- Transaction links to Solana Explorer
- Loading states and error messages

### ✅ **User-Friendly**
- Clean, modern UI
- Easy company registration
- Clear reward information
- Responsive design

### ✅ **Blockchain Integration**
- Shows real Solana transactions
- Displays wallet balances
- Links to transaction explorer
- Verifies rewards on-chain

---

## Current State vs Future

### **Currently (Frontend):**
- Simulated sensor data (for demo)
- LocalStorage for company data
- Manual company registration
- Visual dashboard

### **Future Integration:**
- Connect to backend API for real sensor data
- WebSocket for real-time updates
- Database for company storage
- Live sensor data from Arduino devices

---

## Technical Stack

- **React**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Solana Web3.js**: Blockchain integration
- **CSS**: Custom styling

---

## Summary

The frontend is the **visual control center** for SafeShift:

1. **Shows** what's happening (safety scores, rewards)
2. **Manages** companies (registration, selection)
3. **Displays** real-time data (sensor metrics)
4. **Controls** automated rewards (start/pause)
5. **Tracks** transactions (reward history)

It's the **human interface** to the automated reward system - you can see everything, but the rewards happen automatically based on safety conditions!

---

*The frontend runs on `localhost:3000` and communicates with the backend on `localhost:3001`*
