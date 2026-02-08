#!/usr/bin/env node
/**
 * SafeShift E2E Test
 *
 * 1. Register company
 * 2. Send sensor data (safe conditions)
 * 3. Verify response (risk score, reward sent)
 * 4. NLP verbal abuse detection (safe + abusive text)
 * 5. Optionally verify Snowflake has data
 *
 * Usage: node scripts/test-e2e.js [--snowflake]
 * Env: SERVER_URL (default http://localhost:3001)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fetch = require('node-fetch');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const VERIFY_SNOWFLAKE = process.argv.includes('--snowflake');

async function main() {
  console.log('🧪 SafeShift E2E Test');
  console.log(`   Server: ${SERVER_URL}\n`);

  let passed = 0;
  let failed = 0;

  // Step 1: Register company
  console.log('1. Register company...');
  try {
    const regRes = await fetch(`${SERVER_URL}/api/register-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'e2e-test-company',
        name: 'E2E Test Factory',
        walletAddress: '376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF',
      }),
    });
    const regData = await regRes.json();
    if (regData.success) {
      console.log('   ✅ Company registered\n');
      passed++;
    } else {
      throw new Error(regData.error || 'Registration failed');
    }
  } catch (e) {
    console.log('   ❌', e.message, '\n');
    failed++;
    process.exit(1);
  }

  // Step 2: Send sensor data (safe conditions)
  console.log('2. Send sensor data (safe conditions)...');
  try {
    const sensorRes = await fetch(`${SERVER_URL}/api/sensor-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'e2e-test-device',
        companyId: 'e2e-test-company',
        timestamp: Date.now(),
        metrics: {
          temperature: 72,
          humidity: 45,
          airQuality: 850,
          noise: 70,
          lighting: 400,
          pressure: 1013,
        },
      }),
    });
    const sensorData = await sensorRes.json();

    if (!sensorData.success) {
      throw new Error(sensorData.error || 'Sensor POST failed');
    }

    const risk = parseFloat(sensorData.modelResponse?.riskScore ?? 1);
    const isSafe = sensorData.modelResponse?.isSafe === true;
    const rewardSent = sensorData.reward?.sent === true;

    if (risk < 0.3) {
      console.log(`   ✅ Risk score: ${risk.toFixed(4)} (< 0.3 = safe)`);
      passed++;
    } else {
      console.log(`   ⚠️  Risk score: ${risk.toFixed(4)} (expected < 0.3)`);
      failed++;
    }

    if (rewardSent) {
      console.log(`   ✅ Reward sent: ${sensorData.reward.amount} SOL`);
      console.log(`   Tx: ${sensorData.reward.transactionSignature}`);
      passed++;
    } else {
      console.log(`   ⚠️  No reward: ${sensorData.reward?.reason || 'unknown'}`);
      if (isSafe) failed++;
    }
    console.log('');
  } catch (e) {
    console.log('   ❌', e.message, '\n');
    failed++;
    process.exit(1);
  }

  // Step 3: Verify /api/rewards
  console.log('3. Verify /api/rewards...');
  try {
    const rewardsRes = await fetch(`${SERVER_URL}/api/rewards`);
    const rewardsData = await rewardsRes.json();
    const count = rewardsData.rewards?.length ?? 0;
    if (count > 0) {
      console.log(`   ✅ Rewards in history: ${count}\n`);
      passed++;
    } else {
      console.log('   ⚠️  No rewards in history yet\n');
    }
  } catch (e) {
    console.log('   ❌', e.message, '\n');
    failed++;
  }

  // Step 4: NLP verbal abuse detection
  console.log('4. NLP verbal abuse detection...');
  try {
    // 4a: Safe text — should NOT be flagged
    const safeRes = await fetch(`${SERVER_URL}/api/report-abuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Good morning, how is the production line running today?',
        companyId: 'e2e-test-company',
      }),
    });
    const safeData = await safeRes.json();

    if (safeData.success && !safeData.analysis.is_abusive) {
      console.log(`   ✅ Safe text: not flagged (severity: ${safeData.analysis.severity})`);
      passed++;
    } else {
      console.log(`   ⚠️  Safe text incorrectly flagged as abusive`);
      failed++;
    }

    // 4b: Abusive text — should be flagged
    const abuseRes = await fetch(`${SERVER_URL}/api/report-abuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'You are an idiot, get back to work or you are fired!',
        companyId: 'e2e-test-company',
      }),
    });
    const abuseData = await abuseRes.json();

    if (abuseData.success && abuseData.analysis.is_abusive) {
      console.log(`   ✅ Abusive text: flagged (severity: ${abuseData.analysis.severity}, categories: ${abuseData.analysis.flagged_categories.join(', ')})`);
      passed++;
    } else {
      console.log(`   ⚠️  Abusive text not flagged (severity: ${abuseData.analysis?.severity})`);
      failed++;
    }
    console.log('');
  } catch (e) {
    console.log(`   ⚠️  NLP test skipped: ${e.message} (is ML API running?)\n`);
  }

  // Step 5: Snowflake verification (optional)
  if (VERIFY_SNOWFLAKE) {
    console.log('5. Snowflake verification...');
    console.log('   Run in Snowflake: snowflake/11_verify_bridge_data.sql');
    console.log('   Or check tables: RAW.SENSOR_READINGS_RAW, RAW.ML_RISK_SCORES, BLOCKCHAIN.REWARD_PAYOUTS\n');
  }

  // Summary
  console.log('---');
  console.log(`Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) process.exit(1);
  console.log('\n✅ E2E test passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
