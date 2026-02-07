/**
 * Verify keypair and show wallet address
 */

const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

const keypairPath = process.argv[2];

if (!keypairPath) {
  console.error('Usage: node scripts/verify-keypair.js [path-to-keypair.json]');
  process.exit(1);
}

try {
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  
  if (!Array.isArray(keypairData) || keypairData.length !== 64) {
    console.error('❌ Invalid keypair format. Expected array of 64 numbers.');
    process.exit(1);
  }

  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const address = keypair.publicKey.toString();

  console.log('\n✅ Keypair is valid!');
  console.log('─'.repeat(60));
  console.log(`Wallet Address: ${address}`);
  console.log('─'.repeat(60));
  console.log('\n💡 You can now import this wallet into SafeShift:');
  console.log('   1. Copy the private key array from the file');
  console.log('   2. In SafeShift, click "Import Existing Wallet"');
  console.log('   3. Paste the array and click "Import Wallet"\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
