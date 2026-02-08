# Testing Solana Rewards & Verifying SOL Deposits

This guide walks you through testing the Solana component and **verifying that SOL is actually deposited** into a recipient wallet.

---

## Prerequisites

- **Node.js** and project dependencies installed (`npm install`)
- **config/wallet.js** set up with the **main wallet** (the one that sends rewards). See [WALLET-SETUP.md](./WALLET-SETUP.md).
- Use **devnet** for testing (no real money). Your main wallet must have devnet SOL.

---

## 1. Fund the main wallet (devnet)

The main wallet in `config/wallet.js` is the **sender**. It must have SOL to send.

**Option A – Solana CLI**

```bash
# Use devnet
solana config set --url devnet

# Airdrop (if your keypair is from Solana CLI)
solana airdrop 2
# Or specify keypair used by SafeShift:
solana airdrop 2 --keypair path/to/your/wallet.json
```

**Option B – Devnet faucet in browser**

1. Get your main wallet address from the server startup log or run:
   ```bash
   node -e "const w=require('./config/wallet.js'); console.log(w.address)"
   ```
2. Open https://faucet.solana.com/
3. Select **Devnet**, paste the address, request SOL.

**Verify main wallet balance**

```bash
npm run check-balance
# or with explicit address:
node scripts/check-sol-balance.js
```

---

## 2. Choose a recipient wallet

To see SOL **arrive** in a wallet you control, the **company** must be registered with a **different** address than the main wallet.

- **Option A – Same wallet (simplest):** Register the company with the same address as in `config/wallet.js`. SOL will be “sent” from that wallet to itself (balance won’t change by the reward amount; you still see the tx in the explorer).
- **Option B – Second wallet (recommended for “deposit” test):** Create another devnet wallet and use its address as the company’s “receive” address. Then you can watch that wallet’s balance increase.

**Create a second wallet (devnet) for receiving**

```bash
solana-keygen new --outfile recipient-wallet.json
solana address -k recipient-wallet.json
# Request devnet SOL for it:
solana airdrop 1 -k recipient-wallet.json
```

Use the printed address as the **company wallet address** when registering.

---

## 3. Shorten cooldown for testing (optional)

By default, each company can receive at most one reward per **1 hour**. For quick repeated tests, set:

**Windows (PowerShell)**

```powershell
$env:REWARD_COOLDOWN_MS="0"
npm run server
```

**Windows (CMD)** / **Linux / Mac**

```bash
set REWARD_COOLDOWN_MS=0
npm run server
```

Or in one line:

```bash
# Linux/Mac
REWARD_COOLDOWN_MS=0 node server/index.js
```

With `REWARD_COOLDOWN_MS=0`, you can trigger a reward on every safe sensor POST (no cooldown).

---

## 4. Start the server and register a company

**Terminal 1 – start server**

```bash
npm run server
```

**Register a company** with the **recipient** wallet address (the one where you want to see SOL):

**Option A – E2E test script (registers + sends safe data)**

Edit `scripts/test-e2e.js` and set `walletAddress` in the register body to your **recipient** address (e.g. the one from `recipient-wallet.json`). Then:

```bash
REWARD_COOLDOWN_MS=0 npm run test:e2e
```

**Option B – cURL**

```bash
curl -X POST http://localhost:3001/api/register-company ^
  -H "Content-Type: application/json" ^
  -d "{\"companyId\":\"test-company\",\"name\":\"Test Factory\",\"walletAddress\":\"YOUR_RECIPIENT_WALLET_ADDRESS\"}"
```

(Use `\` for line continuation on Linux/Mac instead of `^`.)

**Option C – Frontend**

In the app, go to Company Registration and register with your **recipient** Solana wallet address.

---

## 5. Trigger a reward (safe sensor data)

The server sends SOL when:

1. Risk score &lt; 0.3 (safe),
2. Company is registered,
3. Cooldown has passed (or `REWARD_COOLDOWN_MS=0`).

**Option A – E2E script (after registering with recipient address)**

```bash
REWARD_COOLDOWN_MS=0 node scripts/test-e2e.js
```

Check the output for `Reward sent: X.XX SOL` and the transaction signature.

**Option B – cURL**

```bash
curl -X POST http://localhost:3001/api/sensor-data ^
  -H "Content-Type: application/json" ^
  -d "{\"deviceId\":\"arduino-001\",\"companyId\":\"test-company\",\"timestamp\":%TIMESTAMP%,\"metrics\":{\"temperature\":72,\"humidity\":45,\"airQuality\":850,\"noise\":70,\"lighting\":400,\"pressure\":1013}}"
```

Replace `%TIMESTAMP%` with `Date.now()` (e.g. in Node: `node -e "console.log(Date.now())"`). If the ML API is unavailable, the server uses fallback scoring; “safe” metrics often still yield a reward.

**Option C – Arduino / serial bridge**

Run the Arduino pipeline and serial bridge so the server receives safe sensor data for a registered `companyId`. When conditions are safe and cooldown is satisfied, a reward is sent.

---

## 6. Verify SOL was deposited

**A. Check recipient balance (script)**

```bash
node scripts/check-sol-balance.js YOUR_RECIPIENT_WALLET_ADDRESS
```

Run before and after triggering a reward; the balance should increase by the reward amount (e.g. 0.1–0.2 SOL).

**B. Solana Explorer (devnet)**

1. From server logs, copy the transaction signature (e.g. `Transaction: 5FkD6...`).
2. Open: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`
3. Confirm the transfer: From = main wallet, To = company (recipient) wallet, Amount = reward SOL.

**C. API reward history**

```bash
curl http://localhost:3001/api/rewards
```

You should see the latest reward with `transactionSignature` and `rewardAmount`.

---

## Quick checklist

| Step | Action |
|------|--------|
| 1 | Main wallet in `config/wallet.js` has devnet SOL (faucet or airdrop). |
| 2 | Decide recipient: same as main (tx only) or second wallet (see balance increase). |
| 3 | (Optional) Set `REWARD_COOLDOWN_MS=0` for repeated tests. |
| 4 | Start server: `npm run server`. |
| 5 | Register company with **recipient** wallet address (UI, cURL, or test script). |
| 6 | Send safe sensor data (test script, cURL, or Arduino). |
| 7 | Verify: `node scripts/check-sol-balance.js <recipient_address>` and/or Explorer. |

---

## Troubleshooting

- **“Company not found”**  
  Register the company with the same `companyId` you use in the sensor-data POST (e.g. `test-company`).

- **“Already rewarded recently”**  
  Set `REWARD_COOLDOWN_MS=0` and restart the server, or wait for the cooldown.

- **“Insufficient funds” / send fails**  
  Main wallet needs more devnet SOL (faucet/airdrop).

- **Recipient balance doesn’t change**  
  Confirm the company is registered with that exact address and that the server log shows `Reward sent! X SOL to <address>`. Then check that address with `check-sol-balance.js` and the tx on Explorer (devnet).

- **Wrong network**  
  Server uses `config/wallet.js` → `network` (default devnet). Balance script uses `SOLANA_NETWORK` or devnet. Keep both on **devnet** for testing.
