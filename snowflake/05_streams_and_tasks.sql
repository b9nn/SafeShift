-- ============================================================================
-- SafeShift Snowflake Database — Streams, Tasks, and Automation
-- ============================================================================
-- Snowflake features used:
--   - Streams (Change Data Capture)
--   - Tasks (scheduled and event-driven)
--   - Task DAGs (directed acyclic graphs)
--   - SYSTEM$STREAM_HAS_DATA()
--   - Serverless Tasks
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE WAREHOUSE INGEST_WH;

-- ===================== STREAMS (Change Data Capture) =====================
-- Streams capture INSERT/UPDATE/DELETE changes on source tables

-- Stream on raw sensor readings — captures new data as it arrives
CREATE OR REPLACE STREAM STREAM_SENSOR_RAW
    ON TABLE RAW.SENSOR_READINGS_RAW
    APPEND_ONLY = TRUE              -- Only track inserts (sensor data is append-only)
    SHOW_INITIAL_ROWS = FALSE
    COMMENT = 'CDC stream on raw sensor readings — triggers cleaning pipeline';

-- Stream on raw air quality data
CREATE OR REPLACE STREAM STREAM_AIR_QUALITY_RAW
    ON TABLE RAW.AIR_QUALITY_RAW
    APPEND_ONLY = TRUE
    COMMENT = 'CDC stream on raw air quality data';

-- Stream on cleaned sensor data — triggers analytics
CREATE OR REPLACE STREAM STREAM_SENSOR_CLEAN
    ON TABLE STAGING.SENSOR_READINGS_CLEAN
    APPEND_ONLY = TRUE
    COMMENT = 'CDC stream on cleaned sensor data — triggers compliance scoring';

-- Stream on daily compliance — triggers reward evaluation
CREATE OR REPLACE STREAM STREAM_DAILY_COMPLIANCE
    ON TABLE ANALYTICS.FACT_DAILY_COMPLIANCE
    APPEND_ONLY = TRUE
    COMMENT = 'CDC stream on daily compliance — triggers reward evaluation';

-- ===================== TASK DAG: Sensor Data Pipeline =====================
-- Root task -> Clean -> Score -> Feature Store -> Alerts
-- This creates a full DAG pipeline triggered by new data

-- ---- ROOT TASK: Data Cleaning (runs every 5 minutes) ----
CREATE OR REPLACE TASK TASK_CLEAN_SENSOR_DATA
    WAREHOUSE = INGEST_WH
    SCHEDULE = '5 MINUTE'
    ALLOW_OVERLAPPING_EXECUTION = FALSE
    WHEN SYSTEM$STREAM_HAS_DATA('STREAM_SENSOR_RAW')
    COMMENT = 'Root task: cleans raw sensor data when new readings arrive'
AS
    MERGE INTO STAGING.SENSOR_READINGS_CLEAN AS target
    USING (
        SELECT
            reading_id,
            factory_id,
            sensor_node_id,
            reading_timestamp,
            temperature_f,
            (temperature_f - 32) * 5.0 / 9.0 AS temperature_c,
            humidity_pct,
            co2_ppm,
            pm25_mg_m3,
            pm10_mg_m3,
            voc_mg_m3,
            noise_dba,
            light_lux,
            vibration_ms2,
            proximity_value,
            pressure_kpa,
            -- Validate: all critical readings should be non-negative
            CASE
                WHEN co2_ppm < 0 OR temperature_f < -40 OR humidity_pct < 0
                    OR humidity_pct > 100 OR noise_dba < 0
                THEN FALSE
                ELSE TRUE
            END AS is_valid,
            ARRAY_CONSTRUCT_COMPACT(
                IFF(co2_ppm < 0, 'NEGATIVE_CO2', NULL),
                IFF(temperature_f < -40 OR temperature_f > 160, 'TEMP_OUT_OF_RANGE', NULL),
                IFF(humidity_pct < 0 OR humidity_pct > 100, 'HUMIDITY_OUT_OF_RANGE', NULL),
                IFF(noise_dba < 0 OR noise_dba > 200, 'NOISE_OUT_OF_RANGE', NULL),
                IFF(reading_timestamp > CURRENT_TIMESTAMP(), 'FUTURE_TIMESTAMP', NULL)
            ) AS quality_flags
        FROM STREAM_SENSOR_RAW
    ) AS source
    ON target.reading_id = source.reading_id
    WHEN NOT MATCHED THEN INSERT (
        reading_id, factory_id, sensor_node_id, reading_timestamp,
        temperature_f, temperature_c, humidity_pct, co2_ppm,
        pm25_mg_m3, pm10_mg_m3, voc_mg_m3, noise_dba,
        light_lux, vibration_ms2, proximity_value, pressure_kpa,
        is_valid, quality_flags
    ) VALUES (
        source.reading_id, source.factory_id, source.sensor_node_id,
        source.reading_timestamp, source.temperature_f, source.temperature_c,
        source.humidity_pct, source.co2_ppm, source.pm25_mg_m3, source.pm10_mg_m3,
        source.voc_mg_m3, source.noise_dba, source.light_lux, source.vibration_ms2,
        source.proximity_value, source.pressure_kpa,
        source.is_valid, source.quality_flags
    );

-- ---- CHILD TASK: Hourly Compliance Scoring ----
CREATE OR REPLACE TASK TASK_COMPUTE_HOURLY_COMPLIANCE
    WAREHOUSE = ANALYTICS_WH
    AFTER TASK_CLEAN_SENSOR_DATA
    WHEN SYSTEM$STREAM_HAS_DATA('STREAM_SENSOR_CLEAN')
    COMMENT = 'Child task: computes hourly compliance scores from clean sensor data'
AS
    -- Compliance scoring aligned with Arduino Nano 33 BLE Sense sensors:
    -- temperature (HTS221), humidity (HTS221), pressure (LPS22HB),
    -- light (APDS-9960), vibration (LSM9DS1), noise (MP34DT05)
    INSERT INTO ANALYTICS.FACT_HOURLY_COMPLIANCE (
        factory_id, sensor_node_id, hour_timestamp,
        avg_temperature_c, avg_humidity_pct, avg_co2_ppm, avg_pm25,
        avg_noise_dba, avg_light_lux, avg_vibration_ms2,
        temperature_breaches, humidity_breaches, co2_breaches,
        pm25_breaches, noise_breaches, light_breaches, vibration_breaches,
        compliance_score, risk_level, breach_details
    )
    SELECT
        factory_id,
        sensor_node_id,
        DATE_TRUNC('HOUR', reading_timestamp) AS hour_timestamp,
        -- Averages
        AVG(temperature_c),
        AVG(humidity_pct),
        NULL,                                                            -- No CO2 sensor on Arduino
        NULL,                                                            -- No PM2.5 sensor on Arduino
        AVG(noise_dba),
        AVG(light_lux),
        AVG(vibration_ms2),
        -- Breach counts (based on safety_thresholds.json values)
        SUM(IFF(temperature_c < 20 OR temperature_c > 24.4, 1, 0)),     -- 68-76°F
        SUM(IFF(humidity_pct < 20 OR humidity_pct > 60, 1, 0)),
        0,                                                               -- No CO2 sensor
        0,                                                               -- No PM2.5 sensor
        SUM(IFF(noise_dba > 85, 1, 0)),                                  -- Action level
        SUM(IFF(light_lux < 300, 1, 0)),                                 -- Factory floor min
        SUM(IFF(vibration_ms2 > 2.5, 1, 0)),                            -- HAV action value
        -- Composite compliance score (100 = perfect, reweighted for available sensors)
        -- Weights: temperature=15, humidity=10, noise=25, light=15, vibration=20
        -- Remaining 15 points = baseline (always compliant if no data)
        GREATEST(0, 100 - (
            SUM(IFF(temperature_c < 20 OR temperature_c > 24.4, 1, 0)) * 8 +
            SUM(IFF(humidity_pct < 20 OR humidity_pct > 60, 1, 0)) * 5 +
            SUM(IFF(noise_dba > 85, 1, 0)) * 15 +
            SUM(IFF(light_lux < 300, 1, 0)) * 8 +
            SUM(IFF(vibration_ms2 > 2.5, 1, 0)) * 12
        )),
        -- Risk level (based on full compliance score)
        CASE
            WHEN GREATEST(0, 100 - (
                SUM(IFF(temperature_c < 20 OR temperature_c > 24.4, 1, 0)) * 8 +
                SUM(IFF(humidity_pct < 20 OR humidity_pct > 60, 1, 0)) * 5 +
                SUM(IFF(noise_dba > 85, 1, 0)) * 15 +
                SUM(IFF(light_lux < 300, 1, 0)) * 8 +
                SUM(IFF(vibration_ms2 > 2.5, 1, 0)) * 12
            )) >= 80 THEN 'LOW'
            WHEN GREATEST(0, 100 - (
                SUM(IFF(temperature_c < 20 OR temperature_c > 24.4, 1, 0)) * 8 +
                SUM(IFF(humidity_pct < 20 OR humidity_pct > 60, 1, 0)) * 5 +
                SUM(IFF(noise_dba > 85, 1, 0)) * 15 +
                SUM(IFF(light_lux < 300, 1, 0)) * 8 +
                SUM(IFF(vibration_ms2 > 2.5, 1, 0)) * 12
            )) >= 50 THEN 'MEDIUM'
            WHEN GREATEST(0, 100 - (
                SUM(IFF(temperature_c < 20 OR temperature_c > 24.4, 1, 0)) * 8 +
                SUM(IFF(humidity_pct < 20 OR humidity_pct > 60, 1, 0)) * 5 +
                SUM(IFF(noise_dba > 85, 1, 0)) * 15 +
                SUM(IFF(light_lux < 300, 1, 0)) * 8 +
                SUM(IFF(vibration_ms2 > 2.5, 1, 0)) * 12
            )) >= 20 THEN 'HIGH'
            ELSE 'CRITICAL'
        END,
        -- Breach details as JSON
        OBJECT_CONSTRUCT(
            'temperature', SUM(IFF(temperature_c < 20 OR temperature_c > 24.4, 1, 0)),
            'humidity', SUM(IFF(humidity_pct < 20 OR humidity_pct > 60, 1, 0)),
            'noise', SUM(IFF(noise_dba > 85, 1, 0)),
            'light', SUM(IFF(light_lux < 300, 1, 0)),
            'vibration', SUM(IFF(vibration_ms2 > 2.5, 1, 0))
        )
    FROM STREAM_SENSOR_CLEAN
    WHERE is_valid = TRUE
    GROUP BY factory_id, sensor_node_id, DATE_TRUNC('HOUR', reading_timestamp);

-- ---- CHILD TASK: Update Feature Store ----
CREATE OR REPLACE TASK TASK_UPDATE_FEATURE_STORE
    WAREHOUSE = ML_WH
    AFTER TASK_COMPUTE_HOURLY_COMPLIANCE
    COMMENT = 'Child task: updates ML feature store with rolling window features'
AS
    -- Feature store aligned with Arduino Nano 33 BLE Sense sensors
    INSERT INTO ML.FEATURE_STORE (
        feature_timestamp, factory_id,
        temp_1h_avg, temp_1h_std, temp_24h_avg,
        humidity_1h_avg, humidity_1h_std, humidity_24h_avg,
        light_1h_avg, light_1h_std, pressure_1h_avg,
        noise_1h_avg, noise_1h_max,
        vibration_1h_avg, vibration_1h_max,
        heat_index, breach_rate_24h,
        hour_of_day, day_of_week, is_weekend
    )
    SELECT
        DATE_TRUNC('HOUR', reading_timestamp) AS feature_timestamp,
        factory_id,
        AVG(temperature_c) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        STDDEV(temperature_c) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        AVG(temperature_c) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '24 HOURS' PRECEDING AND CURRENT ROW),
        AVG(humidity_pct) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        STDDEV(humidity_pct) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        AVG(humidity_pct) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '24 HOURS' PRECEDING AND CURRENT ROW),
        AVG(light_lux) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        STDDEV(light_lux) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        AVG(pressure_kpa) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        AVG(noise_dba) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        MAX(noise_dba) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        AVG(vibration_ms2) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        MAX(vibration_ms2) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW),
        -- Heat index approximation (Rothfusz regression simplified)
        -42.379 + 2.04901523 * ((temperature_c * 9/5) + 32)
            + 10.14333127 * humidity_pct
            - 0.22475541 * ((temperature_c * 9/5) + 32) * humidity_pct,
        -- 24h breach rate (based on available Arduino sensors)
        SUM(IFF(temperature_c < 20 OR temperature_c > 24.4
            OR noise_dba > 85 OR vibration_ms2 > 2.5, 1, 0)) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '24 HOURS' PRECEDING AND CURRENT ROW)
            / NULLIF(COUNT(*) OVER (PARTITION BY factory_id ORDER BY reading_timestamp RANGE BETWEEN INTERVAL '24 HOURS' PRECEDING AND CURRENT ROW), 0),
        HOUR(reading_timestamp),
        DAYOFWEEK(reading_timestamp),
        DAYOFWEEK(reading_timestamp) IN (0, 6)
    FROM STAGING.SENSOR_READINGS_CLEAN
    WHERE is_valid = TRUE
        AND reading_timestamp >= DATEADD('DAY', -2, CURRENT_TIMESTAMP())
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY factory_id, DATE_TRUNC('HOUR', reading_timestamp)
        ORDER BY reading_timestamp DESC
    ) = 1;

-- ---- CHILD TASK: Audit logging ----
CREATE OR REPLACE TASK TASK_LOG_PIPELINE_RUN
    WAREHOUSE = INGEST_WH
    AFTER TASK_UPDATE_FEATURE_STORE
    COMMENT = 'Child task: logs pipeline completion to audit table'
AS
    INSERT INTO GOVERNANCE.AUDIT_LOG (event_type, actor, event_details, source_schema)
    SELECT
        'PIPELINE_COMPLETE',
        'SYSTEM',
        OBJECT_CONSTRUCT(
            'pipeline', 'SENSOR_DATA_PIPELINE',
            'completed_at', CURRENT_TIMESTAMP(),
            'records_processed', (SELECT COUNT(*) FROM STAGING.SENSOR_READINGS_CLEAN
                                  WHERE cleaned_at >= DATEADD('MINUTE', -10, CURRENT_TIMESTAMP()))
        ),
        'RAW';

-- ---- DAILY TASK: Compute daily compliance summaries ----
CREATE OR REPLACE TASK TASK_DAILY_COMPLIANCE_ROLLUP
    WAREHOUSE = ANALYTICS_WH
    SCHEDULE = 'USING CRON 0 2 * * * America/New_York'   -- 2 AM ET daily
    COMMENT = 'Daily rollup of hourly compliance into daily summaries'
AS
    INSERT INTO ANALYTICS.FACT_DAILY_COMPLIANCE (
        factory_id, compliance_date,
        avg_compliance_score, min_compliance_score, max_compliance_score,
        total_breaches, breach_breakdown, risk_level
    )
    SELECT
        factory_id,
        hour_timestamp::DATE AS compliance_date,
        AVG(compliance_score),
        MIN(compliance_score),
        MAX(compliance_score),
        SUM(temperature_breaches + humidity_breaches
            + noise_breaches + light_breaches + vibration_breaches),
        OBJECT_CONSTRUCT(
            'temperature', SUM(temperature_breaches),
            'humidity', SUM(humidity_breaches),
            'noise', SUM(noise_breaches),
            'light', SUM(light_breaches),
            'vibration', SUM(vibration_breaches)
        ),
        CASE
            WHEN AVG(compliance_score) >= 80 THEN 'LOW'
            WHEN AVG(compliance_score) >= 50 THEN 'MEDIUM'
            WHEN AVG(compliance_score) >= 20 THEN 'HIGH'
            ELSE 'CRITICAL'
        END
    FROM ANALYTICS.FACT_HOURLY_COMPLIANCE
    WHERE hour_timestamp::DATE = CURRENT_DATE() - 1
    GROUP BY factory_id, hour_timestamp::DATE;

-- ---- DAILY TASK: Evaluate rewards ----
CREATE OR REPLACE TASK TASK_EVALUATE_REWARDS
    WAREHOUSE = ANALYTICS_WH
    AFTER TASK_DAILY_COMPLIANCE_ROLLUP
    COMMENT = 'Evaluates factories for reward eligibility based on compliance'
AS
    INSERT INTO BLOCKCHAIN.REWARD_PAYOUTS (
        factory_id, payout_date, reward_type, reward_amount_usd,
        compliance_period, avg_compliance_score, payout_status, payout_metadata
    )
    SELECT
        factory_id,
        CURRENT_DATE(),
        CASE
            WHEN avg_compliance_score >= 95 THEN 'CERTIFICATION'
            WHEN avg_compliance_score >= 85 THEN 'INSURANCE_DISCOUNT'
            WHEN avg_compliance_score >= 75 THEN 'STABLECOIN'
            ELSE NULL
        END,
        CASE
            WHEN avg_compliance_score >= 95 THEN 500.00
            WHEN avg_compliance_score >= 85 THEN 200.00
            WHEN avg_compliance_score >= 75 THEN 100.00
            ELSE 0
        END,
        TO_CHAR(CURRENT_DATE() - 1, 'YYYY-"W"IW'),
        avg_compliance_score,
        'PENDING',
        OBJECT_CONSTRUCT(
            'compliance_date', compliance_date,
            'risk_level', risk_level,
            'total_breaches', total_breaches
        )
    FROM ANALYTICS.FACT_DAILY_COMPLIANCE
    WHERE compliance_date = CURRENT_DATE() - 1
        AND avg_compliance_score >= 75;  -- Only reward factories scoring 75+

-- ===================== RESUME ALL TASKS =====================

ALTER TASK TASK_LOG_PIPELINE_RUN RESUME;
ALTER TASK TASK_UPDATE_FEATURE_STORE RESUME;
ALTER TASK TASK_COMPUTE_HOURLY_COMPLIANCE RESUME;
ALTER TASK TASK_CLEAN_SENSOR_DATA RESUME;
ALTER TASK TASK_EVALUATE_REWARDS RESUME;
ALTER TASK TASK_DAILY_COMPLIANCE_ROLLUP RESUME;
