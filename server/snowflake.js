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
 */
async function getSessionAnalysis(companyId, useAllData = true, hoursBack = null) {
  if (!isEnabled()) {
    return { warnings: [], summary: 'Snowflake not configured' };
  }

  const conn = await getConnection();
  if (!conn) {
    return { warnings: [], summary: 'Snowflake connection failed' };
  }

  let sql;
  let binds;

  if (useAllData) {
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
      binds,
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

        const firstReading = rows[rows.length - 1];
        const lastReading = rows[0];
        const dateRange = useAllData
          ? `from ${new Date(firstReading.READING_TIMESTAMP).toLocaleDateString()} to ${new Date(lastReading.READING_TIMESTAMP).toLocaleDateString()}`
          : `last ${hoursBack || 24} hours`;

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

function analyzeBadScores(readings) {
  const badMetrics = [];
  const thresholds = {
    temperature: { min: 68, max: 76 },
    humidity: { min: 20, max: 60 },
    airQuality: { max: 1000 },
    noise: { max: 85 },
    lighting: { min: 300 },
  };

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
      if (reading.TEMPERATURE_F < thresholds.temperature.min || reading.TEMPERATURE_F > thresholds.temperature.max) stats.temperature.violations++;
    }
    if (reading.HUMIDITY_PCT != null) {
      stats.humidity.values.push(reading.HUMIDITY_PCT);
      if (reading.HUMIDITY_PCT < thresholds.humidity.min || reading.HUMIDITY_PCT > thresholds.humidity.max) stats.humidity.violations++;
    }
    if (reading.CO2_PPM != null) {
      stats.airQuality.values.push(reading.CO2_PPM);
      if (reading.CO2_PPM > thresholds.airQuality.max) stats.airQuality.violations++;
    }
    if (reading.NOISE_DBA != null) {
      stats.noise.values.push(reading.NOISE_DBA);
      if (reading.NOISE_DBA > thresholds.noise.max) stats.noise.violations++;
    }
    if (reading.LIGHT_LUX != null) {
      stats.lighting.values.push(reading.LIGHT_LUX);
      if (reading.LIGHT_LUX < thresholds.lighting.min) stats.lighting.violations++;
    }
  });

  const violationThreshold = readings.length * 0.1;
  const metricDefs = [
    { key: 'temperature', unit: '°F', threshold: `${thresholds.temperature.min}-${thresholds.temperature.max}°F` },
    { key: 'humidity', unit: '%', threshold: `${thresholds.humidity.min}-${thresholds.humidity.max}%` },
    { key: 'airQuality', unit: 'ppm CO₂', threshold: `<${thresholds.airQuality.max} ppm` },
    { key: 'noise', unit: 'dBA', threshold: `<${thresholds.noise.max} dBA` },
    { key: 'lighting', unit: 'lux', threshold: `>${thresholds.lighting.min} lux` },
  ];

  for (const def of metricDefs) {
    const s = stats[def.key];
    if (s.violations > violationThreshold && s.values.length > 0) {
      const avg = s.values.reduce((a, b) => a + b, 0) / s.values.length;
      const t = thresholds[def.key];
      badMetrics.push({
        metric: def.key,
        value: avg,
        unit: def.unit,
        threshold: def.threshold,
        violationRate: (s.violations / readings.length * 100).toFixed(1),
        isHigh: t.max != null && avg > t.max,
        isLow: t.min != null && avg < t.min,
      });
    }
  }

  return badMetrics;
}

async function generateCortexWarnings(conn, badMetrics, companyId) {
  const warnings = [];

  for (const metric of badMetrics) {
    const metricName = metric.metric === 'airQuality' ? 'air quality (CO2 levels)' : metric.metric;
    const condition = metric.isHigh
      ? `very high (${metric.value.toFixed(1)} ${metric.unit}, safe range: ${metric.threshold})`
      : `very low (${metric.value.toFixed(1)} ${metric.unit}, safe range: ${metric.threshold})`;

    const prompt = `You are a factory safety and occupational health expert. A factory monitoring system detected that ${metricName} was ${condition} during a work session. ${metric.violationRate}% of readings were outside safe ranges. Generate a concise health warning (2-3 sentences) explaining: 1. What health risks this poses to workers 2. Specific health conditions it can lead to 3. One actionable recommendation. Be specific about health impacts.`;

    const sql = `SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', ?) AS ai_warning`;

    try {
      const result = await new Promise((resolve) => {
        conn.execute({
          sqlText: sql,
          binds: [prompt],
          complete: (err, stmt, rows) => {
            if (err) resolve({ AI_WARNING: generateFallbackWarning(metric) });
            else resolve(rows[0]);
          },
        });
      });

      warnings.push({
        metric: metric.metric, metricName, value: metric.value, unit: metric.unit,
        threshold: metric.threshold, violationRate: metric.violationRate,
        warning: result.AI_WARNING || generateFallbackWarning(metric),
        severity: metric.violationRate > 50 ? 'high' : 'medium',
      });
    } catch {
      warnings.push({
        metric: metric.metric, metricName, value: metric.value, unit: metric.unit,
        threshold: metric.threshold, violationRate: metric.violationRate,
        warning: generateFallbackWarning(metric),
        severity: metric.violationRate > 50 ? 'high' : 'medium',
      });
    }
  }
  return warnings;
}

function generateFallbackWarning(metric) {
  const w = {
    temperature: {
      high: 'High temperatures can lead to heat stress, dehydration, and cardiovascular strain. Immediate action: Ensure adequate ventilation and hydration breaks.',
      low: 'Low temperatures can cause hypothermia and reduced dexterity. Immediate action: Provide heated work areas and warm-up breaks.',
    },
    humidity: {
      high: 'High humidity prevents effective cooling through sweating. Immediate action: Improve ventilation and use dehumidifiers.',
      low: 'Low humidity can cause dry skin and respiratory discomfort. Immediate action: Use humidifiers and ensure adequate hydration.',
    },
    airQuality: { high: 'Elevated CO2 levels can cause headaches, fatigue, and reduced cognitive function. Immediate action: Improve ventilation and check HVAC systems.' },
    noise: { high: 'Excessive noise can lead to permanent hearing loss and stress. Immediate action: Provide hearing protection and reduce noise sources.' },
    lighting: { low: 'Insufficient lighting causes eye strain and increased accident risk. Immediate action: Increase lighting levels and ensure proper task lighting.' },
  };
  const key = metric.metric === 'airQuality' ? 'airQuality' : metric.metric;
  return w[key]?.[metric.isHigh ? 'high' : 'low'] || 'This condition may pose health risks. Please review safety guidelines.';
}

/**
 * Get recent NLP abuse warnings for a company
 */
async function getNLPWarnings(companyId, limit = 10) {
  if (!isEnabled()) return [];

  const conn = await getConnection();
  if (!conn) return [];

  const sql = `
    SELECT
      created_at as report_timestamp,
      is_abusive,
      severity,
      flagged_categories
    FROM GOVERNANCE.ABUSE_REPORTS
    WHERE factory_id = ?
      AND is_abusive = TRUE
    ORDER BY created_at DESC
    LIMIT ?
  `;

  return new Promise((resolve) => {
    conn.execute({
      sqlText: sql,
      binds: [companyId, limit],
      complete: (err, stmt, rows) => {
        if (err) {
          console.warn('Snowflake getNLPWarnings failed:', err.message);
          resolve([]);
          return;
        }
        const warnings = rows.map(row => {
          const categories = row.FLAGGED_CATEGORIES ? row.FLAGGED_CATEGORIES.split(',') : [];
          return {
            timestamp: new Date(row.REPORT_TIMESTAMP).getTime(),
            severity: row.SEVERITY > 0.5 ? 'high' : 'medium',
            categories,
            message: `Verbal abuse detected: ${categories.join(', ')}`,
          };
        });
        resolve(warnings);
      },
    });
  }).catch(() => []);
}

/**
 * Reset abuse report buffer (for testing or to clear stale warnings).
 * If companyId is provided, deletes only that company's reports; otherwise truncates the table.
 */
async function resetAbuseReports(companyId = null) {
  if (!isEnabled()) return;

  const conn = await getConnection();
  if (!conn) return;

  const sql = companyId
    ? `DELETE FROM GOVERNANCE.ABUSE_REPORTS WHERE factory_id = ?`
    : `TRUNCATE TABLE IF EXISTS GOVERNANCE.ABUSE_REPORTS`;
  const binds = companyId ? [companyId] : [];

  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err) => {
        if (err) {
          console.warn('Snowflake resetAbuseReports failed:', err.message);
          reject(err);
        } else resolve();
      },
    });
  });
}

module.exports = {
  isEnabled,
  insertRawReading,
  insertMLRiskScore,
  insertRewardPayout,
  insertAbuseReport,
  getNLPWarnings,
  resetAbuseReports,
  getSessionAnalysis,
};
