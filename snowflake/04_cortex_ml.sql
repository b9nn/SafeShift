-- ============================================================================
-- SafeShift Snowflake Database — Snowflake Cortex ML & AI
-- ============================================================================
-- Snowflake Cortex features used:
--   - CORTEX.ANOMALY_DETECTION       (detect unsafe sensor patterns)
--   - CORTEX.FORECAST                (predict future conditions)
--   - CORTEX.COMPLETE (LLM)          (generate human-readable reports)
--   - CORTEX.SUMMARIZE               (summarize incident descriptions)
--   - CORTEX.SENTIMENT               (analyze incident sentiment)
--   - CORTEX.TRANSLATE               (translate multilingual data)
--   - CORTEX.EXTRACT_ANSWER          (extract facts from text)
--   - CORTEX.CLASSIFY_TEXT           (classify risk categories)
--   - Cortex ML Contribution Explorer
--   - Cortex ML Top Insights
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE SCHEMA ML;
USE WAREHOUSE CORTEX_WH;

-- =====================================================================
-- 1. ANOMALY DETECTION — Detect unsafe environmental patterns
-- =====================================================================
-- Train an anomaly detection model on historical sensor data
-- This is the core ML use case for SafeShift

-- Create training view with time-series sensor data
-- Training view aligned with Arduino Nano 33 BLE Sense sensors:
-- HTS221 (temp/humidity), LPS22HB (pressure), APDS-9960 (light),
-- LSM9DS1 (vibration proxy), MP34DT05 (noise proxy)
CREATE OR REPLACE VIEW V_ANOMALY_TRAINING_DATA AS
    SELECT
        reading_timestamp,
        factory_id,
        temperature_c,
        humidity_pct,
        pressure_kpa,
        light_lux,
        noise_dba,
        vibration_ms2
    FROM STAGING.SENSOR_READINGS_CLEAN
    WHERE is_valid = TRUE
    ORDER BY reading_timestamp;

-- Build anomaly detection model on sensor readings
-- Uses Snowflake's built-in anomaly detection (unsupervised)
CREATE OR REPLACE SNOWFLAKE.ML.ANOMALY_DETECTION SENSOR_ANOMALY_MODEL(
    INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'V_ANOMALY_TRAINING_DATA'),
    SERIES_COLNAME => 'FACTORY_ID',
    TIMESTAMP_COLNAME => 'READING_TIMESTAMP',
    TARGET_COLNAME => 'TEMPERATURE_C',
    LABEL_COLNAME => ''
)
COMMENT = 'Anomaly detection model for temperature per factory — flags abnormal readings';

-- Create a model for temperature anomalies
CREATE OR REPLACE SNOWFLAKE.ML.ANOMALY_DETECTION TEMP_ANOMALY_MODEL(
    INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'V_ANOMALY_TRAINING_DATA'),
    SERIES_COLNAME => 'FACTORY_ID',
    TIMESTAMP_COLNAME => 'READING_TIMESTAMP',
    TARGET_COLNAME => 'TEMPERATURE_C',
    LABEL_COLNAME => ''
)
COMMENT = 'Anomaly detection model for temperature per factory';

-- Run anomaly detection and store results
CREATE OR REPLACE TABLE ANOMALY_RESULTS AS
    SELECT *
    FROM TABLE(
        SENSOR_ANOMALY_MODEL!DETECT_ANOMALIES(
            INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'V_ANOMALY_TRAINING_DATA'),
            SERIES_COLNAME => 'FACTORY_ID',
            TIMESTAMP_COLNAME => 'READING_TIMESTAMP',
            TARGET_COLNAME => 'TEMPERATURE_C'
        )
    );

-- =====================================================================
-- 2. FORECASTING — Predict future conditions
-- =====================================================================
-- Forecast sensor readings to proactively identify upcoming risks

CREATE OR REPLACE SNOWFLAKE.ML.FORECAST SENSOR_FORECAST_MODEL(
    INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'V_ANOMALY_TRAINING_DATA'),
    SERIES_COLNAME => 'FACTORY_ID',
    TIMESTAMP_COLNAME => 'READING_TIMESTAMP',
    TARGET_COLNAME => 'TEMPERATURE_C'
)
COMMENT = 'Forecasting model for temperature — predicts next 24-48 hours';

-- Generate 24-hour forecast
CREATE OR REPLACE TABLE TEMP_FORECAST_RESULTS AS
    SELECT *
    FROM TABLE(
        SENSOR_FORECAST_MODEL!FORECAST(
            FORECASTING_PERIODS => 24,
            SERIES_COLNAME => 'FACTORY_ID'
        )
    );

-- Forecast temperature
CREATE OR REPLACE SNOWFLAKE.ML.FORECAST TEMP_FORECAST_MODEL(
    INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'V_ANOMALY_TRAINING_DATA'),
    SERIES_COLNAME => 'FACTORY_ID',
    TIMESTAMP_COLNAME => 'READING_TIMESTAMP',
    TARGET_COLNAME => 'TEMPERATURE_C'
)
COMMENT = 'Forecasting model for temperature — early warning system';

-- =====================================================================
-- 3. CONTRIBUTION EXPLORER — Understand what drives anomalies
-- =====================================================================
-- Identify which factors contribute most to compliance score changes

CREATE OR REPLACE VIEW V_CONTRIBUTION_DATA AS
    SELECT
        compliance_date,
        factory_id,
        avg_compliance_score AS metric,
        total_breaches,
        -- Dimensional attributes for contribution analysis
        f.country,
        f.industry_sector,
        f.region
    FROM ANALYTICS.FACT_DAILY_COMPLIANCE dc
    JOIN ANALYTICS.DIM_FACTORY f ON dc.factory_id = f.factory_id;

CREATE OR REPLACE SNOWFLAKE.ML.CONTRIBUTION_EXPLORER COMPLIANCE_DRIVERS(
    INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'V_CONTRIBUTION_DATA'),
    LABEL_COLNAME => 'METRIC',
    TIMESTAMP_COLNAME => 'COMPLIANCE_DATE',
    SERIES_COLNAME => 'FACTORY_ID'
)
COMMENT = 'Identifies which dimensions drive compliance score changes';

-- =====================================================================
-- 4. TOP INSIGHTS — Automated insight discovery
-- =====================================================================

CREATE OR REPLACE SNOWFLAKE.ML.TOP_INSIGHTS COMPLIANCE_INSIGHTS(
    INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'V_CONTRIBUTION_DATA'),
    LABEL_COLNAME => 'METRIC',
    METRIC => 'AVG'
)
COMMENT = 'Discovers top insights in compliance score patterns';

-- =====================================================================
-- 5. CORTEX LLM FUNCTIONS — AI-powered text analysis & generation
-- =====================================================================

-- ---- 5a. COMPLETE: Generate human-readable compliance reports ----
CREATE OR REPLACE VIEW V_CORTEX_COMPLIANCE_REPORTS AS
    SELECT
        dc.factory_id,
        dc.compliance_date,
        dc.avg_compliance_score,
        dc.total_breaches,
        dc.risk_level,
        dc.breach_breakdown,
        SNOWFLAKE.CORTEX.COMPLETE(
            'mistral-large2',
            CONCAT(
                'You are a factory safety compliance analyst for SafeShift. ',
                'Generate a concise, professional compliance report summary based on this data. ',
                'Include risk assessment and actionable recommendations. ',
                'Factory: ', dc.factory_id,
                ', Date: ', dc.compliance_date::VARCHAR,
                ', Compliance Score: ', dc.avg_compliance_score::VARCHAR, '/100',
                ', Risk Level: ', dc.risk_level,
                ', Total Breaches: ', dc.total_breaches::VARCHAR,
                ', Breach Details: ', dc.breach_breakdown::VARCHAR
            )
        ) AS ai_report_summary
    FROM ANALYTICS.FACT_DAILY_COMPLIANCE dc
    WHERE dc.compliance_date = CURRENT_DATE() - 1;

-- ---- 5b. SUMMARIZE: Summarize safety incident descriptions ----
CREATE OR REPLACE VIEW V_INCIDENT_SUMMARIES AS
    SELECT
        incident_date,
        country,
        industry_sector,
        accident_level,
        critical_risk,
        description,
        SNOWFLAKE.CORTEX.SUMMARIZE(description) AS ai_summary
    FROM RAW.SAFETY_INCIDENTS_RAW
    WHERE description IS NOT NULL
        AND LENGTH(description) > 50;

-- ---- 5c. SENTIMENT: Analyze sentiment of incident descriptions ----
CREATE OR REPLACE VIEW V_INCIDENT_SENTIMENT AS
    SELECT
        incident_date,
        country,
        accident_level,
        critical_risk,
        description,
        SNOWFLAKE.CORTEX.SENTIMENT(description) AS sentiment_score
    FROM RAW.SAFETY_INCIDENTS_RAW
    WHERE description IS NOT NULL;

-- ---- 5d. TRANSLATE: Translate multilingual incident data ----
-- The incident dataset contains data from multiple countries
CREATE OR REPLACE VIEW V_INCIDENTS_ENGLISH AS
    SELECT
        incident_date,
        country,
        industry_sector,
        accident_level,
        critical_risk,
        description,
        SNOWFLAKE.CORTEX.TRANSLATE(description, 'pt', 'en') AS description_english,
        SNOWFLAKE.CORTEX.TRANSLATE(critical_risk, 'pt', 'en') AS critical_risk_english
    FROM RAW.SAFETY_INCIDENTS_RAW
    WHERE description IS NOT NULL;

-- ---- 5e. EXTRACT_ANSWER: Extract specific facts from incidents ----
CREATE OR REPLACE VIEW V_INCIDENT_ROOT_CAUSES AS
    SELECT
        incident_date,
        country,
        accident_level,
        description,
        SNOWFLAKE.CORTEX.EXTRACT_ANSWER(
            description,
            'What was the root cause of this accident?'
        ) AS extracted_root_cause,
        SNOWFLAKE.CORTEX.EXTRACT_ANSWER(
            description,
            'What body part was injured?'
        ) AS extracted_injury,
        SNOWFLAKE.CORTEX.EXTRACT_ANSWER(
            description,
            'What safety equipment was involved or missing?'
        ) AS extracted_safety_equipment
    FROM RAW.SAFETY_INCIDENTS_RAW
    WHERE description IS NOT NULL
        AND LENGTH(description) > 100;

-- ---- 5f. CLASSIFY_TEXT: Classify incidents into risk categories ----
CREATE OR REPLACE VIEW V_INCIDENT_CLASSIFICATION AS
    SELECT
        incident_date,
        country,
        description,
        SNOWFLAKE.CORTEX.CLASSIFY_TEXT(
            description,
            ['Chemical Hazard', 'Mechanical Hazard', 'Electrical Hazard',
             'Ergonomic Hazard', 'Environmental Hazard', 'Procedural Failure']
        ) AS risk_classification
    FROM RAW.SAFETY_INCIDENTS_RAW
    WHERE description IS NOT NULL;

-- ---- 5g. COMPLETE: AI-powered alert explanations ----
-- When an anomaly is detected, use LLM to explain in plain language
CREATE OR REPLACE VIEW V_ANOMALY_EXPLANATIONS AS
    SELECT
        ar.*,
        SNOWFLAKE.CORTEX.COMPLETE(
            'mistral-large2',
            CONCAT(
                'You are a factory safety AI assistant for SafeShift. ',
                'An anomaly was detected in factory sensor data. ',
                'Explain this anomaly in simple terms for a factory manager. ',
                'Include: what happened, potential causes, and recommended immediate actions. ',
                'Anomaly data: ',
                'Factory: ', ar.factory_id,
                ', Metric: Temperature (C)',
                ', Is Anomaly: ', ar.is_anomaly::VARCHAR,
                ', Percentile: ', ar.percentile::VARCHAR,
                ', Distance from expected: ', ar.distance::VARCHAR
            )
        ) AS ai_explanation
    FROM ANOMALY_RESULTS ar
    WHERE ar.is_anomaly = TRUE;

-- =====================================================================
-- 6. ML FEATURE STORE — Pre-computed features for external models
-- =====================================================================

CREATE OR REPLACE TABLE FEATURE_STORE (
    feature_timestamp   TIMESTAMP_NTZ,
    factory_id          VARCHAR(50),
    -- Rolling window features (Arduino Nano 33 BLE Sense sensors)
    temp_1h_avg         FLOAT,
    temp_1h_std         FLOAT,
    temp_24h_avg        FLOAT,
    humidity_1h_avg     FLOAT,
    humidity_1h_std     FLOAT,
    humidity_24h_avg    FLOAT,
    light_1h_avg        FLOAT,
    light_1h_std        FLOAT,
    pressure_1h_avg     FLOAT,
    noise_1h_avg        FLOAT,
    noise_1h_max        FLOAT,
    vibration_1h_avg    FLOAT,
    vibration_1h_max    FLOAT,
    -- Derived features
    heat_index          FLOAT       COMMENT 'Computed from temperature and humidity',
    breach_rate_24h     FLOAT       COMMENT 'Fraction of readings breaching any threshold',
    -- Temporal features
    hour_of_day         INTEGER,
    day_of_week         INTEGER,
    is_weekend          BOOLEAN,
    -- Anomaly flags (from Cortex models)
    temp_anomaly_flag   BOOLEAN,
    computed_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (factory_id, feature_timestamp)
    COMMENT = 'Pre-computed ML features for external model training (transformers, LSTMs)';
