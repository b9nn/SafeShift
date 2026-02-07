# Company Registration & Automated Rewards System

## Overview

SafeShift now supports a **multi-tenant company system** where:

1. **Main Wallet (You)**: The wallet with 5 SOL that sends rewards
2. **Companies**: Factories that register with their wallet addresses
3. **Automated Rewards**: When company safety scores are high, rewards are automatically sent from your main wallet to their wallet

## How It Works

### 1. Company Registration
- Companies register with:
  - Company name
  - Their Solana wallet address (where they'll receive rewards)
- Registration is stored locally (localStorage)
- Each company gets a unique ID

### 2. Device Linking
- Devices/sensors can be linked to companies
- Safety reports from devices are associated with the company
- Multiple devices per company supported

### 3. Safety Monitoring
- Real-time safety metrics are collected (simulated for now)
- Safety score calculated (0-100)
- Reports stored with company ID

### 4. Automated Reward Distribution
- **Automated Service** runs in background
- Checks all companies every 60 seconds (configurable)
- When safety score ≥ 80:
  - Calculates reward amount (0.1 - 0.2 SOL based on score)
  - Sends SOL from main wallet to company wallet
  - Records reward in company history
  - Stores compliance hash on-chain
  - Prevents duplicate rewards (1 hour cooldown)

### 5. Manual Rewards
- You can also manually send rewards to companies
- Only works if company qualifies (score ≥ 80)
- Uses same reward calculation

## Features

✅ **Company Registration**: Easy signup with wallet address  
✅ **Company Dashboard**: View each company's safety metrics  
✅ **Automated Rewards**: Automatic distribution when scores are high  
✅ **Reward History**: Track total rewards per company  
✅ **Real-time Monitoring**: Live safety score updates  
✅ **Multi-Company Support**: Manage multiple factories  

## Usage

### For Platform Admin (You)

1. **Connect Main Wallet**: Connect the wallet with 5 SOL
2. **View Companies**: See all registered companies in sidebar
3. **Monitor**: Select a company to view their dashboard
4. **Automated Rewards**: Service runs automatically (can pause/start)

### For Companies

1. **Register**: Click "+ Add Company" and enter:
   - Company name
   - Your Solana wallet address
2. **Wait for Rewards**: When your safety scores are high (≥80), rewards are automatically sent
3. **View Status**: Check your dashboard for current score and reward history

## Configuration

Automated reward service settings (in `AutomatedRewardService`):
- `minSafetyScore`: 80 (minimum to qualify)
- `baseRewardAmount`: 0.1 SOL
- `maxRewardAmount`: 0.2 SOL
- `checkInterval`: 60000ms (1 minute)

## Data Storage

All data stored in browser localStorage:
- Companies: `safeshift_companies`
- Devices: `safeshift_devices`
- Safety Reports: `safeshift_reports`

For production, replace with a backend database.

## Next Steps

- [ ] Connect real sensor devices
- [ ] Add device registration UI
- [ ] Implement ML scoring
- [ ] Add reward history charts
- [ ] Export compliance reports
- [ ] Multi-signature wallet for fund management
