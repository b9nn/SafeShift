# Quick Start: Using Your Actual Wallet

## 🚀 Quick Steps

### 1. Get Your Private Key

**Option A: From Solana CLI keypair file**
```bash
# Export your private key
npm run export-key ~/.config/solana/id.json
```

**Option B: Manual extraction**
- Open your keypair JSON file: `~/.config/solana/id.json`
- Copy the array of 64 numbers

### 2. Import in SafeShift

1. Open SafeShift app
2. Click **"Import Existing Wallet (Private Key)"**
3. Paste your private key (JSON array format)
4. Click **"Import Wallet"**

### 3. Verify Connection

- Your wallet address should appear
- Balance should show your SOL
- You're ready to send rewards!

## 📋 Private Key Formats Supported

✅ **JSON Array:** `[1,2,3,4,...]`  
✅ **Comma-Separated:** `1,2,3,4,...`  
✅ **Base58 String:** `5KJvsngHeM...` (if exported as base58)

## ⚠️ Security Reminders

- ✅ Private key stays in your browser (never sent to servers)
- ✅ Already in `.gitignore` (won't be committed)
- ❌ Never share your private key
- ❌ Never commit it to git
- ❌ Use a dedicated wallet for rewards (not your main wallet)

## 🔧 Troubleshooting

**"Invalid private key length"**
→ Make sure you have exactly 64 numbers

**"Invalid format"**
→ Try the export script: `npm run export-key`

**Wallet not connecting**
→ Check that you're on the correct network (devnet/mainnet)

## 📚 More Info

See `docs/WALLET-SETUP.md` for detailed instructions.
