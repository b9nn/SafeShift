/**
 * SafeShift Backend Server
 * 
 * Receives sensor data from Arduino devices, queries ML model,
 * and distributes Solana rewards based on safety scores.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Connection, Keypair, clusterApiUrl } = require('@solana/web3.js');
const walletConfig = require('../config/wallet.js');
const snowflake = require('./snowflake');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Handle favicon request (prevent 404 errors)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content
});

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
    // Lamports must be an integer (floating point can yield e.g. 121000000.00000001)
    const amountLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

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
 * ML Model API — calls FastAPI inference server
 * Falls back to simple threshold scoring if ML API is unavailable
 */
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

async function queryMLModel(sensorData) {
  try {
    const response = await fetch(`${ML_API_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        temperature: sensorData.temperature,
        humidity: sensorData.humidity,
        airQuality: sensorData.airQuality ?? 850,
        noise: sensorData.noise,
        lighting: sensorData.lighting,
        pressure: sensorData.pressure ?? 1013.25,
        ...(sensorData.magnetic_uT != null && { magnetic_uT: sensorData.magnetic_uT }),
      }),
    });
    if (!response.ok) throw new Error(`ML API ${response.status}: ${response.statusText}`);
    const json = await response.json();
    return {
      riskScore: String(json.riskScore ?? json.risk_score ?? '0.5'),
      confidence: String(json.confidence ?? '0.8'),
      timestamp: json.timestamp ?? Date.now(),
    };
  } catch (err) {
    console.warn('⚠️  ML API unavailable, using fallback scoring:', err.message);
    return fallbackMLScore(sensorData);
  }
}

function fallbackMLScore(sensorData) {
  const { temperature, humidity, airQuality, noise, lighting, magnetic_uT } = sensorData;
  let riskScore = 0;
  if (temperature < 68 || temperature > 76) riskScore += 0.1;
  if (temperature < 65 || temperature > 80) riskScore += 0.15;
  if (humidity < 20 || humidity > 60) riskScore += 0.1;
  if (airQuality > 1000) riskScore += Math.min(0.3, (airQuality - 1000) / 10000);
  if (noise > 85) riskScore += (noise - 85) / 500;
  if (lighting < 300) riskScore += (300 - lighting) / 3000;
  // Strong magnetic field (e.g. > 80 µT) can indicate electrical/equipment issues
  if (magnetic_uT != null && magnetic_uT > 80) riskScore += Math.min(0.15, (magnetic_uT - 80) / 1000);
  riskScore = Math.max(0, Math.min(1, riskScore));
  return {
    riskScore: riskScore.toFixed(4),
    confidence: (1 - riskScore * 0.3).toFixed(4),
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
    const { temperature, humidity, airQuality, noise, lighting, pressure, magnetic_uT } = metrics;
    if (temperature === undefined || humidity === undefined || 
        airQuality === undefined || noise === undefined || 
        lighting === undefined) {
      return res.status(400).json({ 
        error: 'Missing required metrics: temperature, humidity, airQuality, noise, lighting' 
      });
    }

    console.log(`📊 Received sensor data from device ${deviceId} (company ${companyId})`);

    // Snowflake: insert raw reading (fire-and-forget)
    snowflake.insertRawReading({
      factoryId: companyId,
      sensorNodeId: deviceId,
      timestamp: timestamp || Date.now(),
      metrics: { temperature, humidity, airQuality, noise, lighting, pressure: pressure || null },
      rawPayload: req.body,
    }).catch(() => {});

    // Store latest sensor data (metrics + ML result added after prediction)
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
        ...(magnetic_uT != null && { magnetic_uT }),
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
      ...(magnetic_uT != null && { magnetic_uT }),
    });

    const riskScore = parseFloat(modelResponse.riskScore);
    const isSafe = riskScore < 0.3; // Threshold: < 0.3 = safe

    // Snowflake: insert ML risk score (fire-and-forget)
    snowflake.insertMLRiskScore({
      factoryId: companyId,
      sensorNodeId: deviceId,
      timestamp: timestamp || Date.now(),
      riskScore: modelResponse.riskScore,
      confidence: modelResponse.confidence,
    }).catch(() => {});

    // Attach ML result to stored sensor data so GET can expose it
    const stored = sensorData.get(deviceId);
    if (stored) {
      stored.riskScore = modelResponse.riskScore;
      stored.confidence = modelResponse.confidence;
      stored.isSafe = isSafe;
    }

    console.log(`🤖 ML Model Response: riskScore=${riskScore.toFixed(4)}, isSafe=${isSafe}`);

    // Check if company qualifies for reward
    let rewardSent = false;
    let rewardAmount = 0;
    let transactionSignature = null;
    let rewardReason = !isSafe ? 'Risk score too high (>= 0.3)' : null;

    if (isSafe) {
      // Get company info (in production, from database)
      const company = companies.get(companyId);

      if (!company) {
        rewardReason = 'Company not found in registry';
        console.log(`⚠️  Company ${companyId} not found in registry`);
      } else {
        // Check cooldown (prevent spam rewards). Use REWARD_COOLDOWN_MS=0 for testing.
        const cooldownMs = parseInt(process.env.REWARD_COOLDOWN_MS || '3600000', 10); // default 1 hour
        const timeSinceLastReward = company.lastRewardAt
          ? Date.now() - company.lastRewardAt
          : Infinity;

        if (timeSinceLastReward <= cooldownMs) {
          const waitMin = Math.ceil((cooldownMs - timeSinceLastReward) / 60000);
          rewardReason = `Already rewarded recently (try again in ~${waitMin} min, or start server with REWARD_COOLDOWN_MS=0 for testing)`;
          console.log(`⏳ Company ${companyId} already rewarded recently, skipping`);
        } else {
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
            // Snowflake: insert reward payout (fire-and-forget)
            snowflake.insertRewardPayout({
              factoryId: companyId,
              solanaTxHash: transactionSignature,
              rewardAmountSOL: rewardAmount,
              riskScore,
            }).catch(() => {});

            console.log(`💰 Reward sent! ${rewardAmount} SOL to ${company.walletAddress}`);
            console.log(`   Transaction: ${transactionSignature}`);
          } catch (error) {
            rewardReason = `Transfer failed: ${error.message}`;
            console.error('❌ Failed to send reward:', error);
          }
        }
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
        reason: rewardReason,
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
 * GET /api/sensor-data/:deviceId
 * Get latest sensor readings + ML risk for a device
 */
app.get('/api/sensor-data/:deviceId', (req, res) => {
  const data = sensorData.get(req.params.deviceId);
  if (!data) {
    return res.json({ success: false, error: 'No data for device' });
  }
  res.json({ success: true, ...data });
});

/**
 * POST /api/claim-reward
 * Manually trigger sending a SOL reward to a company (e.g. from "Collect" on frontend).
 * Body: { companyId?: string }. Query: ?force=1 to bypass cooldown.
 * If no companyId, uses first registered company.
 */
app.post('/api/claim-reward', async (req, res) => {
  try {
    const { companyId: bodyCompanyId } = req.body || {};
    const force = req.query.force === '1' || req.query.force === 'true';
    const companyId = bodyCompanyId || (companies.has('demo-company') ? 'demo-company' : (companies.size > 0 ? companies.keys().next().value : null));

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'No company registered. Register a company with a wallet address first.',
      });
    }

    const company = companies.get(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: `Company ${companyId} not found`,
      });
    }

    const cooldownMs = force ? 0 : parseInt(process.env.REWARD_COOLDOWN_MS || '3600000', 10);
    const timeSinceLastReward = company.lastRewardAt ? Date.now() - company.lastRewardAt : Infinity;
    if (timeSinceLastReward <= cooldownMs && !force) {
      const waitMin = Math.ceil((cooldownMs - timeSinceLastReward) / 60000);
      return res.status(429).json({
        success: false,
        error: `Cooldown: try again in ~${waitMin} min, or use ?force=1 for testing`,
      });
    }

    const riskScore = 0.15; // default for manual claim
    let rewardAmount = 0.1 + (0.3 - riskScore) * 0.1;
    rewardAmount = Math.min(0.2, Math.max(0.1, rewardAmount));

    const transactionSignature = await sendSOLReward(company.walletAddress, rewardAmount);

    if (!company.totalRewardsReceived) company.totalRewardsReceived = 0;
    company.totalRewardsReceived += rewardAmount;
    company.lastRewardAt = Date.now();
    companies.set(companyId, company);

    rewardHistory.push({
      companyId,
      deviceId: 'manual-claim',
      timestamp: Date.now(),
      riskScore,
      rewardAmount,
      transactionSignature,
    });

    snowflake.insertRewardPayout({
      factoryId: companyId,
      solanaTxHash: transactionSignature,
      rewardAmountSOL: rewardAmount,
      riskScore,
    }).catch(() => {});

    console.log(`💰 Claim reward: ${rewardAmount} SOL to ${company.walletAddress} (${companyId})`);
    res.json({
      success: true,
      transactionSignature,
      rewardAmount,
      recipientAddress: company.walletAddress,
      explorerUrl: `https://explorer.solana.com/tx/${transactionSignature}?cluster=${network}`,
    });
  } catch (error) {
    console.error('Claim reward error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send reward',
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
 * POST /api/report-abuse
 * Opt-in worker text report — analyzed for verbal abuse via NLP (toxic-bert).
 * Text is NOT stored anywhere (privacy by design).
 */
app.post('/api/report-abuse', async (req, res) => {
  try {
    const { text, companyId, factoryId, workerId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing required field: text' });
    }

    const effectiveFactoryId = factoryId || companyId || 'unknown';

    // Call FastAPI NLP endpoint
    const response = await fetch(`${ML_API_URL}/analyze-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, factoryId: effectiveFactoryId, workerId }),
    });

    if (!response.ok) {
      throw new Error(`NLP API returned ${response.status}`);
    }

    const analysis = await response.json();

    console.log(`📝 Abuse report for ${effectiveFactoryId}: is_abusive=${analysis.is_abusive}, severity=${analysis.severity}`);

    // Snowflake: log abuse report metadata (fire-and-forget, no text stored)
    snowflake.insertAbuseReport({
      factoryId: effectiveFactoryId,
      workerId: workerId || 'anonymous',
      isAbusive: analysis.is_abusive,
      severity: parseFloat(analysis.severity),
      flaggedCategories: analysis.flagged_categories,
    }).catch(() => {});

    // If abusive, create a warning for frontend
    const warning = analysis.is_abusive ? {
      type: 'nlp_abuse',
      severity: parseFloat(analysis.severity) > 0.5 ? 'high' : 'medium',
      message: `Verbal abuse detected: ${analysis.flagged_categories.join(', ')}`,
      categories: analysis.flagged_categories,
      timestamp: Date.now(),
    } : null;

    // Return analysis (without the original text)
    res.json({
      success: true,
      analysis: {
        is_abusive: analysis.is_abusive,
        severity: analysis.severity,
        flagged_categories: analysis.flagged_categories,
        scores: analysis.scores,
      },
      warning, // Include warning if abusive
    });
  } catch (error) {
    console.error('Error analyzing text:', error.message);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/session-analysis/:companyId
 * Get AI-powered session analysis with health warnings
 *
 * WHAT IT DOES:
 * 1. Queries ALL sensor data from Snowflake database for the company
 * 2. Analyzes every reading to identify metrics outside safe ranges
 * 3. Uses Snowflake Cortex AI to generate specific health warnings
 * 4. Returns comprehensive health analysis with actionable recommendations
 *
 * Query Parameters:
 * - all=true: Analyze ALL data in database (default: true)
 * - hours=N: If all=false, analyze last N hours (default: 24)
 */
app.get('/api/session-analysis/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const useAllData = req.query.all !== 'false';
    const hoursBack = parseInt(req.query.hours) || 24;

    if (!companyId) {
      return res.status(400).json({ error: 'Missing companyId' });
    }

    if (!companies.has(companyId)) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const analysisType = useAllData ? 'ALL database data' : `last ${hoursBack} hours`;
    console.log(`📊 Generating session analysis for ${companyId} (${analysisType})`);

    const analysis = await snowflake.getSessionAnalysis(companyId, useAllData, hoursBack);

    res.json({
      success: true,
      companyId,
      analysis,
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error generating session analysis:', error);
    res.status(500).json({
      error: 'Failed to generate session analysis',
      message: error.message,
    });
  }
});

/**
 * POST /api/nlp-warnings/reset
 * Reset abuse report buffer (all or for one company). Use for testing or to clear stale warnings.
 * Body: { companyId?: string } — omit to clear all, or set to clear only that company.
 */
app.post('/api/nlp-warnings/reset', async (req, res) => {
  try {
    const { companyId } = req.body || {};
    await snowflake.resetAbuseReports(companyId || null);
    res.json({
      success: true,
      message: companyId ? `Abuse reports cleared for company ${companyId}` : 'Abuse report buffer cleared',
    });
  } catch (error) {
    console.error('Error resetting abuse reports:', error);
    res.status(500).json({
      error: 'Failed to reset abuse reports',
      message: error.message,
    });
  }
});

/**
 * GET /api/nlp-warnings/:companyId
 * Get recent NLP abuse warnings for a company
 */
app.get('/api/nlp-warnings/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    if (!companyId) {
      return res.status(400).json({ error: 'Missing companyId' });
    }

    const warnings = await snowflake.getNLPWarnings(companyId, limit);

    res.json({
      success: true,
      companyId,
      warnings,
      count: warnings.length,
    });
  } catch (error) {
    console.error('Error fetching NLP warnings:', error);
    res.status(500).json({
      error: 'Failed to fetch NLP warnings',
      message: error.message,
    });
  }
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
app.listen(PORT, async () => {
  console.log(`🚀 SafeShift Server running on http://localhost:${PORT}`);
  console.log(`💰 Main wallet: ${mainWallet.publicKey.toString()}`);
  console.log(`🌐 Network: ${network}`);
  console.log(`📡 Ready to receive sensor data from Arduino devices`);

  // Optional: reset abuse report buffer on startup (e.g. for testing)
  if (process.env.RESET_ABUSE_REPORTS_ON_STARTUP === '1' || process.env.RESET_ABUSE_REPORTS_ON_STARTUP === 'true') {
    try {
      await snowflake.resetAbuseReports();
      console.log('📋 Abuse report buffer reset on startup');
    } catch (e) {
      console.warn('Could not reset abuse reports on startup:', e.message);
    }
  }

  // Register demo company so Collect / rewards work out of the box (rewards go to main wallet)
  const demoAddress = walletConfig.address;
  if (!companies.has('demo-company')) {
    companies.set('demo-company', {
      id: 'demo-company',
      name: 'Demo Factory',
      walletAddress: demoAddress,
      deviceIds: ['arduino-001'],
      totalRewardsReceived: 0,
      lastRewardAt: null,
      registeredAt: Date.now(),
      isActive: true,
    });
    console.log(`✅ Demo company registered (wallet: ${demoAddress.slice(0, 8)}...${demoAddress.slice(-6)}) — ready for Collect / rewards`);
  }
});
