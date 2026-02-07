-- ============================================================================
-- SafeShift Snowflake — Real-time ML Risk Scores Table
-- ============================================================================
-- Stores risk scores from the FastAPI ML API (real-time inference).
-- Express server inserts here after calling POST /predict.
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE WAREHOUSE INGEST_WH;
USE SCHEMA RAW;

CREATE TABLE IF NOT EXISTS ML_RISK_SCORES (
    score_id         NUMBER AUTOINCREMENT,
    factory_id       VARCHAR(50),
    sensor_node_id   VARCHAR(50),
    score_timestamp  TIMESTAMP_NTZ,
    risk_score       FLOAT        COMMENT '0.0-1.0 from ML API',
    confidence       FLOAT        COMMENT '0.0-1.0 from ML API',
    created_at       TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (factory_id, score_timestamp)
    COMMENT = 'Real-time ML risk scores from FastAPI inference server';
