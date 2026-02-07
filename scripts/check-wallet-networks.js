/**
 * Check Wallet on Multiple Networks
 * 
 * This script checks the wallet balance across different Solana networks
 * to help identify which network your wallet is on.
 */

const { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } = require('@solana/web3.js');

const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF';
const networks = ['mainnet-beta', 'devnet', 'testnet'];

async function checkNetwork(network) {
  try {
    const connection = new Connection(clusterApiUrl(network), 'confirmed');
    const publicKey = new PublicKey(WALLET_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    const balanceInSOL = balance / LAMPORTS_PER_SOL;
    
    return {
      network,
      found: true,
      balance: balanceInSOL,
      lamports: balance
    };
  } catch (error) {
    return {
      network,
      found: false,
      error: error.message
    };
  }
}

async function checkAllNetworks() {
  console.log('🔍 Checking wallet across all Solana networks...\n');
  console.log(`Wallet Address: ${WALLET_ADDRESS}\n`);

  const results = await Promise.all(networks.map(checkNetwork));

  console.log('Results:\n');
  results.forEach(result => {
    if (result.found && result.balance > 0) {
      console.log(`✅ ${result.network.padEnd(15)} - ${result.balance.toFixed(4)} SOL`);
    } else if (result.found) {
      console.log(`⚠️  ${result.network.padEnd(15)} - Found but 0 SOL`);
    } else {
      console.log(`❌ ${result.network.padEnd(15)} - Not found or error`);
    }
  });

  const foundNetwork = results.find(r => r.found && r.balance > 0);
  if (foundNetwork) {
    console.log(`\n✅ Wallet found on ${foundNetwork.network} with ${foundNetwork.balance.toFixed(4)} SOL`);
    console.log(`\n💡 Update your .env file with: SOLANA_NETWORK=${foundNetwork.network}`);
  } else {
    console.log('\n⚠️  Wallet not found on any network with balance.');
    console.log('   Make sure the wallet address is correct and you have SOL.');
  }
}

checkAllNetworks();
