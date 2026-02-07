/**
 * Helper script to export private key from Solana CLI keypair
 * 
 * Usage: node scripts/export-private-key.js [path-to-keypair.json]
 * 
 * This helps you get your private key in the format needed for wallet import.
 * 
 * ⚠️ WARNING: Never commit private keys to git or share them!
 */

const fs = require('fs');
const path = require('path');

// Default Solana CLI keypair location
const DEFAULT_KEYPAIR_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.config',
  'solana',
  'id.json'
);

const keypairPath = process.argv[2] || DEFAULT_KEYPAIR_PATH;

try {
  if (!fs.existsSync(keypairPath)) {
    console.error(`❌ Keypair file not found: ${keypairPath}`);
    console.log('\nUsage: node scripts/export-private-key.js [path-to-keypair.json]');
    console.log(`Default location: ${DEFAULT_KEYPAIR_PATH}`);
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  
  if (!Array.isArray(keypairData) || keypairData.length !== 64) {
    console.error('❌ Invalid keypair format. Expected array of 64 numbers.');
    process.exit(1);
  }

  console.log('\n✅ Private Key (JSON Array Format):');
  console.log('─'.repeat(60));
  console.log(JSON.stringify(keypairData));
  console.log('─'.repeat(60));
  
  console.log('\n✅ Private Key (Comma-Separated Format):');
  console.log('─'.repeat(60));
  console.log(keypairData.join(','));
  console.log('─'.repeat(60));
  
  console.log('\n⚠️  SECURITY WARNING:');
  console.log('   - Never share this private key');
  console.log('   - Never commit it to git');
  console.log('   - Only use it in the SafeShift app');
  console.log('   - Delete this output after copying\n');

} catch (error) {
  console.error('❌ Error reading keypair:', error.message);
  process.exit(1);
}
