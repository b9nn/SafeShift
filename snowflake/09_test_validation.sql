-- ============================================================================
-- SafeShift Snowflake Database — Test & Validation Script
-- ============================================================================
-- Run this AFTER executing scripts 00-08 in order.
-- Each section prints pass/fail results so you can verify the setup.
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE WAREHOUSE INGEST_WH;

-- =====================================================================
-- TEST 1: Verify all schemas exist
-- =====================================================================
SELECT 'TEST 1: Schemas' AS test_name,
    COUNT(*) AS found,
    6 AS expected,
    IFF(COUNT(*) = 6, 'PASS', 'FAIL') AS result
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE CATALOG_NAME = 'SAFE_SHIFT'
    AND SCHEMA_NAME IN ('RAW', 'STAGING', 'ANALYTICS', 'ML', 'GOVERNANCE', 'BLOCKCHAIN');

-- =====================================================================
-- TEST 2: Verify all RAW tables exist
-- =====================================================================
SELECT 'TEST 2: RAW tables' AS test_name,
    COUNT(*) AS found,
    7 AS expected,
    IFF(COUNT(*) = 7, 'PASS', 'FAIL') AS result
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'RAW'
    AND TABLE_NAME IN (
        'SENSOR_READINGS_RAW', 'AIR_QUALITY_RAW', 'AIR_QUALITY_UCI_RAW',
        'BEIJING_PM25_RAW', 'STEEL_INDUSTRY_RAW', 'SML2010_RAW', 'SAFETY_INCIDENTS_RAW'
    );

-- =====================================================================
-- TEST 3: Verify stages exist
-- =====================================================================
SHOW STAGES IN SCHEMA RAW;
-- Should show: STG_SENSOR_DATA, STG_AIR_QUALITY, STG_INDUSTRIAL,
--              STG_SML2010, STG_CONFIG, STG_ML_OUTPUT

-- =====================================================================
-- TEST 4: Verify file formats exist
-- =====================================================================
SHOW FILE FORMATS IN SCHEMA RAW;
-- Should show: CSV_SEMICOLON_FORMAT, CSV_STANDARD_FORMAT, TSV_FORMAT,
--              JSON_FORMAT, PARQUET_FORMAT

-- =====================================================================
-- TEST 5: Verify warehouses exist
-- =====================================================================
SHOW WAREHOUSES LIKE 'INGEST_WH';
SHOW WAREHOUSES LIKE 'ANALYTICS_WH';
SHOW WAREHOUSES LIKE 'ML_WH';
SHOW WAREHOUSES LIKE 'CORTEX_WH';

-- =====================================================================
-- TEST 6: Verify UDFs work with sample data
-- =====================================================================
USE SCHEMA ANALYTICS;

-- Test compliance score computation
-- Params: temperature_c, humidity_pct, noise_dba, light_lux, vibration_ms2
SELECT 'TEST 6a: COMPUTE_COMPLIANCE_SCORE' AS test_name,
    -- Perfect conditions: should return 100
    COMPUTE_COMPLIANCE_SCORE(22, 40, 70, 500, 1.0) AS perfect_score,
    IFF(COMPUTE_COMPLIANCE_SCORE(22, 40, 70, 500, 1.0) = 100, 'PASS', 'FAIL') AS result;

SELECT 'TEST 6b: COMPUTE_COMPLIANCE_SCORE (bad)' AS test_name,
    -- Terrible conditions: should be well below 100
    COMPUTE_COMPLIANCE_SCORE(35, 80, 95, 50, 6.0) AS bad_score,
    IFF(COMPUTE_COMPLIANCE_SCORE(35, 80, 95, 50, 6.0) < 30, 'PASS', 'FAIL') AS result;

-- Test risk classification
SELECT 'TEST 6c: CLASSIFY_RISK_LEVEL' AS test_name,
    CLASSIFY_RISK_LEVEL(90) AS should_be_low,
    CLASSIFY_RISK_LEVEL(60) AS should_be_medium,
    CLASSIFY_RISK_LEVEL(30) AS should_be_high,
    CLASSIFY_RISK_LEVEL(10) AS should_be_critical,
    IFF(
        CLASSIFY_RISK_LEVEL(90) = 'LOW' AND
        CLASSIFY_RISK_LEVEL(60) = 'MEDIUM' AND
        CLASSIFY_RISK_LEVEL(30) = 'HIGH' AND
        CLASSIFY_RISK_LEVEL(10) = 'CRITICAL',
        'PASS', 'FAIL'
    ) AS result;

-- Test temperature conversion
SELECT 'TEST 6d: F_TO_C / C_TO_F' AS test_name,
    F_TO_C(212) AS boiling_c,
    C_TO_F(0) AS freezing_f,
    IFF(ABS(F_TO_C(212) - 100) < 0.01 AND ABS(C_TO_F(0) - 32) < 0.01, 'PASS', 'FAIL') AS result;

-- Test noise exposure
SELECT 'TEST 6e: MAX_NOISE_EXPOSURE_HOURS' AS test_name,
    MAX_NOISE_EXPOSURE_HOURS(90) AS at_90dba,
    MAX_NOISE_EXPOSURE_HOURS(95) AS at_95dba,
    IFF(ABS(MAX_NOISE_EXPOSURE_HOURS(90) - 8.0) < 0.01, 'PASS', 'FAIL') AS result;

-- Test AQI calculation (JavaScript UDF)
SELECT 'TEST 6f: CALCULATE_AQI_PM25' AS test_name,
    CALCULATE_AQI_PM25(0.005) AS good_aqi,
    CALCULATE_AQI_PM25(0.04) AS unhealthy_sensitive,
    IFF(CALCULATE_AQI_PM25(0.005) BETWEEN 0 AND 50, 'PASS', 'FAIL') AS result;

-- Test heat index
SELECT 'TEST 6g: HEAT_INDEX' AS test_name,
    HEAT_INDEX(95, 80) AS hot_humid,
    IFF(HEAT_INDEX(95, 80) > 100, 'PASS', 'FAIL') AS result;

-- =====================================================================
-- TEST 7: Verify tags exist
-- =====================================================================
USE SCHEMA GOVERNANCE;

SHOW TAGS IN SCHEMA GOVERNANCE;
-- Should show: DATA_SENSITIVITY, DATA_DOMAIN, PII_TYPE, DATA_FRESHNESS, REGULATORY_STANDARD

-- =====================================================================
-- TEST 8: Verify masking policies exist
-- =====================================================================
SHOW MASKING POLICIES IN SCHEMA GOVERNANCE;
-- Should show: MASK_FACTORY_ID, MASK_SOLANA_TX, MASK_FINANCIAL

-- =====================================================================
-- TEST 9: Verify streams exist
-- =====================================================================
SHOW STREAMS IN DATABASE SAFE_SHIFT;
-- Should show: STREAM_SENSOR_RAW, STREAM_AIR_QUALITY_RAW,
--              STREAM_SENSOR_CLEAN, STREAM_DAILY_COMPLIANCE

-- =====================================================================
-- TEST 10: Verify tasks exist
-- =====================================================================
SHOW TASKS IN DATABASE SAFE_SHIFT;
-- Should show: TASK_CLEAN_SENSOR_DATA, TASK_COMPUTE_HOURLY_COMPLIANCE,
--              TASK_UPDATE_FEATURE_STORE, TASK_LOG_PIPELINE_RUN,
--              TASK_DAILY_COMPLIANCE_ROLLUP, TASK_EVALUATE_REWARDS

-- =====================================================================
-- TEST 11: Verify alerts exist
-- =====================================================================
SHOW ALERTS IN DATABASE SAFE_SHIFT;
-- Should show: ALERT_CRITICAL_RISK, ALERT_SENSOR_OFFLINE,
--              ALERT_NOISE_DANGER

-- =====================================================================
-- TEST 12: Verify dynamic tables exist
-- =====================================================================
SHOW DYNAMIC TABLES IN DATABASE SAFE_SHIFT;
-- Should show: DT_AIR_QUALITY_UNIFIED, DT_FACTORY_DASHBOARD, DT_INCIDENT_ANALYTICS

-- =====================================================================
-- TEST 13: Verify Cortex ML models exist
-- =====================================================================
USE SCHEMA ML;
SHOW SNOWFLAKE.ML.ANOMALY_DETECTION IN SCHEMA ML;
SHOW SNOWFLAKE.ML.FORECAST IN SCHEMA ML;

-- =====================================================================
-- TEST 14: Insert synthetic sensor data and trace through pipeline
-- =====================================================================
USE SCHEMA RAW;

-- Insert test sensor readings (using SELECT instead of VALUES to allow function calls)
INSERT INTO SENSOR_READINGS_RAW (
    factory_id, sensor_node_id, reading_timestamp,
    temperature_f, humidity_pct, co2_ppm, pm25_mg_m3, pm10_mg_m3,
    voc_mg_m3, noise_dba, light_lux, vibration_ms2, proximity_value,
    pressure_kpa, raw_payload
)
-- Good conditions
SELECT 'TEST_FACTORY_01', 'NODE_A1', CURRENT_TIMESTAMP(),
     72, 45, 450, 1.2, 3.0, 0.2, 65, 500, 0.8, 100, 101.3,
     PARSE_JSON('{"test": true, "condition": "good"}')
UNION ALL
-- Marginal conditions
SELECT 'TEST_FACTORY_01', 'NODE_A1', DATEADD('MINUTE', -5, CURRENT_TIMESTAMP()),
     78, 55, 950, 4.0, 8.0, 0.4, 82, 320, 2.0, 50, 101.0,
     PARSE_JSON('{"test": true, "condition": "marginal"}')
UNION ALL
-- Bad conditions (multiple threshold breaches)
SELECT 'TEST_FACTORY_02', 'NODE_B1', CURRENT_TIMESTAMP(),
     95, 75, 6000, 8.0, 20.0, 1.5, 98, 80, 6.5, 20, 100.5,
     PARSE_JSON('{"test": true, "condition": "dangerous"}');

SELECT 'TEST 14: Synthetic data insert' AS test_name,
    COUNT(*) AS inserted,
    IFF(COUNT(*) >= 3, 'PASS', 'FAIL') AS result
FROM SENSOR_READINGS_RAW
WHERE factory_id LIKE 'TEST_FACTORY_%';

-- =====================================================================
-- TEST 15: Verify the stream captured the inserts
-- =====================================================================
SELECT 'TEST 15: Stream has data' AS test_name,
    SYSTEM$STREAM_HAS_DATA('STREAM_SENSOR_RAW') AS stream_has_data,
    IFF(SYSTEM$STREAM_HAS_DATA('STREAM_SENSOR_RAW'), 'PASS', 'FAIL') AS result;

-- =====================================================================
-- TEST 16: Manually run the cleaning task logic (without waiting for schedule)
-- =====================================================================
USE SCHEMA STAGING;

MERGE INTO SENSOR_READINGS_CLEAN AS target
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
        CASE
            WHEN co2_ppm < 0 OR temperature_f < -40 OR humidity_pct < 0
                OR humidity_pct > 100 OR noise_dba < 0
            THEN FALSE
            ELSE TRUE
        END AS is_valid,
        ARRAY_CONSTRUCT_COMPACT(
            IFF(co2_ppm < 0, 'NEGATIVE_CO2', NULL),
            IFF(temperature_f < -40 OR temperature_f > 160, 'TEMP_OUT_OF_RANGE', NULL),
            IFF(humidity_pct < 0 OR humidity_pct > 100, 'HUMIDITY_OUT_OF_RANGE', NULL)
        ) AS quality_flags
    FROM RAW.SENSOR_READINGS_RAW
    WHERE factory_id LIKE 'TEST_FACTORY_%'
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

SELECT 'TEST 16: Cleaning pipeline' AS test_name,
    COUNT(*) AS cleaned_rows,
    SUM(IFF(is_valid, 1, 0)) AS valid_rows,
    IFF(COUNT(*) >= 3, 'PASS', 'FAIL') AS result
FROM SENSOR_READINGS_CLEAN
WHERE factory_id LIKE 'TEST_FACTORY_%';

-- =====================================================================
-- TEST 17: Test compliance scoring on cleaned data
-- =====================================================================
USE SCHEMA ANALYTICS;

-- Insert test factory
INSERT INTO DIM_FACTORY (factory_id, factory_name, country, region, industry_sector, num_sensor_nodes)
VALUES
    ('TEST_FACTORY_01', 'Test Factory Alpha', 'United States', 'Northeast', 'Manufacturing', 2),
    ('TEST_FACTORY_02', 'Test Factory Beta', 'Bangladesh', 'Dhaka', 'Textiles', 1);

-- Score the test data
INSERT INTO FACT_HOURLY_COMPLIANCE (
    factory_id, sensor_node_id, hour_timestamp,
    avg_temperature_c, avg_humidity_pct, avg_co2_ppm, avg_pm25,
    avg_noise_dba, avg_light_lux, avg_vibration_ms2,
    compliance_score, risk_level
)
SELECT
    factory_id,
    sensor_node_id,
    DATE_TRUNC('HOUR', reading_timestamp),
    AVG(temperature_c),
    AVG(humidity_pct),
    AVG(co2_ppm),
    AVG(pm25_mg_m3),
    AVG(noise_dba),
    AVG(light_lux),
    AVG(vibration_ms2),
    COMPUTE_COMPLIANCE_SCORE(
        AVG(temperature_c), AVG(humidity_pct),
        AVG(noise_dba), AVG(light_lux), AVG(vibration_ms2)
    ),
    CLASSIFY_RISK_LEVEL(
        COMPUTE_COMPLIANCE_SCORE(
            AVG(temperature_c), AVG(humidity_pct),
            AVG(noise_dba), AVG(light_lux), AVG(vibration_ms2)
        )
    )
FROM STAGING.SENSOR_READINGS_CLEAN
WHERE factory_id LIKE 'TEST_FACTORY_%'
GROUP BY factory_id, sensor_node_id, DATE_TRUNC('HOUR', reading_timestamp);

SELECT 'TEST 17: Compliance scoring' AS test_name,
    factory_id,
    compliance_score,
    risk_level,
    IFF(
        (factory_id = 'TEST_FACTORY_01' AND risk_level IN ('LOW', 'MEDIUM'))
        OR
        (factory_id = 'TEST_FACTORY_02' AND risk_level IN ('HIGH', 'CRITICAL')),
        'PASS', 'FAIL'
    ) AS result
FROM FACT_HOURLY_COMPLIANCE
WHERE factory_id LIKE 'TEST_FACTORY_%';

-- =====================================================================
-- TEST 18: Test Cortex LLM (requires Cortex access)
-- =====================================================================
-- This only works if your Snowflake account has Cortex enabled
-- Uncomment to test:

-- SELECT 'TEST 18: Cortex COMPLETE' AS test_name,
--     SNOWFLAKE.CORTEX.COMPLETE(
--         'mistral-large2',
--         'Summarize in one sentence: A factory had CO2 levels of 6000 ppm, which exceeds the OSHA PEL of 5000 ppm.'
--     ) AS cortex_response,
--     'MANUAL CHECK' AS result;

-- SELECT 'TEST 18b: Cortex SENTIMENT' AS test_name,
--     SNOWFLAKE.CORTEX.SENTIMENT(
--         'The factory conditions were extremely dangerous with toxic fumes and excessive heat'
--     ) AS sentiment_score,
--     'MANUAL CHECK' AS result;

-- =====================================================================
-- TEST 19: Time Travel verification
-- =====================================================================
-- Query data as it was 5 minutes ago
SELECT 'TEST 19: Time Travel' AS test_name,
    COUNT(*) AS rows_5min_ago,
    'MANUAL CHECK' AS result
FROM RAW.SENSOR_READINGS_RAW AT(OFFSET => -300)
WHERE factory_id LIKE 'TEST_FACTORY_%';

-- =====================================================================
-- TEST 20: Cleanup test data (optional)
-- =====================================================================
-- Uncomment to clean up after testing:

-- DELETE FROM RAW.SENSOR_READINGS_RAW WHERE factory_id LIKE 'TEST_FACTORY_%';
-- DELETE FROM STAGING.SENSOR_READINGS_CLEAN WHERE factory_id LIKE 'TEST_FACTORY_%';
-- DELETE FROM ANALYTICS.FACT_HOURLY_COMPLIANCE WHERE factory_id LIKE 'TEST_FACTORY_%';
-- DELETE FROM ANALYTICS.DIM_FACTORY WHERE factory_id LIKE 'TEST_FACTORY_%';

-- =====================================================================
-- SUMMARY: Run this to get an overview of all objects created
-- =====================================================================
SELECT 'TABLES' AS object_type, COUNT(*) AS count
FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_CATALOG = 'SAFE_SHIFT' AND TABLE_TYPE = 'BASE TABLE'
UNION ALL
SELECT 'VIEWS', COUNT(*)
FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_CATALOG = 'SAFE_SHIFT'
UNION ALL
SELECT 'STAGES', COUNT(*)
FROM INFORMATION_SCHEMA.STAGES WHERE STAGE_CATALOG = 'SAFE_SHIFT'
UNION ALL
SELECT 'FILE FORMATS', COUNT(*)
FROM INFORMATION_SCHEMA.FILE_FORMATS WHERE FILE_FORMAT_CATALOG = 'SAFE_SHIFT'
UNION ALL
SELECT 'SEQUENCES', COUNT(*)
FROM INFORMATION_SCHEMA.SEQUENCES WHERE SEQUENCE_CATALOG = 'SAFE_SHIFT'
UNION ALL
SELECT 'FUNCTIONS', COUNT(*)
FROM INFORMATION_SCHEMA.FUNCTIONS WHERE FUNCTION_CATALOG = 'SAFE_SHIFT'
UNION ALL
SELECT 'PROCEDURES', COUNT(*)
FROM INFORMATION_SCHEMA.PROCEDURES WHERE PROCEDURE_CATALOG = 'SAFE_SHIFT';
