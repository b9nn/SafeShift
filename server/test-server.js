/**
 * Test script for SafeShift server
 * 
 * Usage: node server/test-server.js
 */

const fetch = require('node-fetch');

const SERVER_URL = 'http://localhost:3001';

async function testServer() {
  console.log('🧪 Testing SafeShift Server...\n');

  // Test 1: Health check
  console.log('1️⃣ Testing health endpoint...');
  try {
    const healthRes = await fetch(`${SERVER_URL}/api/health`);
    const health = await healthRes.json();
    console.log('✅ Health check:', health);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: Register a company
  console.log('\n2️⃣ Registering test company...');
  try {
    const registerRes = await fetch(`${SERVER_URL}/api/register-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'test-company-001',
        name: 'Test Factory',
        walletAddress: '376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF',
        deviceIds: ['test-device-001'],
      }),
    });
    const registerData = await registerRes.json();
    console.log('✅ Company registered:', registerData);
  } catch (error) {
    console.error('❌ Registration failed:', error.message);
  }

  // Test 3: Send sensor data (safe conditions)
  console.log('\n3️⃣ Sending sensor data (safe conditions)...');
  try {
    const sensorRes = await fetch(`${SERVER_URL}/api/sensor-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'test-device-001',
        companyId: 'test-company-001',
        timestamp: Date.now(),
        metrics: {
          temperature: 72,      // Good: within 68-76°F
          humidity: 45,         // Good: within 20-60%
          airQuality: 850,       // Good: < 1000 ppm
          noise: 75,            // Good: < 85 dBA
          lighting: 350,        // Good: > 300 lux
          pressure: 101.3,
        },
      }),
    });
    const sensorData = await sensorRes.json();
    console.log('✅ Sensor data response:', JSON.stringify(sensorData, null, 2));
  } catch (error) {
    console.error('❌ Sensor data failed:', error.message);
  }

  // Test 4: Send sensor data (unsafe conditions)
  console.log('\n4️⃣ Sending sensor data (unsafe conditions)...');
  try {
    const sensorRes = await fetch(`${SERVER_URL}/api/sensor-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'test-device-001',
        companyId: 'test-company-001',
        timestamp: Date.now(),
        metrics: {
          temperature: 85,      // Bad: > 80°F
          humidity: 70,         // Bad: > 60%
          airQuality: 1500,      // Bad: > 1000 ppm
          noise: 90,            // Bad: > 85 dBA
          lighting: 200,        // Bad: < 300 lux
          pressure: 101.3,
        },
      }),
    });
    const sensorData = await sensorRes.json();
    console.log('✅ Sensor data response:', JSON.stringify(sensorData, null, 2));
  } catch (error) {
    console.error('❌ Sensor data failed:', error.message);
  }

  // Test 5: Get reward history
  console.log('\n5️⃣ Getting reward history...');
  try {
    const rewardsRes = await fetch(`${SERVER_URL}/api/rewards`);
    const rewards = await rewardsRes.json();
    console.log('✅ Reward history:', rewards);
  } catch (error) {
    console.error('❌ Reward history failed:', error.message);
  }

  console.log('\n✅ All tests completed!');
}

// Run tests
testServer().catch(console.error);
