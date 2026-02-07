# Wallet Setup Guide

## Using Your Actual Wallet (Private Key Import)

To use your actual Solana wallet (the one with 5 SOL) to send rewards to companies, you need to import your private key.

### ⚠️ Security Warning

**NEVER:**
- Share your private key
- Commit it to git
- Send it over unencrypted channels
- Store it in plain text files

**ALWAYS:**
- Keep your private key secret
- Use it only in the SafeShift app
- Consider using a dedicated wallet for rewards (not your main wallet)

### Method 1: From Solana CLI Keypair

If you have a Solana CLI keypair file:

1. **Find your keypair file:**
   ```bash
   # Default location:
   ~/.config/solana/id.json
   ```

2. **Export private key:**
   ```bash
   node scripts/export-private-key.js ~/.config/solana/id.json
   ```

3. **Copy the output** (JSON array format)

4. **In SafeShift app:**
   - Click "Import Existing Wallet (Private Key)"
   - Paste the JSON array
   - Click "Import Wallet"

### Method 2: Manual Extraction

1. **Open your keypair JSON file:**
   ```bash
   cat ~/.config/solana/id.json
   ```

2. **Copy the array** (64 numbers)

3. **Paste into SafeShift** import form

### Method 3: From Phantom/Solflare (Advanced)

Most browser wallets don't export private keys directly for security. You would need to:
- Export from Phantom/Solflare (if they support it)
- Or create a new keypair and transfer funds

### Format Examples

**JSON Array:**
```json
[1,2,3,4,5,...64 numbers total...]
```

**Comma-Separated:**
```
1,2,3,4,5,...64 numbers total...
```

### Using Your Wallet Address

Your wallet address: `376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF`

To get the private key for this address:
1. If you created it with Solana CLI, check `~/.config/solana/id.json`
2. If you have the keypair file, use the export script
3. If you don't have the private key, you'll need to create a new wallet and transfer funds

### Creating a New Wallet for Rewards (Recommended)

For better security, create a dedicated wallet just for rewards:

```bash
# Generate new keypair
solana-keygen new --outfile ~/safeshift-rewards.json

# Get the address
solana address -k ~/safeshift-rewards.json

# Transfer SOL to it
solana transfer <new-address> 5 --allow-unfunded-recipient
```

Then import this new wallet's private key into SafeShift.

### Troubleshooting

**"Invalid private key length"**
- Make sure you have exactly 64 numbers
- Check for extra spaces or commas

**"Invalid private key format"**
- All numbers must be between 0-255 (bytes)
- Make sure it's a valid JSON array or comma-separated

**"Failed to import"**
- Verify the keypair file is valid
- Try the export script to get the correct format

### Best Practices

1. **Use a dedicated wallet** for the reward system (not your main wallet)
2. **Keep minimal SOL** in the rewards wallet (just enough for transactions)
3. **Monitor the balance** regularly
4. **Backup your private key** securely (encrypted, offline)
5. **Never commit private keys** to git (already in .gitignore)
