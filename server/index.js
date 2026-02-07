/**
 * SafeShift Backend Server
 * 
 * Receives sensor data from Arduino devices, queries ML model,
 * and distributes Solana rewards based on safety scores.
 */

const express = require('express');
const cors = require('cors');
const { Connection, Keypair, clusterApiUrl } = require('@solana/web3.js');
const walletConfig = require('../config/wallet.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Solana connection
const network = walletConfig.network || 'devnet';
const connection = new Connection(clusterApiUrl(network), 'confirmed');

// Initialize main wallet
const mainWallet = Keypair.fromSecretKey(Uint8Array.from(walletConfig.privateKey));

// Simple reward service (inline to avoid import issues)
const { SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } = require('@solana/web3.js');

async function sendSOLReward(recipientAddress, amountSOL) {
  try {
    const { PublicKey } = require('@solana/web3.js');
    const recipientPubkey = new PublicKey(recipientAddress);
    const amountLamports = amountSOL * LAMPORTS_PER_SOL;

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: mainWallet.publicKey,
        toPubkey: recipientPubkey,
        lamports: amountLamports,
      })
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [mainWallet]
    );

    return signature;
  } catch (error) {
    console.error('Error sending SOL reward:', error);
    throw error;
  }
}

// In-memory storage (replace with database in production)
const companies = new Map(); // companyId -> company data
const sensorData = new Map(); // deviceId -> latest sensor readings
const rewardHistory = []; // reward transaction history

/**
 * Fake ML Model API
 * In production, this would call your teammate's actual ML API
 */
async function queryMLModel(sensorData) {
  // TODO: Replace with actual ML API call
  // const response = await fetch('http://ml-api:8000/predict', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(sensorData),
  // });
  // return await response.json();

  // Fake ML model response for now
  // Returns risk score: lower is better (< 0.3 = safe)
  const { temperature, humidity, airQuality, noise, lighting, pressure } = sensorData;
  
  // Simple scoring logic (replace with actual model)
  let riskScore = 0;
  
  // Temperature risk (ideal: 68-76°F)
  if (temperature < 68 || temperature > 76) riskScore += 0.1;
  if (temperature < 65 || temperature > 80) riskScore += 0.15;
  
  // Humidity risk (ideal: 20-60%)
  if (humidity < 20 || humidity > 60) riskScore += 0.1;
  
  // Air quality risk (ideal: < 1000 ppm CO2)
  if (airQuality > 1000) riskScore += (airQuality - 1000) / 10000;
  
  // Noise risk (ideal: < 85 dBA)
  if (noise > 85) riskScore += (noise - 85) / 500;
  
  // Lighting risk (ideal: > 300 lux)
  if (lighting < 300) riskScore += (300 - lighting) / 3000;
  
  // Add some randomness to simulate model uncertainty
  riskScore += (Math.random() - 0.5) * 0.05;
  riskScore = Math.max(0, Math.min(1, riskScore)); // Clamp to 0-1
  
  return {
    riskScore: riskScore.toFixed(4),
    confidence: (1 - riskScore * 0.3).toFixed(4), // Higher confidence for lower risk
    timestamp: Date.now(),
  };
}

/**
 * POST /api/sensor-data
 * Receives sensor data from Arduino devices
 */
app.post('/api/sensor-data', async (req, res) => {
  try {
    const { deviceId, companyId, timestamp, metrics } = req.body;
    
    // Validate required fields
    if (!deviceId || !companyId || !metrics) {
      return res.status(400).json({ 
        error: 'Missing required fields: deviceId, companyId, metrics' 
      });
    }

    // Validate metrics
    const { temperature, humidity, airQuality, noise, lighting, pressure } = metrics;
    if (temperature === undefined || humidity === undefined || 
        airQuality === undefined || noise === undefined || 
        lighting === undefined) {
      return res.status(400).json({ 
        error: 'Missing required metrics: temperature, humidity, airQuality, noise, lighting' 
      });
    }

    console.log(`📊 Received sensor data from device ${deviceId} (company ${companyId})`);

    // Store latest sensor data
    sensorData.set(deviceId, {
      deviceId,
      companyId,
      timestamp: timestamp || Date.now(),
      metrics: {
        temperature,
        humidity,
        airQuality,
        noise,
        lighting,
        pressure: pressure || null,
      },
    });

    // Query ML model
    const modelResponse = await queryMLModel({
      temperature,
      humidity,
      airQuality,
      noise,
      lighting,
      pressure: pressure || 101.3, // Default atmospheric pressure
    });

    const riskScore = parseFloat(modelResponse.riskScore);
    const isSafe = riskScore < 0.3; // Threshold: < 0.3 = safe

    console.log(`🤖 ML Model Response: riskScore=${riskScore.toFixed(4)}, isSafe=${isSafe}`);

    // Check if company qualifies for reward
    let rewardSent = false;
    let rewardAmount = 0;
    let transactionSignature = null;

    if (isSafe) {
      // Get company info (in production, from database)
      const company = companies.get(companyId);
      
      if (company) {
        // Check cooldown (prevent spam rewards - 1 hour minimum)
        const timeSinceLastReward = company?.lastRewardAt 
          ? Date.now() - company.lastRewardAt 
          : Infinity;

        if (timeSinceLastReward > 3600000) { // 1 hour
          // Calculate reward amount based on how safe (lower risk = higher reward)
          rewardAmount = 0.1 + (0.3 - riskScore) * 0.1; // 0.1 to 0.2 SOL
          rewardAmount = Math.min(0.2, Math.max(0.1, rewardAmount));

          try {
            // Send Solana reward
            transactionSignature = await sendSOLReward(
              company.walletAddress,
              rewardAmount
            );

            // Update company reward history
            if (!company.totalRewardsReceived) company.totalRewardsReceived = 0;
            company.totalRewardsReceived += rewardAmount;
            company.lastRewardAt = Date.now();
            companies.set(companyId, company);

            // Record reward
            rewardHistory.push({
              companyId,
              deviceId,
              timestamp: Date.now(),
              riskScore,
              rewardAmount,
              transactionSignature,
            });

            rewardSent = true;
            console.log(`💰 Reward sent! ${rewardAmount} SOL to ${company.walletAddress}`);
            console.log(`   Transaction: ${transactionSignature}`);
          } catch (error) {
            console.error('❌ Failed to send reward:', error);
          }
        } else {
          console.log(`⏳ Company ${companyId} already rewarded recently, skipping`);
        }
      } else {
        console.log(`⚠️  Company ${companyId} not found in registry`);
      }
    }

    // Return response
    res.json({
      success: true,
      deviceId,
      companyId,
      modelResponse: {
        riskScore: modelResponse.riskScore,
        confidence: modelResponse.confidence,
        isSafe,
      },
      reward: rewardSent ? {
        sent: true,
        amount: rewardAmount,
        transactionSignature,
      } : {
        sent: false,
        reason: isSafe 
          ? 'Already rewarded recently or company not found' 
          : 'Risk score too high (>= 0.3)',
      },
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('Error processing sensor data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/register-company
 * Register a company (called from frontend)
 */
app.post('/api/register-company', (req, res) => {
  try {
    const { companyId, name, walletAddress, deviceIds } = req.body;
    
    if (!companyId || !name || !walletAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields: companyId, name, walletAddress' 
      });
    }

    companies.set(companyId, {
      id: companyId,
      name,
      walletAddress,
      deviceIds: deviceIds || [],
      totalRewardsReceived: 0,
      lastRewardAt: null,
      registeredAt: Date.now(),
      isActive: true,
    });

    console.log(`✅ Company registered: ${name} (${companyId})`);
    
    res.json({
      success: true,
      company: companies.get(companyId),
    });
  } catch (error) {
    console.error('Error registering company:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/companies
 * Get all registered companies
 */
app.get('/api/companies', (req, res) => {
  res.json({
    success: true,
    companies: Array.from(companies.values()),
  });
});

/**
 * GET /api/rewards
 * Get reward history
 */
app.get('/api/rewards', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json({
    success: true,
    rewards: rewardHistory.slice(-limit),
    total: rewardHistory.length,
  });
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    walletAddress: mainWallet.publicKey.toString(),
    network,
    companiesCount: companies.size,
    sensorDataCount: sensorData.size,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SafeShift Server running on http://localhost:${PORT}`);
  console.log(`💰 Main wallet: ${mainWallet.publicKey.toString()}`);
  console.log(`🌐 Network: ${network}`);
  console.log(`📡 Ready to receive sensor data from Arduino devices`);
});
