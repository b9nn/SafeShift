-- ============================================================================
-- SafeShift Snowflake — Verify Bridge Data
-- ============================================================================
-- Run this in Snowflake after sending sensor data through Express.
-- Checks that RAW readings, ML risk scores, and reward payouts landed.
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE WAREHOUSE INGEST_WH;
USE SCHEMA RAW;

-- 1. Raw sensor readings (from Express → Snowflake)
SELECT 'RAW.SENSOR_READINGS_RAW' AS table_name, COUNT(*) AS row_count
FROM RAW.SENSOR_READINGS_RAW;

SELECT * FROM RAW.SENSOR_READINGS_RAW
ORDER BY ingestion_timestamp DESC
LIMIT 10;

-- 2. ML risk scores (from Express after ML API call)
SELECT 'RAW.ML_RISK_SCORES' AS table_name, COUNT(*) AS row_count
FROM RAW.ML_RISK_SCORES;

SELECT * FROM RAW.ML_RISK_SCORES
ORDER BY created_at DESC
LIMIT 10;

-- 3. Reward payouts (from Express after Solana tx)
USE SCHEMA BLOCKCHAIN;

SELECT 'BLOCKCHAIN.REWARD_PAYOUTS' AS table_name, COUNT(*) AS row_count
FROM BLOCKCHAIN.REWARD_PAYOUTS;

SELECT factory_id, solana_tx_hash, payout_status, created_at
FROM BLOCKCHAIN.REWARD_PAYOUTS
ORDER BY created_at DESC
LIMIT 10;
