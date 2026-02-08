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
 * Get recent NLP abuse warnings for a company
 */
async function getNLPWarnings(companyId, limit = 10) {
  if (!isEnabled()) {
    return [];
  }
  
  const conn = await getConnection();
  if (!conn) {
    return [];
  }

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

  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds: [companyId, limit],
      complete: (err, stmt, rows) => {
        if (err) {
          console.warn('Snowflake getNLPWarnings failed:', err.message);
          resolve([]); // Return empty array on error
          return;
        }

        const warnings = rows.map(row => {
          const categories = row.FLAGGED_CATEGORIES ? row.FLAGGED_CATEGORIES.split(',') : [];
          return {
            timestamp: new Date(row.REPORT_TIMESTAMP).getTime(),
            severity: row.SEVERITY > 0.5 ? 'high' : 'medium',
            categories: categories,
            message: `Verbal abuse detected: ${categories.join(', ')}`,
          };
        });

        resolve(warnings);
      },
    });
  }).catch(() => []);
}

module.exports = {
  isEnabled,
  insertRawReading,
  insertMLRiskScore,
  insertRewardPayout,
  insertAbuseReport,
  getNLPWarnings,
};
