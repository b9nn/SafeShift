/**
 * Snowflake integration for SafeShift
 * Writes raw readings, ML risk scores, and reward payouts.
 *
 * Env vars: SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD,
 *           SNOWFLAKE_DATABASE (default: SAFE_SHIFT), SNOWFLAKE_WAREHOUSE (default: INGEST_WH)
 */

const snowflake = require('snowflake-sdk');

let connectionPromise = null;
let enabled = false;

function getConnection() {
  const account = process.env.SNOWFLAKE_ACCOUNT;
  const user = process.env.SNOWFLAKE_USER;
  const password = process.env.SNOWFLAKE_PASSWORD;
  if (!account || !user || !password) return Promise.resolve(null);

  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise((resolve) => {
    const conn = snowflake.createConnection({
      account,
      username: user,
      password,
      database: process.env.SNOWFLAKE_DATABASE || 'SAFE_SHIFT',
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'INGEST_WH',
      schema: 'RAW',
    });
    conn.connect((err) => {
      if (err) {
        console.warn('⚠️  Snowflake connection failed:', err.message);
        enabled = false;
        resolve(null);
        return;
      }
      enabled = true;
      resolve(conn);
    });
  });
  return connectionPromise;
}

function isEnabled() {
  return !!(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USER && process.env.SNOWFLAKE_PASSWORD);
}

/**
 * Insert raw sensor reading into RAW.SENSOR_READINGS_RAW
 */
async function insertRawReading({ factoryId, sensorNodeId, timestamp, metrics, rawPayload }) {
  if (!isEnabled()) return;
  const conn = await getConnection();
  if (!conn) return;
  const tempF = metrics.temperature ?? null;
  const humidity = metrics.humidity ?? null;
  const co2 = metrics.airQuality ?? null;
  const noise = metrics.noise ?? null;
  const light = metrics.lighting ?? null;
  const vibration = metrics.vibration ?? null;
  const pressureKpa = metrics.pressure != null ? metrics.pressure / 10 : null; // hPa → kPa (1013 hPa ≈ 101.3 kPa)
  const ts = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
  const payload = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload || {});

  const sql = `
    INSERT INTO RAW.SENSOR_READINGS_RAW (
      factory_id, sensor_node_id, reading_timestamp,
      temperature_f, humidity_pct, co2_ppm, pm25_mg_m3, pm10_mg_m3, voc_mg_m3,
      noise_dba, light_lux, vibration_ms2, proximity_value, pressure_kpa,
      raw_payload
    )
    SELECT ?, ?, ?::TIMESTAMP_NTZ,
      ?, ?, ?, NULL, NULL, NULL,
      ?, ?, ?, NULL, ?,
      PARSE_JSON(?)
  `;
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds: [factoryId, sensorNodeId, ts, tempF, humidity, co2, noise, light, vibration, pressureKpa, payload],
      complete: (err, stmt, rows) => {
        if (err) {
          console.warn('Snowflake insertRawReading failed:', err.message);
          reject(err);
        } else resolve(rows);
      },
    });
  }).catch(() => {});
}

/**
 * Insert ML risk score into RAW.ML_RISK_SCORES (run snowflake/10_ml_risk_scores.sql first)
 */
async function insertMLRiskScore({ factoryId, sensorNodeId, timestamp, riskScore, confidence }) {
  if (!isEnabled()) return;
  const conn = await getConnection();
  if (!conn) return;
  const ts = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

  const sql = `
    INSERT INTO RAW.ML_RISK_SCORES (
      factory_id, sensor_node_id, score_timestamp, risk_score, confidence
    ) VALUES (?, ?, ?::TIMESTAMP_NTZ, ?::FLOAT, ?::FLOAT)
  `;
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds: [factoryId, sensorNodeId, ts, parseFloat(riskScore), parseFloat(confidence)],
      complete: (err) => {
        if (err) {
          console.warn('Snowflake insertMLRiskScore failed (table may not exist):', err.message);
          resolve(); // Non-fatal
        } else resolve();
      },
    });
  }).catch(() => {});
}

/**
 * Insert reward payout into BLOCKCHAIN.REWARD_PAYOUTS
 */
async function insertRewardPayout({ factoryId, solanaTxHash, rewardAmountSOL, riskScore }) {
  if (!isEnabled()) return;
  const conn = await getConnection();
  if (!conn) return;

  const sql = `
    INSERT INTO BLOCKCHAIN.REWARD_PAYOUTS (
      factory_id, payout_date, reward_type, reward_amount_usd, solana_tx_hash,
      solana_slot, compliance_period, avg_compliance_score, payout_status
    ) VALUES (?, CURRENT_DATE(), 'SOL', NULL, ?, NULL, ?, ?, 'CONFIRMED')
  `;
  const compliancePeriod = `W${getWeekNumber(new Date())}`;
  const complianceScore = riskScore != null ? (1 - riskScore) * 100 : null;

  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds: [factoryId, solanaTxHash, compliancePeriod, complianceScore],
      complete: (err) => {
        if (err) {
          console.warn('Snowflake insertRewardPayout failed:', err.message);
          reject(err);
        } else resolve();
      },
    });
  }).catch(() => {});
}

/**
 * Insert abuse report metadata into GOVERNANCE.ABUSE_REPORTS
 * No text is stored — only the analysis results (privacy by design).
 */
let abuseTableCreated = false;
async function insertAbuseReport({ factoryId, workerId, isAbusive, severity, flaggedCategories }) {
  if (!isEnabled()) return;
  const conn = await getConnection();
  if (!conn) return;

  // Create table on first use (idempotent)
  if (!abuseTableCreated) {
    await new Promise((resolve) => {
      conn.execute({
        sqlText: `
          CREATE TABLE IF NOT EXISTS GOVERNANCE.ABUSE_REPORTS (
            report_id NUMBER AUTOINCREMENT,
            factory_id VARCHAR(100),
            worker_id VARCHAR(100) DEFAULT 'anonymous',
            is_abusive BOOLEAN,
            severity FLOAT,
            flagged_categories VARCHAR(500),
            created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
          )
        `,
        complete: (err) => {
          if (!err) abuseTableCreated = true;
          resolve();
        },
      });
    });
  }

  const categories = Array.isArray(flaggedCategories) ? flaggedCategories.join(',') : '';

  const sql = `
    INSERT INTO GOVERNANCE.ABUSE_REPORTS (
      factory_id, worker_id, is_abusive, severity, flagged_categories
    ) VALUES (?, ?, ?, ?::FLOAT, ?)
  `;
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds: [factoryId, workerId, isAbusive, severity, categories],
      complete: (err) => {
        if (err) {
          console.warn('Snowflake insertAbuseReport failed:', err.message);
          reject(err);
        } else resolve();
      },
    });
  }).catch(() => {});
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Get session data and generate AI health warnings using Snowflake Cortex
 * 
 * WHAT IT DOES:
 * 1. Queries ALL sensor readings from Snowflake database for the company
 * 2. Analyzes every reading to find metrics outside safe ranges
 * 3. Calculates violation rates and average values for each metric
 * 4. Uses Snowflake Cortex AI (COMPLETE function) to generate specific health warnings
 * 5. Returns warnings explaining health risks (e.g., "high temperature can lead to heart disease")
 * 
 * This provides a comprehensive end-of-session health analysis using the FULL database.
 */
async function getSessionAnalysis(companyId, useAllData = true, hoursBack = null) {
  if (!isEnabled()) {
    return { warnings: [], summary: 'Snowflake not configured' };
  }
  
  const conn = await getConnection();
  if (!conn) {
    return { warnings: [], summary: 'Snowflake connection failed' };
  }

  // Build SQL query - use ALL data if useAllData is true, otherwise filter by time
  let sql;
  let binds;
  
  if (useAllData) {
    // Query ALL data from database (no time limit)
    sql = `
      SELECT 
        reading_timestamp,
        temperature_f,
        humidity_pct,
        co2_ppm,
        noise_dba,
        light_lux,
        pressure_kpa
      FROM RAW.SENSOR_READINGS_RAW
      WHERE factory_id = ?
      ORDER BY reading_timestamp DESC
    `;
    binds = [companyId];
  } else {
    // Query data from specific time period
    const startTime = new Date(Date.now() - (hoursBack || 24) * 60 * 60 * 1000).toISOString();
    sql = `
      SELECT 
        reading_timestamp,
        temperature_f,
        humidity_pct,
        co2_ppm,
        noise_dba,
        light_lux,
        pressure_kpa
      FROM RAW.SENSOR_READINGS_RAW
      WHERE factory_id = ?
        AND reading_timestamp >= ?::TIMESTAMP_NTZ
      ORDER BY reading_timestamp DESC
      LIMIT 1000
    `;
    binds = [companyId, startTime];
  }

  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds: [companyId, startTime],
      complete: async (err, stmt, rows) => {
        if (err) {
          console.warn('Snowflake getSessionAnalysis failed:', err.message);
          reject(err);
          return;
        }

        if (rows.length === 0) {
          resolve({ 
            warnings: [], 
            summary: 'No data found in database for this company',
            totalReadings: 0
          });
          return;
        }

        // Get date range of data
        const firstReading = rows[rows.length - 1];
        const lastReading = rows[0];
        const dateRange = useAllData 
          ? `from ${new Date(firstReading.READING_TIMESTAMP).toLocaleDateString()} to ${new Date(lastReading.READING_TIMESTAMP).toLocaleDateString()}`
          : `last ${hoursBack || 24} hours`;

        // Analyze ALL data to find bad scores
        const badMetrics = analyzeBadScores(rows);
        
        if (badMetrics.length === 0) {
          resolve({ 
            warnings: [], 
            summary: `All metrics within safe ranges! Great job maintaining safe working conditions.`,
            totalReadings: rows.length,
            dateRange: useAllData ? dateRange : undefined,
            analyzedAllData: useAllData
          });
          return;
        }

        // Generate AI warnings using Cortex for each bad metric
        const warnings = await generateCortexWarnings(conn, badMetrics, companyId);
        
        resolve({
          warnings,
          summary: `Analyzed ${rows.length} readings ${dateRange}. Found ${badMetrics.length} metric(s) with safety concerns.`,
          totalReadings: rows.length,
          dateRange: useAllData ? dateRange : undefined,
          analyzedAllData: useAllData,
          sessionPeriod: useAllData ? 'All historical data' : `${hoursBack || 24} hours`,
        });
      },
    });
  }).catch(() => ({ warnings: [], summary: 'Error analyzing session data' }));
}

/**
 * Analyze sensor readings to identify bad scores
 */
function analyzeBadScores(readings) {
  const badMetrics = [];
  
  // Safety thresholds (from config/safety_thresholds.json)
  const thresholds = {
    temperature: { min: 68, max: 76, idealMin: 65, idealMax: 80 },
    humidity: { min: 20, max: 60 },
    airQuality: { max: 1000 }, // CO2 ppm
    noise: { max: 85 },
    lighting: { min: 300 },
  };

  // Calculate averages and find violations
  const stats = {
    temperature: { values: [], violations: 0 },
    humidity: { values: [], violations: 0 },
    airQuality: { values: [], violations: 0 },
    noise: { values: [], violations: 0 },
    lighting: { values: [], violations: 0 },
  };

  readings.forEach(reading => {
    if (reading.TEMPERATURE_F != null) {
      stats.temperature.values.push(reading.TEMPERATURE_F);
      if (reading.TEMPERATURE_F < thresholds.temperature.min || reading.TEMPERATURE_F > thresholds.temperature.max) {
        stats.temperature.violations++;
      }
    }
    if (reading.HUMIDITY_PCT != null) {
      stats.humidity.values.push(reading.HUMIDITY_PCT);
      if (reading.HUMIDITY_PCT < thresholds.humidity.min || reading.HUMIDITY_PCT > thresholds.humidity.max) {
        stats.humidity.violations++;
      }
    }
    if (reading.CO2_PPM != null) {
      stats.airQuality.values.push(reading.CO2_PPM);
      if (reading.CO2_PPM > thresholds.airQuality.max) {
        stats.airQuality.violations++;
      }
    }
    if (reading.NOISE_DBA != null) {
      stats.noise.values.push(reading.NOISE_DBA);
      if (reading.NOISE_DBA > thresholds.noise.max) {
        stats.noise.violations++;
      }
    }
    if (reading.LIGHT_LUX != null) {
      stats.lighting.values.push(reading.LIGHT_LUX);
      if (reading.LIGHT_LUX < thresholds.lighting.min) {
        stats.lighting.violations++;
      }
    }
  });

  // Identify metrics with significant violations (>10% of readings)
  const violationThreshold = readings.length * 0.1;

  if (stats.temperature.violations > violationThreshold) {
    const avg = stats.temperature.values.reduce((a, b) => a + b, 0) / stats.temperature.values.length;
    badMetrics.push({
      metric: 'temperature',
      value: avg,
      unit: '°F',
      threshold: `${thresholds.temperature.min}-${thresholds.temperature.max}°F`,
      violationRate: (stats.temperature.violations / readings.length * 100).toFixed(1),
      isHigh: avg > thresholds.temperature.max,
      isLow: avg < thresholds.temperature.min,
    });
  }

  if (stats.humidity.violations > violationThreshold) {
    const avg = stats.humidity.values.reduce((a, b) => a + b, 0) / stats.humidity.values.length;
    badMetrics.push({
      metric: 'humidity',
      value: avg,
      unit: '%',
      threshold: `${thresholds.humidity.min}-${thresholds.humidity.max}%`,
      violationRate: (stats.humidity.violations / readings.length * 100).toFixed(1),
      isHigh: avg > thresholds.humidity.max,
      isLow: avg < thresholds.humidity.min,
    });
  }

  if (stats.airQuality.violations > violationThreshold) {
    const avg = stats.airQuality.values.reduce((a, b) => a + b, 0) / stats.airQuality.values.length;
    badMetrics.push({
      metric: 'airQuality',
      value: avg,
      unit: 'ppm CO₂',
      threshold: `<${thresholds.airQuality.max} ppm`,
      violationRate: (stats.airQuality.violations / readings.length * 100).toFixed(1),
      isHigh: true,
    });
  }

  if (stats.noise.violations > violationThreshold) {
    const avg = stats.noise.values.reduce((a, b) => a + b, 0) / stats.noise.values.length;
    badMetrics.push({
      metric: 'noise',
      value: avg,
      unit: 'dBA',
      threshold: `<${thresholds.noise.max} dBA`,
      violationRate: (stats.noise.violations / readings.length * 100).toFixed(1),
      isHigh: true,
    });
  }

  if (stats.lighting.violations > violationThreshold) {
    const avg = stats.lighting.values.reduce((a, b) => a + b, 0) / stats.lighting.values.length;
    badMetrics.push({
      metric: 'lighting',
      value: avg,
      unit: 'lux',
      threshold: `>${thresholds.lighting.min} lux`,
      violationRate: (stats.lighting.violations / readings.length * 100).toFixed(1),
      isLow: true,
    });
  }

  return badMetrics;
}

/**
 * Generate AI health warnings using Snowflake Cortex COMPLETE
 */
async function generateCortexWarnings(conn, badMetrics, companyId) {
  const warnings = [];

  for (const metric of badMetrics) {
    const metricName = metric.metric === 'airQuality' ? 'air quality (CO2 levels)' : metric.metric;
    const condition = metric.isHigh 
      ? `very high (${metric.value.toFixed(1)} ${metric.unit}, safe range: ${metric.threshold})`
      : `very low (${metric.value.toFixed(1)} ${metric.unit}, safe range: ${metric.threshold})`;
    
    const prompt = `You are a factory safety and occupational health expert. 
A factory monitoring system detected that ${metricName} was ${condition} during a work session.
${metric.violationRate}% of readings were outside safe ranges.

Generate a concise health warning (2-3 sentences) explaining:
1. What health risks this condition poses to workers
2. Specific health conditions it can lead to (e.g., heat stroke, respiratory issues, hearing loss, etc.)
3. One actionable recommendation

Be specific about health impacts. For example, if temperature is high, mention heat stress, dehydration, cardiovascular strain, etc.
If air quality is poor, mention respiratory issues, headaches, reduced cognitive function.
If noise is high, mention hearing loss, stress, cardiovascular issues.
If lighting is low, mention eye strain, accidents, fatigue.

Format as a clear, professional warning.`;

    const sql = `
      SELECT SNOWFLAKE.CORTEX.COMPLETE(
        'mistral-large2',
        ?
      ) AS ai_warning
    `;

    try {
      const result = await new Promise((resolve, reject) => {
        conn.execute({
          sqlText: sql,
          binds: [prompt],
          complete: (err, stmt, rows) => {
            if (err) {
              // Fallback if Cortex is not available
              resolve({ AI_WARNING: generateFallbackWarning(metric) });
            } else {
              resolve(rows[0]);
            }
          },
        });
      });

      warnings.push({
        metric: metric.metric,
        metricName: metricName,
        value: metric.value,
        unit: metric.unit,
        threshold: metric.threshold,
        violationRate: metric.violationRate,
        warning: result.AI_WARNING || generateFallbackWarning(metric),
        severity: metric.violationRate > 50 ? 'high' : 'medium',
      });
    } catch (error) {
      // Fallback warning if Cortex fails
      warnings.push({
        metric: metric.metric,
        metricName: metricName,
        value: metric.value,
        unit: metric.unit,
        threshold: metric.threshold,
        violationRate: metric.violationRate,
        warning: generateFallbackWarning(metric),
        severity: metric.violationRate > 50 ? 'high' : 'medium',
      });
    }
  }

  return warnings;
}

/**
 * Fallback warning generator if Cortex is unavailable
 */
function generateFallbackWarning(metric) {
  const warnings = {
    temperature: {
      high: 'High temperatures can lead to heat stress, dehydration, and cardiovascular strain. Prolonged exposure increases risk of heat exhaustion, heat stroke, and can exacerbate existing heart conditions. Immediate action: Ensure adequate ventilation, provide cool rest areas, and implement frequent hydration breaks.',
      low: 'Low temperatures can cause hypothermia, reduced dexterity, and increased risk of accidents. Cold stress can lead to numbness, frostbite, and cardiovascular issues. Immediate action: Provide heated work areas, ensure proper insulation, and allow warm-up breaks.',
    },
    humidity: {
      high: 'High humidity combined with heat can prevent effective cooling through sweating, leading to heat-related illnesses. It can also promote mold growth and respiratory issues. Immediate action: Improve ventilation and use dehumidifiers.',
      low: 'Low humidity can cause dry skin, eye irritation, and respiratory discomfort. It can also increase susceptibility to respiratory infections. Immediate action: Use humidifiers and ensure adequate hydration.',
    },
    airQuality: {
      high: 'Elevated CO2 levels can cause headaches, dizziness, fatigue, and reduced cognitive function. Prolonged exposure may lead to respiratory issues and cardiovascular strain. Immediate action: Improve ventilation, check HVAC systems, and consider air quality monitoring.',
    },
    noise: {
      high: 'Excessive noise exposure can lead to permanent hearing loss, tinnitus, and increased stress levels. It can also cause cardiovascular issues, sleep disturbances, and reduced concentration. Immediate action: Provide hearing protection, reduce noise sources, and implement engineering controls.',
    },
    lighting: {
      low: 'Insufficient lighting can cause eye strain, headaches, and increased risk of accidents. Poor visibility can lead to musculoskeletal issues from awkward postures and reduced productivity. Immediate action: Increase lighting levels, ensure proper task lighting, and reduce glare.',
    },
  };

  const key = metric.metric === 'airQuality' ? 'airQuality' : metric.metric;
  const type = metric.isHigh ? 'high' : 'low';
  
  return warnings[key]?.[type] || `This condition may pose health risks. Please review safety guidelines.`;
}

module.exports = {
  isEnabled,
  insertRawReading,
  insertMLRiskScore,
  insertRewardPayout,
  insertAbuseReport,
  getSessionAnalysis,
};
