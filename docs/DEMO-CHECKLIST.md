# Pre-Demo Checklist

Quick list so nothing breaks during the presentation.

## Before you start

- [ ] **Backend running**  
  `npm run server` — you should see “Demo company registered” and “Main wallet: 376…”.

- [ ] **Frontend running**  
  `npm run dev` — open the URL shown (e.g. http://localhost:3000).

- [ ] **Main wallet has devnet SOL**  
  Run `npm run balance`. If balance is 0, use https://faucet.solana.com (Devnet) for your wallet in `config/wallet.js`.

- [ ] **Optional: allow multiple Collects**  
  Start server with:  
  `$env:REWARD_COOLDOWN_MS="0"; npm run server`  
  so you can click “Collect SOL” more than once without waiting.

## Demo flow (happy path)

1. **Splash** → “Access Wallet”.
2. **Wallet** → Shows real address and balance from config.
3. **View Dashboard** → Company thresholds (optional to change).
4. **Start** → Live Feed (gauges, noise, morale).
5. **End Session** → Insights.
6. **View Solana** → Solana Results.
7. **Collect SOL** → Sends real tx; balance refreshes; “View transaction on Explorer” works.

## If something goes wrong

- **“Backend returned HTML”** → Start the server: `npm run server`.
- **“No company registered”** → Restart the server (demo company is registered on startup).
- **Collect fails (insufficient funds)** → Faucet the main wallet on devnet.
- **Wallet shows “Loading…”** → Check `config/wallet.js` / `config/wallet.ts` exists and has valid `privateKey` (64 numbers) and `address`.

## One-liner (PowerShell) for demo

```powershell
# Terminal 1
$env:REWARD_COOLDOWN_MS="0"; npm run server

# Terminal 2
npm run dev
```

Then open the app URL and run through the flow above.
