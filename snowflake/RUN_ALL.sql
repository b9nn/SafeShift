-- ============================================================================
-- SafeShift Snowflake Database — COMBINED SCRIPT (Run All)
-- ============================================================================
-- Paste this entire script into a Snowflake SQL Worksheet and hit "Run All"
-- (Ctrl+Shift+Enter on Windows, Cmd+Shift+Enter on Mac)
--
-- NOTE: Some features (Resource Monitors, Shares, Roles) require ACCOUNTADMIN.
-- If you're on a trial account you should already be ACCOUNTADMIN.
-- ============================================================================

USE ROLE ACCOUNTADMIN;

-- ============================================================================
-- SECTION 1: DATABASE & SCHEMAS
-- ============================================================================

CREATE OR REPLACE DATABASE SAFE_SHIFT
    DATA_RETENTION_TIME_IN_DAYS = 90
    MAX_DATA_EXTENSION_TIME_IN_DAYS = 30
    COMMENT = 'SafeShift: Factory condition monitoring, ML risk scoring, and incentive management';

USE DATABASE SAFE_SHIFT;

CREATE OR REPLACE SCHEMA RAW
    WITH MANAGED ACCESS
    DATA_RETENTION_TIME_IN_DAYS = 30
    COMMENT = 'Raw ingested sensor data and external datasets — landing zone';

CREATE OR REPLACE SCHEMA STAGING
    WITH MANAGED ACCESS
    DATA_RETENTION_TIME_IN_DAYS = 30
    COMMENT = 'Cleaned, validated, and deduplicated data ready for modeling';

CREATE OR REPLACE SCHEMA ANALYTICS
    WITH MANAGED ACCESS
    DATA_RETENTION_TIME_IN_DAYS = 90
    COMMENT = 'Aggregated analytics, compliance scores, and reporting tables';

CREATE OR REPLACE SCHEMA ML
    WITH MANAGED ACCESS
    DATA_RETENTION_TIME_IN_DAYS = 90
    COMMENT = 'ML features, model outputs, Cortex results, and risk scores';

CREATE OR REPLACE SCHEMA GOVERNANCE
    WITH MANAGED ACCESS
    DATA_RETENTION_TIME_IN_DAYS = 90
    COMMENT = 'Tags, policies, audit logs, and access control metadata';

CREATE OR REPLACE SCHEMA BLOCKCHAIN
    WITH MANAGED ACCESS
    DATA_RETENTION_TIME_IN_DAYS = 90
    COMMENT = 'On-chain event logs, reward payouts, and Solana transaction records';

-- ============================================================================
-- SECTION 2: VIRTUAL WAREHOUSES
-- ============================================================================

CREATE OR REPLACE WAREHOUSE INGEST_WH
    WAREHOUSE_SIZE = 'XSMALL'
    AUTO_SUSPEND = 60
    AUTO_RESUME = TRUE
    MIN_CLUSTER_COUNT = 1
    MAX_CLUSTER_COUNT = 2
    SCALING_POLICY = 'STANDARD'
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Warehouse for data ingestion and ETL pipelines';

CREATE OR REPLACE WAREHOUSE ANALYTICS_WH
    WAREHOUSE_SIZE = 'SMALL'
    AUTO_SUSPEND = 120
    AUTO_RESUME = TRUE
    MIN_CLUSTER_COUNT = 1
    MAX_CLUSTER_COUNT = 3
    SCALING_POLICY = 'STANDARD'
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Warehouse for analytics queries and dashboard workloads';

CREATE OR REPLACE WAREHOUSE ML_WH
    WAREHOUSE_SIZE = 'MEDIUM'
    AUTO_SUSPEND = 300
    AUTO_RESUME = TRUE
    MIN_CLUSTER_COUNT = 1
    MAX_CLUSTER_COUNT = 2
    SCALING_POLICY = 'ECONOMY'
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Warehouse for ML training, Cortex functions, and model inference';

CREATE OR REPLACE WAREHOUSE CORTEX_WH
    WAREHOUSE_SIZE = 'MEDIUM'
    AUTO_SUSPEND = 300
    AUTO_RESUME = TRUE
    MIN_CLUSTER_COUNT = 1
    MAX_CLUSTER_COUNT = 2
    SCALING_POLICY = 'ECONOMY'
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Dedicated warehouse for Snowflake Cortex AI/ML workloads';

-- ============================================================================
-- SECTION 3: RESOURCE MONITORS
-- ============================================================================

CREATE OR REPLACE RESOURCE MONITOR HACKATHON_BUDGET
    WITH
        CREDIT_QUOTA = 50
        FREQUENCY = MONTHLY
        START_TIMESTAMP = IMMEDIATELY
        TRIGGERS
            ON 75 PERCENT DO NOTIFY
            ON 90 PERCENT DO NOTIFY
            ON 100 PERCENT DO SUSPEND_IMMEDIATE;

ALTER WAREHOUSE INGEST_WH SET RESOURCE_MONITOR = HACKATHON_BUDGET;
ALTER WAREHOUSE ANALYTICS_WH SET RESOURCE_MONITOR = HACKATHON_BUDGET;
ALTER WAREHOUSE ML_WH SET RESOURCE_MONITOR = HACKATHON_BUDGET;
ALTER WAREHOUSE CORTEX_WH SET RESOURCE_MONITOR = HACKATHON_BUDGET;

-- ============================================================================
-- SECTION 4: FILE FORMATS
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE SCHEMA RAW;
USE WAREHOUSE INGEST_WH;

CREATE OR REPLACE FILE FORMAT CSV_SEMICOLON_FORMAT
    TYPE = 'CSV'
    FIELD_DELIMITER = ';'
    RECORD_DELIMITER = '\n'
    SKIP_HEADER = 1
    FIELD_OPTIONALLY_ENCLOSED_BY = '"'
    TRIM_SPACE = TRUE
    NULL_IF = ('', 'NULL', 'null', 'NA', '-200', '-200.0')
    ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE
    COMMENT = 'Semicolon-delimited CSV for European format datasets';

CREATE OR REPLACE FILE FORMAT CSV_STANDARD_FORMAT
    TYPE = 'CSV'
    FIELD_DELIMITER = ','
    RECORD_DELIMITER = '\n'
    SKIP_HEADER = 1
    FIELD_OPTIONALLY_ENCLOSED_BY = '"'
    TRIM_SPACE = TRUE
    NULL_IF = ('', 'NULL', 'null', 'NA', 'N/A')
    ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE
    COMMENT = 'Standard comma-delimited CSV';

CREATE OR REPLACE FILE FORMAT TSV_FORMAT
    TYPE = 'CSV'
    FIELD_DELIMITER = '\t'
    RECORD_DELIMITER = '\n'
    SKIP_HEADER = 1
    TRIM_SPACE = TRUE
    NULL_IF = ('', 'NULL', 'null')
    COMMENT = 'Tab-delimited format for SML2010 sensor data';

CREATE OR REPLACE FILE FORMAT JSON_FORMAT
    TYPE = 'JSON'
    STRIP_OUTER_ARRAY = TRUE
    ALLOW_DUPLICATE = FALSE
    STRIP_NULL_VALUES = FALSE
    COMMENT = 'JSON format for config files and API data';

CREATE OR REPLACE FILE FORMAT PARQUET_FORMAT
    TYPE = 'PARQUET'
    SNAPPY_COMPRESSION = TRUE
    COMMENT = 'Parquet format for ML model outputs and optimized storage';

-- ============================================================================
-- SECTION 5: INTERNAL STAGES
-- ============================================================================

CREATE OR REPLACE STAGE STG_SENSOR_DATA
    FILE_FORMAT = CSV_STANDARD_FORMAT
    DIRECTORY = (ENABLE = TRUE)
    COMMENT = 'Stage for raw sensor data uploads from Arduino/ESP32';

CREATE OR REPLACE STAGE STG_AIR_QUALITY
    FILE_FORMAT = CSV_SEMICOLON_FORMAT
    DIRECTORY = (ENABLE = TRUE)
    COMMENT = 'Stage for air quality CSV datasets';

CREATE OR REPLACE STAGE STG_INDUSTRIAL
    FILE_FORMAT = CSV_STANDARD_FORMAT
    DIRECTORY = (ENABLE = TRUE)
    COMMENT = 'Stage for industrial safety and steel industry datasets';

CREATE OR REPLACE STAGE STG_SML2010
    FILE_FORMAT = TSV_FORMAT
    DIRECTORY = (ENABLE = TRUE)
    COMMENT = 'Stage for SML2010 indoor environment datasets';

CREATE OR REPLACE STAGE STG_CONFIG
    FILE_FORMAT = JSON_FORMAT
    COMMENT = 'Stage for JSON configuration files (thresholds, etc.)';

CREATE OR REPLACE STAGE STG_ML_OUTPUT
    FILE_FORMAT = PARQUET_FORMAT
    DIRECTORY = (ENABLE = TRUE)
    COMMENT = 'Stage for ML model output artifacts';

-- ============================================================================
-- SECTION 6: RAW TABLES (must be created before Snowpipes reference them)
-- ============================================================================

USE SCHEMA RAW;

CREATE OR REPLACE SEQUENCE SEQ_READING_ID
    START = 1 INCREMENT = 1
    COMMENT = 'Global sequence for sensor reading IDs';

CREATE OR REPLACE TABLE SENSOR_READINGS_RAW (
    reading_id          NUMBER DEFAULT SEQ_READING_ID.NEXTVAL,
    factory_id          VARCHAR(50),
    sensor_node_id      VARCHAR(50),
    reading_timestamp   TIMESTAMP_NTZ,
    temperature_f       FLOAT,
    humidity_pct        FLOAT,
    co2_ppm             FLOAT,
    pm25_mg_m3          FLOAT,
    pm10_mg_m3          FLOAT,
    voc_mg_m3           FLOAT,
    noise_dba           FLOAT,
    light_lux           FLOAT,
    vibration_ms2       FLOAT,
    proximity_value     INTEGER,
    pressure_kpa        FLOAT,
    raw_payload         VARIANT,
    ingestion_timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    source_file         VARCHAR(500)
)
    CLUSTER BY (factory_id, reading_timestamp)
    CHANGE_TRACKING = TRUE
    DATA_RETENTION_TIME_IN_DAYS = 30
    COMMENT = 'Raw sensor readings from factory sensor nodes';

CREATE OR REPLACE TABLE AIR_QUALITY_RAW (
    time_str            VARCHAR(100),
    co2_ppm             FLOAT,
    pm25                FLOAT,
    pm10                FLOAT,
    temperature         FLOAT,
    humidity            FLOAT,
    category_1          VARCHAR(50),
    category_2          VARCHAR(50),
    status              VARCHAR(50),
    ingestion_timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    source_file         VARCHAR(500)
)
    CHANGE_TRACKING = TRUE
    COMMENT = 'Raw air quality dataset (2023, European format)';

CREATE OR REPLACE TABLE AIR_QUALITY_UCI_RAW (
    date_str            VARCHAR(20),
    time_str            VARCHAR(20),
    co_gt               FLOAT,
    pt08_s1_co          FLOAT,
    nmhc_gt             FLOAT,
    c6h6_gt             FLOAT,
    pt08_s2_nmhc        FLOAT,
    nox_gt              FLOAT,
    pt08_s3_nox         FLOAT,
    no2_gt              FLOAT,
    pt08_s4_no2         FLOAT,
    pt08_s5_o3          FLOAT,
    temperature         FLOAT,
    relative_humidity   FLOAT,
    absolute_humidity   FLOAT,
    ingestion_timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    source_file         VARCHAR(500)
)
    CHANGE_TRACKING = TRUE
    COMMENT = 'Raw UCI Air Quality dataset (2004 hourly)';

CREATE OR REPLACE TABLE BEIJING_PM25_RAW (
    row_no              INTEGER,
    year                INTEGER,
    month               INTEGER,
    day                 INTEGER,
    hour                INTEGER,
    pm25                FLOAT,
    dewp                FLOAT,
    temp                FLOAT,
    pres                FLOAT,
    cbwd                VARCHAR(10),
    iws                 FLOAT,
    is_snow             FLOAT,
    ir_rain             FLOAT,
    ingestion_timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    source_file         VARCHAR(500)
)
    CLUSTER BY (year, month)
    CHANGE_TRACKING = TRUE
    COMMENT = 'Raw Beijing PM2.5 PRSA dataset (2010-2014 hourly)';

CREATE OR REPLACE TABLE STEEL_INDUSTRY_RAW (
    date_time_str       VARCHAR(50),
    usage_kwh           FLOAT,
    lagging_reactive    FLOAT,
    leading_reactive    FLOAT,
    co2_tco2            FLOAT,
    lagging_pf          FLOAT,
    leading_pf          FLOAT,
    nsm                 FLOAT,
    week_status         VARCHAR(20),
    day_of_week         VARCHAR(20),
    load_type           VARCHAR(50),
    ingestion_timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    source_file         VARCHAR(500)
)
    CHANGE_TRACKING = TRUE
    COMMENT = 'Raw steel industry energy and emissions dataset (2018)';

CREATE OR REPLACE TABLE SML2010_RAW (
    epoch_time          FLOAT,
    temp_comedor_c      FLOAT,
    temp_habitacion_c   FLOAT,
    humidity_comedor    FLOAT,
    humidity_habitacion FLOAT,
    lighting_comedor    FLOAT,
    lighting_habitacion FLOAT,
    co2_comedor         FLOAT,
    co2_habitacion      FLOAT,
    rain                FLOAT,
    wind_speed          FLOAT,
    sun_dusk            FLOAT,
    wind_direction      FLOAT,
    solar_irradiance    FLOAT,
    temp_exterior       FLOAT,
    humidity_exterior   FLOAT,
    pressure            FLOAT,
    col18               FLOAT,
    col19               FLOAT,
    col20               FLOAT,
    col21               FLOAT,
    col22               FLOAT,
    col23               FLOAT,
    col24               FLOAT,
    ingestion_timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    source_file         VARCHAR(500)
)
    CHANGE_TRACKING = TRUE
    COMMENT = 'Raw SML2010 indoor environment dataset (15-min intervals)';

CREATE OR REPLACE TABLE SAFETY_INCIDENTS_RAW (
    incident_date       VARCHAR(50),
    country             VARCHAR(100),
    local_site          VARCHAR(200),
    industry_sector     VARCHAR(100),
    accident_level      VARCHAR(10),
    potential_level     VARCHAR(10),
    genre               VARCHAR(50),
    employee_type       VARCHAR(100),
    critical_risk       VARCHAR(200),
    description         VARCHAR(5000),
    ingestion_timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    source_file         VARCHAR(500)
)
    CHANGE_TRACKING = TRUE
    COMMENT = 'Raw industrial safety and health incident records';

-- ============================================================================
-- SECTION 7: SNOWPIPE (auto-ingest, created AFTER tables exist)
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE SCHEMA RAW;

CREATE OR REPLACE PIPE PIPE_SENSOR_INGEST
    AUTO_INGEST = TRUE
    COMMENT = 'Auto-ingest pipe for real-time sensor readings'
    AS
    COPY INTO RAW.SENSOR_READINGS_RAW
    FROM @STG_SENSOR_DATA
    FILE_FORMAT = CSV_STANDARD_FORMAT
    ON_ERROR = 'CONTINUE';

CREATE OR REPLACE PIPE PIPE_AIR_QUALITY_INGEST
    AUTO_INGEST = TRUE
    COMMENT = 'Auto-ingest pipe for air quality datasets'
    AS
    COPY INTO RAW.AIR_QUALITY_RAW
    FROM @STG_AIR_QUALITY
    FILE_FORMAT = CSV_SEMICOLON_FORMAT
    ON_ERROR = 'CONTINUE';

-- ============================================================================
-- SECTION 8: STAGING TABLES
-- ============================================================================

USE SCHEMA STAGING;

CREATE OR REPLACE TRANSIENT TABLE SENSOR_READINGS_CLEAN (
    reading_id          NUMBER,
    factory_id          VARCHAR(50),
    sensor_node_id      VARCHAR(50),
    reading_timestamp   TIMESTAMP_NTZ,
    temperature_f       FLOAT,
    temperature_c       FLOAT,
    humidity_pct        FLOAT,
    co2_ppm             FLOAT,
    pm25_mg_m3          FLOAT,
    pm10_mg_m3          FLOAT,
    voc_mg_m3           FLOAT,
    noise_dba           FLOAT,
    light_lux           FLOAT,
    vibration_ms2       FLOAT,
    proximity_value     INTEGER,
    pressure_kpa        FLOAT,
    is_valid            BOOLEAN DEFAULT TRUE,
    quality_flags       ARRAY,
    cleaned_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (factory_id, reading_timestamp)
    COMMENT = 'Cleaned and validated sensor readings with quality flags';

CREATE OR REPLACE TRANSIENT TABLE AIR_QUALITY_UNIFIED (
    record_id           NUMBER AUTOINCREMENT,
    source_dataset      VARCHAR(50),
    reading_timestamp   TIMESTAMP_NTZ,
    co2_ppm             FLOAT,
    pm25                FLOAT,
    pm10                FLOAT,
    temperature_c       FLOAT,
    humidity_pct        FLOAT,
    voc_indicator       FLOAT,
    additional_metrics  VARIANT,
    quality_score       FLOAT,
    cleaned_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (source_dataset, reading_timestamp)
    COMMENT = 'Unified air quality data from all source datasets';

-- ============================================================================
-- SECTION 9: ANALYTICS TABLES
-- ============================================================================

USE SCHEMA ANALYTICS;

CREATE OR REPLACE TABLE DIM_FACTORY (
    factory_id          VARCHAR(50) PRIMARY KEY,
    factory_name        VARCHAR(200),
    country             VARCHAR(100),
    region              VARCHAR(100),
    industry_sector     VARCHAR(100),
    num_sensor_nodes    INTEGER,
    deployment_date     DATE,
    is_active           BOOLEAN DEFAULT TRUE,
    factory_metadata    VARIANT,
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    COMMENT = 'Factory dimension table — registry of monitored facilities';

CREATE OR REPLACE TABLE DIM_SENSOR_NODE (
    sensor_node_id      VARCHAR(50) PRIMARY KEY,
    factory_id          VARCHAR(50) REFERENCES DIM_FACTORY(factory_id),
    node_type           VARCHAR(50),
    location_zone       VARCHAR(100),
    sensors_available   ARRAY,
    firmware_version    VARCHAR(20),
    installed_date      DATE,
    is_active           BOOLEAN DEFAULT TRUE,
    last_seen           TIMESTAMP_NTZ
)
    COMMENT = 'Sensor node dimension — registry of deployed hardware';

CREATE OR REPLACE TABLE DIM_SAFETY_THRESHOLDS (
    threshold_id        NUMBER AUTOINCREMENT,
    metric_name         VARCHAR(100),
    unit                VARCHAR(50),
    threshold_type      VARCHAR(50),
    threshold_value     FLOAT,
    standard_source     VARCHAR(200),
    source_url          VARCHAR(500),
    effective_date      DATE DEFAULT CURRENT_DATE(),
    is_active           BOOLEAN DEFAULT TRUE,
    raw_config          VARIANT
)
    COMMENT = 'Safety threshold reference data from OSHA/ILO/EU standards';

CREATE OR REPLACE TABLE FACT_HOURLY_COMPLIANCE (
    compliance_id       NUMBER AUTOINCREMENT,
    factory_id          VARCHAR(50),
    sensor_node_id      VARCHAR(50),
    hour_timestamp      TIMESTAMP_NTZ,
    avg_temperature_c   FLOAT,
    avg_humidity_pct    FLOAT,
    avg_co2_ppm         FLOAT,
    avg_pm25            FLOAT,
    avg_noise_dba       FLOAT,
    avg_light_lux       FLOAT,
    avg_vibration_ms2   FLOAT,
    temperature_breaches    INTEGER DEFAULT 0,
    humidity_breaches       INTEGER DEFAULT 0,
    co2_breaches            INTEGER DEFAULT 0,
    pm25_breaches           INTEGER DEFAULT 0,
    noise_breaches          INTEGER DEFAULT 0,
    light_breaches          INTEGER DEFAULT 0,
    vibration_breaches      INTEGER DEFAULT 0,
    compliance_score        FLOAT,
    risk_level              VARCHAR(20),
    breach_details          VARIANT,
    computed_at             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (factory_id, hour_timestamp)
    COMMENT = 'Hourly aggregated compliance scores per factory/sensor';

CREATE OR REPLACE TABLE FACT_DAILY_COMPLIANCE (
    daily_compliance_id NUMBER AUTOINCREMENT,
    factory_id          VARCHAR(50),
    compliance_date     DATE,
    avg_compliance_score FLOAT,
    min_compliance_score FLOAT,
    max_compliance_score FLOAT,
    total_breaches      INTEGER,
    breach_breakdown    VARIANT,
    risk_level          VARCHAR(20),
    shift_hours_detected FLOAT,
    shift_compliance    BOOLEAN,
    computed_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (factory_id, compliance_date)
    COMMENT = 'Daily compliance summary per factory';

-- ============================================================================
-- SECTION 10: BLOCKCHAIN TABLES
-- ============================================================================

USE SCHEMA BLOCKCHAIN;

CREATE OR REPLACE TABLE REWARD_PAYOUTS (
    payout_id           NUMBER AUTOINCREMENT,
    factory_id          VARCHAR(50),
    payout_date         DATE,
    reward_type         VARCHAR(50),
    reward_amount_usd   FLOAT,
    solana_tx_hash      VARCHAR(128),
    solana_slot         NUMBER,
    compliance_period   VARCHAR(20),
    avg_compliance_score FLOAT,
    payout_status       VARCHAR(20),
    payout_metadata     VARIANT,
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    COMMENT = 'Blockchain reward payout records with Solana transaction references';

CREATE OR REPLACE TABLE COMPLIANCE_REPORTS_ONCHAIN (
    report_id           NUMBER AUTOINCREMENT,
    factory_id          VARCHAR(50),
    report_date         DATE,
    report_hash         VARCHAR(128),
    solana_tx_hash      VARCHAR(128),
    solana_slot         NUMBER,
    report_summary      VARIANT,
    published_at        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    COMMENT = 'Hashed compliance reports published to Solana blockchain';

-- ============================================================================
-- SECTION 11: GOVERNANCE — Tags, Masking, Row Access Policies
-- ============================================================================

USE SCHEMA GOVERNANCE;
USE WAREHOUSE ANALYTICS_WH;

-- Tags
CREATE OR REPLACE TAG DATA_SENSITIVITY
    ALLOWED_VALUES 'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'
    COMMENT = 'Data sensitivity classification';

CREATE OR REPLACE TAG DATA_DOMAIN
    ALLOWED_VALUES 'SENSOR', 'AIR_QUALITY', 'INDUSTRIAL', 'SAFETY', 'BLOCKCHAIN', 'COMPLIANCE', 'CONFIG'
    COMMENT = 'Business domain classification';

CREATE OR REPLACE TAG PII_TYPE
    ALLOWED_VALUES 'NONE', 'FACTORY_ID', 'LOCATION', 'FINANCIAL'
    COMMENT = 'PII classification';

CREATE OR REPLACE TAG DATA_FRESHNESS
    ALLOWED_VALUES 'REAL_TIME', 'HOURLY', 'DAILY', 'HISTORICAL'
    COMMENT = 'Expected data refresh frequency';

CREATE OR REPLACE TAG REGULATORY_STANDARD
    ALLOWED_VALUES 'OSHA', 'ILO', 'EU_DIRECTIVE', 'ASHRAE', 'NIOSH', 'CUSTOM'
    COMMENT = 'Which regulatory standard applies';

-- Apply tags
ALTER TABLE RAW.SENSOR_READINGS_RAW SET TAG
    DATA_SENSITIVITY = 'INTERNAL', DATA_DOMAIN = 'SENSOR',
    PII_TYPE = 'FACTORY_ID', DATA_FRESHNESS = 'REAL_TIME';

ALTER TABLE RAW.AIR_QUALITY_RAW SET TAG
    DATA_SENSITIVITY = 'PUBLIC', DATA_DOMAIN = 'AIR_QUALITY',
    PII_TYPE = 'NONE', DATA_FRESHNESS = 'HISTORICAL';

ALTER TABLE RAW.SAFETY_INCIDENTS_RAW SET TAG
    DATA_SENSITIVITY = 'CONFIDENTIAL', DATA_DOMAIN = 'SAFETY',
    PII_TYPE = 'LOCATION', DATA_FRESHNESS = 'HISTORICAL';

ALTER TABLE BLOCKCHAIN.REWARD_PAYOUTS SET TAG
    DATA_SENSITIVITY = 'RESTRICTED', DATA_DOMAIN = 'BLOCKCHAIN',
    PII_TYPE = 'FINANCIAL', DATA_FRESHNESS = 'DAILY';

ALTER TABLE ANALYTICS.FACT_HOURLY_COMPLIANCE SET TAG
    DATA_SENSITIVITY = 'INTERNAL', DATA_DOMAIN = 'COMPLIANCE', DATA_FRESHNESS = 'HOURLY';

ALTER TABLE ANALYTICS.FACT_DAILY_COMPLIANCE SET TAG
    DATA_SENSITIVITY = 'INTERNAL', DATA_DOMAIN = 'COMPLIANCE', DATA_FRESHNESS = 'DAILY';

-- Dynamic Data Masking
CREATE OR REPLACE MASKING POLICY MASK_FACTORY_ID AS
    (val VARCHAR) RETURNS VARCHAR ->
    CASE
        WHEN CURRENT_ROLE() IN ('SAFESHIFT_ADMIN', 'SAFESHIFT_AUDITOR') THEN val
        WHEN CURRENT_ROLE() = 'SAFESHIFT_ANALYST' THEN CONCAT('FAC-', LEFT(SHA2(val, 256), 8))
        ELSE '***MASKED***'
    END
    COMMENT = 'Masks factory IDs based on role';

CREATE OR REPLACE MASKING POLICY MASK_SOLANA_TX AS
    (val VARCHAR) RETURNS VARCHAR ->
    CASE
        WHEN CURRENT_ROLE() IN ('SAFESHIFT_ADMIN', 'SAFESHIFT_BLOCKCHAIN') THEN val
        ELSE CONCAT(LEFT(val, 8), '...', RIGHT(val, 4))
    END
    COMMENT = 'Masks Solana transaction hashes';

CREATE OR REPLACE MASKING POLICY MASK_FINANCIAL AS
    (val FLOAT) RETURNS FLOAT ->
    CASE
        WHEN CURRENT_ROLE() IN ('SAFESHIFT_ADMIN', 'SAFESHIFT_FINANCE') THEN val
        WHEN CURRENT_ROLE() = 'SAFESHIFT_AUDITOR' THEN ROUND(val, 0)
        ELSE NULL
    END
    COMMENT = 'Masks financial amounts';

ALTER TABLE BLOCKCHAIN.REWARD_PAYOUTS MODIFY COLUMN solana_tx_hash SET MASKING POLICY MASK_SOLANA_TX;
ALTER TABLE BLOCKCHAIN.REWARD_PAYOUTS MODIFY COLUMN reward_amount_usd SET MASKING POLICY MASK_FINANCIAL;
ALTER TABLE BLOCKCHAIN.COMPLIANCE_REPORTS_ONCHAIN MODIFY COLUMN solana_tx_hash SET MASKING POLICY MASK_SOLANA_TX;

-- Row Access Policy
CREATE OR REPLACE TABLE ANALYST_REGION_ASSIGNMENTS (
    username        VARCHAR(100),
    assigned_region VARCHAR(100),
    assigned_at     TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    COMMENT = 'Maps analysts to their authorized factory regions';

CREATE OR REPLACE ROW ACCESS POLICY FACTORY_REGION_ACCESS AS
    (row_factory_id VARCHAR) RETURNS BOOLEAN ->
    CASE
        WHEN CURRENT_ROLE() IN ('SAFESHIFT_ADMIN', 'SAFESHIFT_AUDITOR', 'ACCOUNTADMIN') THEN TRUE
        WHEN CURRENT_ROLE() = 'SAFESHIFT_ANALYST' THEN
            EXISTS (
                SELECT 1 FROM ANALYTICS.DIM_FACTORY f
                JOIN GOVERNANCE.ANALYST_REGION_ASSIGNMENTS a ON f.region = a.assigned_region
                WHERE f.factory_id = row_factory_id
                    AND a.username = CURRENT_USER()
            )
        ELSE TRUE
    END
    COMMENT = 'Row-level security: analysts see only their assigned regions';

ALTER TABLE ANALYTICS.FACT_HOURLY_COMPLIANCE
    ADD ROW ACCESS POLICY FACTORY_REGION_ACCESS ON (factory_id);
ALTER TABLE ANALYTICS.FACT_DAILY_COMPLIANCE
    ADD ROW ACCESS POLICY FACTORY_REGION_ACCESS ON (factory_id);

-- Audit Log
CREATE OR REPLACE TABLE AUDIT_LOG (
    audit_id            NUMBER AUTOINCREMENT,
    event_timestamp     TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    event_type          VARCHAR(50),
    actor               VARCHAR(100),
    factory_id          VARCHAR(50),
    event_details       VARIANT,
    source_schema       VARCHAR(50),
    source_table        VARCHAR(100)
)
    CLUSTER BY (event_timestamp)
    COMMENT = 'Immutable audit log for all significant platform events';

-- ============================================================================
-- SECTION 12: UDFs (SQL, JavaScript, Python)
-- ============================================================================

USE SCHEMA ANALYTICS;
USE WAREHOUSE ANALYTICS_WH;

CREATE OR REPLACE FUNCTION COMPUTE_COMPLIANCE_SCORE(
    temperature_c FLOAT, humidity_pct FLOAT, co2_ppm FLOAT,
    pm25_mg_m3 FLOAT, noise_dba FLOAT, light_lux FLOAT, vibration_ms2 FLOAT
)
RETURNS NUMBER
LANGUAGE SQL
COMMENT = 'Computes 0-100 compliance score based on OSHA/ILO thresholds'
AS
$$
    GREATEST(0, LEAST(100,
        100
        - IFF(temperature_c < 20 OR temperature_c > 24.4, 10, 0)
        - IFF(humidity_pct < 20 OR humidity_pct > 60, 5, 0)
        - IFF(co2_ppm > 5000, 30, IFF(co2_ppm > 1000, 15, 0))
        - IFF(pm25_mg_m3 > 5.0, 20, IFF(pm25_mg_m3 > 2.5, 10, 0))
        - IFF(noise_dba > 90, 20, IFF(noise_dba > 85, 10, 0))
        - IFF(light_lux < 110, 10, IFF(light_lux < 300, 5, 0))
        - IFF(vibration_ms2 > 5.0, 15, IFF(vibration_ms2 > 2.5, 8, 0))
    ))
$$;

CREATE OR REPLACE FUNCTION CLASSIFY_RISK_LEVEL(compliance_score FLOAT)
RETURNS VARCHAR LANGUAGE SQL AS
$$
    CASE
        WHEN compliance_score >= 80 THEN 'LOW'
        WHEN compliance_score >= 50 THEN 'MEDIUM'
        WHEN compliance_score >= 20 THEN 'HIGH'
        ELSE 'CRITICAL'
    END
$$;

CREATE OR REPLACE FUNCTION F_TO_C(temp_f FLOAT)
RETURNS FLOAT LANGUAGE SQL AS $$ (temp_f - 32) * 5.0 / 9.0 $$;

CREATE OR REPLACE FUNCTION C_TO_F(temp_c FLOAT)
RETURNS FLOAT LANGUAGE SQL AS $$ (temp_c * 9.0 / 5.0) + 32 $$;

CREATE OR REPLACE FUNCTION HEAT_INDEX(temp_f FLOAT, humidity_pct FLOAT)
RETURNS FLOAT LANGUAGE SQL
COMMENT = 'Simplified heat index (NOAA Rothfusz regression)'
AS
$$
    CASE WHEN temp_f < 80 THEN temp_f
    ELSE -42.379 + 2.04901523*temp_f + 10.14333127*humidity_pct
         - 0.22475541*temp_f*humidity_pct - 0.00683783*POW(temp_f,2)
         - 0.05481717*POW(humidity_pct,2) + 0.00122874*POW(temp_f,2)*humidity_pct
         + 0.00085282*temp_f*POW(humidity_pct,2) - 0.00000199*POW(temp_f,2)*POW(humidity_pct,2)
    END
$$;

CREATE OR REPLACE FUNCTION MAX_NOISE_EXPOSURE_HOURS(noise_dba FLOAT)
RETURNS FLOAT LANGUAGE SQL
COMMENT = 'Max exposure hours per OSHA 29 CFR 1910.95 Table G-16'
AS
$$
    CASE
        WHEN noise_dba < 85 THEN NULL
        WHEN noise_dba >= 115 THEN 0.25
        ELSE 8.0 / POW(2, (noise_dba - 90) / 5)
    END
$$;

-- JavaScript UDF: EPA AQI from PM2.5
CREATE OR REPLACE FUNCTION CALCULATE_AQI_PM25(pm25_value FLOAT)
RETURNS FLOAT LANGUAGE JAVASCRIPT
COMMENT = 'EPA AQI from PM2.5 using breakpoint interpolation'
AS
$$
    if (PM25_VALUE === null || PM25_VALUE < 0) return null;
    var bp = [
        {cL:0.0,cH:0.0121,iL:0,iH:50},{cL:0.0121,cH:0.0354,iL:51,iH:100},
        {cL:0.0354,cH:0.0554,iL:101,iH:150},{cL:0.0554,cH:0.1504,iL:151,iH:200},
        {cL:0.1504,cH:0.2504,iL:201,iH:300},{cL:0.2504,cH:0.3504,iL:301,iH:400},
        {cL:0.3504,cH:0.5004,iL:401,iH:500}
    ];
    for (var i=0;i<bp.length;i++) {
        if (PM25_VALUE>=bp[i].cL && PM25_VALUE<=bp[i].cH)
            return ((bp[i].iH-bp[i].iL)/(bp[i].cH-bp[i].cL))*(PM25_VALUE-bp[i].cL)+bp[i].iL;
    }
    return 500;
$$;

-- Python UDF (Snowpark): Detect shift patterns
CREATE OR REPLACE FUNCTION DETECT_SHIFT_PATTERN(timestamps ARRAY)
RETURNS VARIANT LANGUAGE PYTHON RUNTIME_VERSION = '3.11'
PACKAGES = ('numpy') HANDLER = 'detect_shifts'
COMMENT = 'Detects shift start/end and duration from timestamps'
AS
$$
import numpy as np
from datetime import datetime
def detect_shifts(timestamps):
    if not timestamps or len(timestamps) < 2:
        return {"shift_detected": False, "reason": "insufficient data"}
    hours = []
    for ts in timestamps:
        try:
            dt = datetime.fromisoformat(str(ts).replace('Z','+00:00')) if isinstance(ts,str) else ts
            hours.append(dt.hour + dt.minute/60.0)
        except: continue
    if len(hours) < 2:
        return {"shift_detected": False, "reason": "parse failure"}
    hours = np.array(hours)
    return {
        "shift_detected": True,
        "estimated_start_hour": round(float(np.min(hours)),1),
        "estimated_end_hour": round(float(np.max(hours)),1),
        "estimated_duration_hours": round(float(np.max(hours)-np.min(hours)),1),
        "exceeds_standard_shift": bool(np.max(hours)-np.min(hours) > 8),
        "exceeds_extended_shift": bool(np.max(hours)-np.min(hours) > 10),
        "reading_count": len(hours)
    }
$$;

-- View needed by the Table UDF below (must be created first)
CREATE OR REPLACE VIEW V_BREACH_DETAILS_FLAT AS
    SELECT hc.factory_id, hc.hour_timestamp, hc.compliance_score,
        kv.key AS breach_category, kv.value::INTEGER AS breach_count
    FROM FACT_HOURLY_COMPLIANCE hc, LATERAL FLATTEN(INPUT => hc.breach_details) kv
    WHERE kv.value::INTEGER > 0;

-- Table UDF
CREATE OR REPLACE FUNCTION GET_FACTORY_BREACH_SUMMARY(
    p_factory_id VARCHAR, p_start_date DATE, p_end_date DATE
)
RETURNS TABLE (breach_category VARCHAR, total_breaches NUMBER, breach_hours NUMBER, pct_of_hours NUMBER(10,2))
LANGUAGE SQL AS
$$
    SELECT breach_category, SUM(breach_count), COUNT(DISTINCT hour_timestamp),
        COUNT(DISTINCT hour_timestamp)*100.0/NULLIF(DATEDIFF('HOUR',p_start_date,p_end_date),0)
    FROM V_BREACH_DETAILS_FLAT
    WHERE factory_id = p_factory_id AND hour_timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY breach_category
$$;

-- ============================================================================
-- SECTION 13: STORED PROCEDURES
-- ============================================================================

CREATE OR REPLACE PROCEDURE SP_LOAD_SAFETY_THRESHOLDS(config_json VARIANT)
RETURNS VARCHAR LANGUAGE SQL
COMMENT = 'Loads safety thresholds from JSON config into DIM_SAFETY_THRESHOLDS'
AS
$$
BEGIN
    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'temperature','F','recommended_min',:config_json:temperature.recommended_min,'OSHA/ASHRAE',:config_json:temperature
    UNION ALL SELECT 'temperature','F','recommended_max',:config_json:temperature.recommended_max,'OSHA/ASHRAE',:config_json:temperature
    UNION ALL SELECT 'temperature','F','heat_action_trigger',:config_json:temperature.heat_action_trigger,'OSHA/ASHRAE',:config_json:temperature;

    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'co2','ppm','pel_8hr_twa',:config_json:air_quality.co2.pel_8hr_twa,'OSHA PEL Table Z-1',:config_json:air_quality.co2
    UNION ALL SELECT 'co2','ppm','recommended_max',:config_json:air_quality.co2.recommended_max,'OSHA CO2 Guidelines',:config_json:air_quality.co2
    UNION ALL SELECT 'co2','ppm','stel_15min',:config_json:air_quality.co2.stel_15min,'NIOSH',:config_json:air_quality.co2
    UNION ALL SELECT 'co2','ppm','idlh',:config_json:air_quality.co2.idlh,'NIOSH',:config_json:air_quality.co2;

    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'pm25','mg/m3','respirable_pel',:config_json:air_quality.pm2_5.respirable_fraction_pel,'OSHA PNOR',:config_json:air_quality.pm2_5
    UNION ALL SELECT 'pm25','mg/m3','total_dust_pel',:config_json:air_quality.pm2_5.total_dust_pel,'OSHA PNOR',:config_json:air_quality.pm2_5;

    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'noise','dBA','action_level',:config_json:noise.action_level_8hr_twa,'OSHA 29 CFR 1910.95',:config_json:noise
    UNION ALL SELECT 'noise','dBA','pel_8hr_twa',:config_json:noise.pel_8hr_twa,'OSHA 29 CFR 1910.95',:config_json:noise;

    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'lighting','lux','factory_floor_min',:config_json:lighting.factory_floor_min,'OSHA 29 CFR 1926.56',:config_json:lighting
    UNION ALL SELECT 'lighting','lux','machine_shop_min',:config_json:lighting.machine_shop_min,'OSHA 29 CFR 1926.56',:config_json:lighting;

    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'vibration_hand_arm','m/s2','action_value',:config_json:vibration.hand_arm.action_value_8hr,'EU Directive 2002/44/EC',:config_json:vibration
    UNION ALL SELECT 'vibration_hand_arm','m/s2','exposure_limit',:config_json:vibration.hand_arm.exposure_limit_8hr,'EU Directive 2002/44/EC',:config_json:vibration;

    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'shift_length','hours','standard_daily_max',:config_json:shift_length.standard_daily_max,'ILO Convention No. 1',:config_json:shift_length
    UNION ALL SELECT 'shift_length','hours','weekly_max',:config_json:shift_length.weekly_max,'ILO Convention No. 1',:config_json:shift_length;

    RETURN 'Safety thresholds loaded successfully';
END;
$$;

CREATE OR REPLACE PROCEDURE SP_PUBLISH_COMPLIANCE_REPORT(p_factory_id VARCHAR, p_report_date DATE)
RETURNS VARIANT LANGUAGE SQL
COMMENT = 'Generates compliance report, hashes it, prepares for Solana publishing'
AS
$$
DECLARE
    v_report VARIANT;
    v_hash VARCHAR;
BEGIN
    SELECT OBJECT_CONSTRUCT(
        'factory_id',factory_id,'date',compliance_date,'avg_score',avg_compliance_score,
        'min_score',min_compliance_score,'max_score',max_compliance_score,
        'breaches',total_breaches,'breach_breakdown',breach_breakdown,
        'risk_level',risk_level,'shift_hours',shift_hours_detected,
        'shift_compliant',shift_compliance,'generated_at',CURRENT_TIMESTAMP()
    ) INTO :v_report
    FROM ANALYTICS.FACT_DAILY_COMPLIANCE
    WHERE factory_id = :p_factory_id AND compliance_date = :p_report_date;

    v_hash := SHA2(v_report::VARCHAR, 256);

    INSERT INTO BLOCKCHAIN.COMPLIANCE_REPORTS_ONCHAIN (factory_id, report_date, report_hash, report_summary)
    VALUES (:p_factory_id, :p_report_date, :v_hash, :v_report);

    INSERT INTO GOVERNANCE.AUDIT_LOG (event_type, actor, factory_id, event_details, source_schema, source_table)
    VALUES ('REPORT_PUBLISHED', CURRENT_USER(), :p_factory_id,
            OBJECT_CONSTRUCT('report_hash', :v_hash, 'report_date', :p_report_date),
            'BLOCKCHAIN', 'COMPLIANCE_REPORTS_ONCHAIN');

    RETURN OBJECT_CONSTRUCT('status','SUCCESS','factory_id',:p_factory_id,'report_date',:p_report_date,'report_hash',:v_hash);
END;
$$;

-- ============================================================================
-- SECTION 14: STREAMS (Change Data Capture)
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE SCHEMA RAW;
USE WAREHOUSE INGEST_WH;

CREATE OR REPLACE STREAM STREAM_SENSOR_RAW
    ON TABLE RAW.SENSOR_READINGS_RAW APPEND_ONLY = TRUE SHOW_INITIAL_ROWS = FALSE
    COMMENT = 'CDC stream on raw sensor readings';

CREATE OR REPLACE STREAM STREAM_AIR_QUALITY_RAW
    ON TABLE RAW.AIR_QUALITY_RAW APPEND_ONLY = TRUE
    COMMENT = 'CDC stream on raw air quality data';

CREATE OR REPLACE STREAM STREAM_SENSOR_CLEAN
    ON TABLE STAGING.SENSOR_READINGS_CLEAN APPEND_ONLY = TRUE
    COMMENT = 'CDC stream on cleaned sensor data';

CREATE OR REPLACE STREAM STREAM_DAILY_COMPLIANCE
    ON TABLE ANALYTICS.FACT_DAILY_COMPLIANCE APPEND_ONLY = TRUE
    COMMENT = 'CDC stream on daily compliance';

-- ============================================================================
-- SECTION 15: TASKS (DAG pipeline)
-- ============================================================================

CREATE OR REPLACE TASK TASK_CLEAN_SENSOR_DATA
    WAREHOUSE = INGEST_WH
    SCHEDULE = '5 MINUTE'
    ALLOW_OVERLAPPING_EXECUTION = FALSE
    COMMENT = 'Root task: cleans raw sensor data'
    WHEN SYSTEM$STREAM_HAS_DATA('STREAM_SENSOR_RAW')
AS
    MERGE INTO STAGING.SENSOR_READINGS_CLEAN AS target
    USING (
        SELECT reading_id, factory_id, sensor_node_id, reading_timestamp,
            temperature_f, (temperature_f-32)*5.0/9.0 AS temperature_c, humidity_pct,
            co2_ppm, pm25_mg_m3, pm10_mg_m3, voc_mg_m3, noise_dba,
            light_lux, vibration_ms2, proximity_value, pressure_kpa,
            CASE WHEN co2_ppm<0 OR temperature_f<-40 OR humidity_pct<0 OR humidity_pct>100 OR noise_dba<0
                THEN FALSE ELSE TRUE END AS is_valid,
            ARRAY_CONSTRUCT_COMPACT(
                IFF(co2_ppm<0,'NEGATIVE_CO2',NULL),
                IFF(temperature_f<-40 OR temperature_f>160,'TEMP_OUT_OF_RANGE',NULL),
                IFF(humidity_pct<0 OR humidity_pct>100,'HUMIDITY_OUT_OF_RANGE',NULL)
            ) AS quality_flags
        FROM STREAM_SENSOR_RAW
    ) AS source ON target.reading_id = source.reading_id
    WHEN NOT MATCHED THEN INSERT (
        reading_id,factory_id,sensor_node_id,reading_timestamp,temperature_f,temperature_c,
        humidity_pct,co2_ppm,pm25_mg_m3,pm10_mg_m3,voc_mg_m3,noise_dba,light_lux,
        vibration_ms2,proximity_value,pressure_kpa,is_valid,quality_flags
    ) VALUES (
        source.reading_id,source.factory_id,source.sensor_node_id,source.reading_timestamp,
        source.temperature_f,source.temperature_c,source.humidity_pct,source.co2_ppm,
        source.pm25_mg_m3,source.pm10_mg_m3,source.voc_mg_m3,source.noise_dba,
        source.light_lux,source.vibration_ms2,source.proximity_value,source.pressure_kpa,
        source.is_valid,source.quality_flags
    );

CREATE OR REPLACE TASK TASK_COMPUTE_HOURLY_COMPLIANCE
    WAREHOUSE = ANALYTICS_WH
    COMMENT = 'Child task: hourly compliance scores'
    AFTER TASK_CLEAN_SENSOR_DATA
AS
    INSERT INTO ANALYTICS.FACT_HOURLY_COMPLIANCE (
        factory_id, sensor_node_id, hour_timestamp,
        avg_temperature_c, avg_humidity_pct, avg_co2_ppm, avg_pm25,
        avg_noise_dba, avg_light_lux, avg_vibration_ms2,
        temperature_breaches, humidity_breaches, co2_breaches, pm25_breaches,
        noise_breaches, light_breaches, vibration_breaches,
        compliance_score, risk_level, breach_details
    )
    SELECT factory_id, sensor_node_id, DATE_TRUNC('HOUR', reading_timestamp),
        AVG(temperature_c), AVG(humidity_pct), AVG(co2_ppm), AVG(pm25_mg_m3),
        AVG(noise_dba), AVG(light_lux), AVG(vibration_ms2),
        SUM(IFF(temperature_c<20 OR temperature_c>24.4,1,0)),
        SUM(IFF(humidity_pct<20 OR humidity_pct>60,1,0)),
        SUM(IFF(co2_ppm>1000,1,0)), SUM(IFF(pm25_mg_m3>5.0,1,0)),
        SUM(IFF(noise_dba>85,1,0)), SUM(IFF(light_lux<300,1,0)),
        SUM(IFF(vibration_ms2>2.5,1,0)),
        GREATEST(0,100-(SUM(IFF(temperature_c<20 OR temperature_c>24.4,1,0))*5
            +SUM(IFF(humidity_pct<20 OR humidity_pct>60,1,0))*3
            +SUM(IFF(co2_ppm>1000,1,0))*15+SUM(IFF(pm25_mg_m3>5.0,1,0))*20
            +SUM(IFF(noise_dba>85,1,0))*10+SUM(IFF(light_lux<300,1,0))*5
            +SUM(IFF(vibration_ms2>2.5,1,0))*10)),
        CASE WHEN GREATEST(0,100-(SUM(IFF(co2_ppm>1000,1,0))*15+SUM(IFF(pm25_mg_m3>5.0,1,0))*20+SUM(IFF(noise_dba>85,1,0))*10))>=80 THEN 'LOW'
            WHEN GREATEST(0,100-(SUM(IFF(co2_ppm>1000,1,0))*15+SUM(IFF(pm25_mg_m3>5.0,1,0))*20+SUM(IFF(noise_dba>85,1,0))*10))>=50 THEN 'MEDIUM'
            WHEN GREATEST(0,100-(SUM(IFF(co2_ppm>1000,1,0))*15+SUM(IFF(pm25_mg_m3>5.0,1,0))*20+SUM(IFF(noise_dba>85,1,0))*10))>=20 THEN 'HIGH'
            ELSE 'CRITICAL' END,
        OBJECT_CONSTRUCT('temperature',SUM(IFF(temperature_c<20 OR temperature_c>24.4,1,0)),
            'humidity',SUM(IFF(humidity_pct<20 OR humidity_pct>60,1,0)),
            'co2',SUM(IFF(co2_ppm>1000,1,0)),'pm25',SUM(IFF(pm25_mg_m3>5.0,1,0)),
            'noise',SUM(IFF(noise_dba>85,1,0)),'light',SUM(IFF(light_lux<300,1,0)),
            'vibration',SUM(IFF(vibration_ms2>2.5,1,0)))
    FROM STREAM_SENSOR_CLEAN WHERE is_valid = TRUE
    GROUP BY factory_id, sensor_node_id, DATE_TRUNC('HOUR', reading_timestamp);

CREATE OR REPLACE TASK TASK_UPDATE_FEATURE_STORE
    WAREHOUSE = ML_WH
    COMMENT = 'Child task: updates ML feature store'
    AFTER TASK_COMPUTE_HOURLY_COMPLIANCE
AS
    SELECT 1; -- Placeholder: full feature store logic in 05_streams_and_tasks.sql

CREATE OR REPLACE TASK TASK_LOG_PIPELINE_RUN
    WAREHOUSE = INGEST_WH
    COMMENT = 'Child task: logs pipeline completion'
    AFTER TASK_UPDATE_FEATURE_STORE
AS
    INSERT INTO GOVERNANCE.AUDIT_LOG (event_type, actor, event_details, source_schema)
    SELECT 'PIPELINE_COMPLETE','SYSTEM',
        OBJECT_CONSTRUCT('pipeline','SENSOR_DATA_PIPELINE','completed_at',CURRENT_TIMESTAMP()),'RAW';

CREATE OR REPLACE TASK TASK_DAILY_COMPLIANCE_ROLLUP
    WAREHOUSE = ANALYTICS_WH
    SCHEDULE = 'USING CRON 0 2 * * * America/New_York'
    COMMENT = 'Daily rollup of hourly compliance'
AS
    INSERT INTO ANALYTICS.FACT_DAILY_COMPLIANCE (
        factory_id, compliance_date, avg_compliance_score, min_compliance_score,
        max_compliance_score, total_breaches, breach_breakdown, risk_level,
        shift_hours_detected, shift_compliance
    )
    SELECT factory_id, hour_timestamp::DATE, AVG(compliance_score), MIN(compliance_score),
        MAX(compliance_score),
        SUM(temperature_breaches+humidity_breaches+co2_breaches+pm25_breaches+noise_breaches+light_breaches+vibration_breaches),
        OBJECT_CONSTRUCT('temperature',SUM(temperature_breaches),'humidity',SUM(humidity_breaches),
            'co2',SUM(co2_breaches),'pm25',SUM(pm25_breaches),'noise',SUM(noise_breaches),
            'light',SUM(light_breaches),'vibration',SUM(vibration_breaches)),
        CASE WHEN AVG(compliance_score)>=80 THEN 'LOW' WHEN AVG(compliance_score)>=50 THEN 'MEDIUM'
            WHEN AVG(compliance_score)>=20 THEN 'HIGH' ELSE 'CRITICAL' END,
        COUNT(DISTINCT DATE_TRUNC('HOUR',hour_timestamp)),
        COUNT(DISTINCT DATE_TRUNC('HOUR',hour_timestamp)) <= 10
    FROM ANALYTICS.FACT_HOURLY_COMPLIANCE
    WHERE hour_timestamp::DATE = CURRENT_DATE()-1
    GROUP BY factory_id, hour_timestamp::DATE;

CREATE OR REPLACE TASK TASK_EVALUATE_REWARDS
    WAREHOUSE = ANALYTICS_WH
    COMMENT = 'Evaluates reward eligibility'
    AFTER TASK_DAILY_COMPLIANCE_ROLLUP
AS
    INSERT INTO BLOCKCHAIN.REWARD_PAYOUTS (
        factory_id, payout_date, reward_type, reward_amount_usd,
        compliance_period, avg_compliance_score, payout_status, payout_metadata
    )
    SELECT factory_id, CURRENT_DATE(),
        CASE WHEN avg_compliance_score>=95 THEN 'CERTIFICATION' WHEN avg_compliance_score>=85 THEN 'INSURANCE_DISCOUNT'
            WHEN avg_compliance_score>=75 THEN 'STABLECOIN' ELSE NULL END,
        CASE WHEN avg_compliance_score>=95 THEN 500 WHEN avg_compliance_score>=85 THEN 200
            WHEN avg_compliance_score>=75 THEN 100 ELSE 0 END,
        TO_CHAR(CURRENT_DATE()-1,'YYYY-"W"IW'), avg_compliance_score, 'PENDING',
        OBJECT_CONSTRUCT('compliance_date',compliance_date,'risk_level',risk_level,
            'total_breaches',total_breaches,'shift_compliant',shift_compliance)
    FROM ANALYTICS.FACT_DAILY_COMPLIANCE
    WHERE compliance_date = CURRENT_DATE()-1 AND avg_compliance_score >= 75;

-- Resume tasks (leaf tasks first, then parents)
ALTER TASK TASK_LOG_PIPELINE_RUN RESUME;
ALTER TASK TASK_UPDATE_FEATURE_STORE RESUME;
ALTER TASK TASK_COMPUTE_HOURLY_COMPLIANCE RESUME;
ALTER TASK TASK_CLEAN_SENSOR_DATA RESUME;
ALTER TASK TASK_EVALUATE_REWARDS RESUME;
ALTER TASK TASK_DAILY_COMPLIANCE_ROLLUP RESUME;

-- ============================================================================
-- SECTION 16: DYNAMIC TABLES
-- ============================================================================

USE SCHEMA STAGING;

CREATE OR REPLACE DYNAMIC TABLE DT_AIR_QUALITY_UNIFIED
    TARGET_LAG = '30 minutes'
    WAREHOUSE = INGEST_WH
    COMMENT = 'Dynamic table: auto-unifies all air quality data sources'
AS
    SELECT 'AQ2023' AS source_dataset,
        TRY_TO_TIMESTAMP(time_str, 'DD/MM/YYYY HH24:MI') AS reading_timestamp,
        co2_ppm, pm25, pm10, temperature AS temperature_c, humidity AS humidity_pct,
        NULL AS voc_indicator,
        OBJECT_CONSTRUCT('status',status,'category_1',category_1) AS additional_metrics
    FROM RAW.AIR_QUALITY_RAW WHERE co2_ppm IS NOT NULL
    UNION ALL
    SELECT 'UCI2004',
        TRY_TO_TIMESTAMP(CONCAT(date_str,' ',time_str),'DD/MM/YYYY HH24:MI:SS'),
        NULL, NULL, NULL, temperature, relative_humidity, c6h6_gt,
        OBJECT_CONSTRUCT('co_gt',co_gt,'nox_gt',nox_gt,'no2_gt',no2_gt)
    FROM RAW.AIR_QUALITY_UCI_RAW WHERE temperature IS NOT NULL
    UNION ALL
    SELECT 'BEIJING',
        TRY_TO_TIMESTAMP(CONCAT(year,'-',LPAD(month,2,'0'),'-',LPAD(day,2,'0'),' ',LPAD(hour,2,'0'),':00:00')),
        NULL, pm25, NULL, temp, NULL, NULL,
        OBJECT_CONSTRUCT('dewp',dewp,'pres',pres,'cbwd',cbwd,'iws',iws)
    FROM RAW.BEIJING_PM25_RAW WHERE pm25 IS NOT NULL
    UNION ALL
    SELECT 'SML2010', TO_TIMESTAMP(epoch_time), co2_comedor, NULL, NULL,
        temp_comedor_c, humidity_comedor, NULL,
        OBJECT_CONSTRUCT('temp_habitacion',temp_habitacion_c,'co2_habitacion',co2_habitacion,
            'lighting',lighting_comedor,'solar_irradiance',solar_irradiance)
    FROM RAW.SML2010_RAW WHERE temp_comedor_c IS NOT NULL;

USE SCHEMA ANALYTICS;

CREATE OR REPLACE DYNAMIC TABLE DT_FACTORY_DASHBOARD
    TARGET_LAG = '5 minutes'
    WAREHOUSE = ANALYTICS_WH
    COMMENT = 'Dynamic table: real-time factory status dashboard'
AS
    SELECT f.factory_id, f.factory_name, f.country, f.region, f.industry_sector,
        latest.hour_timestamp AS last_reading_time,
        latest.avg_temperature_c AS current_temp_c, latest.avg_humidity_pct AS current_humidity,
        latest.avg_co2_ppm AS current_co2, latest.avg_pm25 AS current_pm25,
        latest.avg_noise_dba AS current_noise, latest.avg_light_lux AS current_light,
        latest.compliance_score AS current_compliance_score, latest.risk_level AS current_risk_level,
        latest.breach_details AS current_breaches,
        AVG(hc.compliance_score) AS avg_score_24h, MIN(hc.compliance_score) AS min_score_24h,
        COUNT(DISTINCT hc.hour_timestamp) AS active_hours_24h,
        SUM(hc.co2_breaches+hc.pm25_breaches+hc.noise_breaches) AS critical_breaches_24h,
        CASE WHEN AVG(hc.compliance_score)>=95 THEN 'CERTIFICATION ELIGIBLE'
            WHEN AVG(hc.compliance_score)>=85 THEN 'INSURANCE DISCOUNT ELIGIBLE'
            WHEN AVG(hc.compliance_score)>=75 THEN 'STABLECOIN REWARD ELIGIBLE'
            ELSE 'NOT ELIGIBLE' END AS reward_status
    FROM DIM_FACTORY f
    LEFT JOIN FACT_HOURLY_COMPLIANCE hc ON f.factory_id=hc.factory_id
        AND hc.hour_timestamp >= DATEADD('HOUR',-24,CURRENT_TIMESTAMP())
    LEFT JOIN (SELECT * FROM FACT_HOURLY_COMPLIANCE
        QUALIFY ROW_NUMBER() OVER (PARTITION BY factory_id ORDER BY hour_timestamp DESC) = 1
    ) latest ON f.factory_id = latest.factory_id
    WHERE f.is_active = TRUE
    GROUP BY f.factory_id,f.factory_name,f.country,f.region,f.industry_sector,
        latest.hour_timestamp,latest.avg_temperature_c,latest.avg_humidity_pct,
        latest.avg_co2_ppm,latest.avg_pm25,latest.avg_noise_dba,
        latest.avg_light_lux,latest.compliance_score,latest.risk_level,latest.breach_details;

CREATE OR REPLACE DYNAMIC TABLE DT_INCIDENT_ANALYTICS
    TARGET_LAG = '1 hour'
    WAREHOUSE = ANALYTICS_WH
    COMMENT = 'Dynamic table: incident pattern analysis'
AS
    SELECT country, industry_sector, accident_level, critical_risk,
        COUNT(*) AS incident_count, COUNT(DISTINCT local_site) AS affected_sites,
        ARRAY_AGG(DISTINCT potential_level) AS potential_levels
    FROM RAW.SAFETY_INCIDENTS_RAW
    GROUP BY country, industry_sector, accident_level, critical_risk;

-- ============================================================================
-- SECTION 17: VIEWS (Materialized, Secure, Standard)
-- ============================================================================

USE SCHEMA ANALYTICS;

CREATE OR REPLACE SECURE VIEW SV_PUBLIC_COMPLIANCE_SUMMARY AS
    SELECT f.country, f.region, f.industry_sector, dc.compliance_date,
        COUNT(DISTINCT dc.factory_id) AS factories_monitored,
        AVG(dc.avg_compliance_score) AS region_avg_score,
        SUM(IFF(dc.risk_level='LOW',1,0)) AS factories_low_risk,
        SUM(IFF(dc.risk_level IN ('HIGH','CRITICAL'),1,0)) AS factories_high_risk
    FROM FACT_DAILY_COMPLIANCE dc JOIN DIM_FACTORY f ON dc.factory_id=f.factory_id
    GROUP BY f.country, f.region, f.industry_sector, dc.compliance_date;

CREATE OR REPLACE SECURE VIEW SV_BLOCKCHAIN_VERIFICATION AS
    SELECT r.report_date, r.report_hash, r.solana_tx_hash, f.country, f.region, r.report_summary
    FROM BLOCKCHAIN.COMPLIANCE_REPORTS_ONCHAIN r
    JOIN DIM_FACTORY f ON r.factory_id = f.factory_id;

-- V_BREACH_DETAILS_FLAT already created in Section 12 (before UDTF that needs it)

CREATE OR REPLACE VIEW V_FACTORY_METADATA_FLAT AS
    SELECT f.factory_id, f.factory_name, kv.key AS metadata_key, kv.value::VARCHAR AS metadata_value
    FROM DIM_FACTORY f, LATERAL FLATTEN(INPUT => f.factory_metadata, OUTER => TRUE) kv;

CREATE OR REPLACE VIEW V_SENSOR_CAPABILITIES AS
    SELECT sn.sensor_node_id, sn.factory_id, sn.node_type, s.value::VARCHAR AS sensor_type
    FROM DIM_SENSOR_NODE sn, LATERAL FLATTEN(INPUT => sn.sensors_available) s;

-- ============================================================================
-- SECTION 18: CORTEX ML VIEWS
-- ============================================================================

USE SCHEMA ML;
USE WAREHOUSE CORTEX_WH;

CREATE OR REPLACE VIEW V_ANOMALY_TRAINING_DATA AS
    SELECT reading_timestamp, factory_id, temperature_c, humidity_pct, co2_ppm,
        pm25_mg_m3, noise_dba, light_lux, vibration_ms2
    FROM STAGING.SENSOR_READINGS_CLEAN WHERE is_valid = TRUE ORDER BY reading_timestamp;

CREATE OR REPLACE VIEW V_CONTRIBUTION_DATA AS
    SELECT compliance_date, factory_id, avg_compliance_score AS metric,
        total_breaches, f.country, f.industry_sector, f.region
    FROM ANALYTICS.FACT_DAILY_COMPLIANCE dc
    JOIN ANALYTICS.DIM_FACTORY f ON dc.factory_id = f.factory_id;

-- Cortex LLM views (these create the view definitions; they run Cortex when queried)
CREATE OR REPLACE VIEW V_CORTEX_COMPLIANCE_REPORTS AS
    SELECT dc.factory_id, dc.compliance_date, dc.avg_compliance_score, dc.risk_level,
        SNOWFLAKE.CORTEX.COMPLETE('mistral-large2',
            CONCAT('You are a factory safety compliance analyst. Generate a concise report. ',
                'Factory: ',dc.factory_id,', Score: ',dc.avg_compliance_score::VARCHAR,
                '/100, Risk: ',dc.risk_level,', Breaches: ',dc.total_breaches::VARCHAR)
        ) AS ai_report_summary
    FROM ANALYTICS.FACT_DAILY_COMPLIANCE dc WHERE dc.compliance_date = CURRENT_DATE()-1;

CREATE OR REPLACE VIEW V_INCIDENT_SUMMARIES AS
    SELECT incident_date, country, industry_sector, accident_level, description,
        SNOWFLAKE.CORTEX.SUMMARIZE(description) AS ai_summary
    FROM RAW.SAFETY_INCIDENTS_RAW WHERE description IS NOT NULL AND LENGTH(description)>50;

CREATE OR REPLACE VIEW V_INCIDENT_SENTIMENT AS
    SELECT incident_date, country, accident_level, description,
        SNOWFLAKE.CORTEX.SENTIMENT(description) AS sentiment_score
    FROM RAW.SAFETY_INCIDENTS_RAW WHERE description IS NOT NULL;

CREATE OR REPLACE VIEW V_INCIDENTS_ENGLISH AS
    SELECT incident_date, country, industry_sector, description,
        SNOWFLAKE.CORTEX.TRANSLATE(description,'pt','en') AS description_english,
        SNOWFLAKE.CORTEX.TRANSLATE(critical_risk,'pt','en') AS critical_risk_english
    FROM RAW.SAFETY_INCIDENTS_RAW WHERE description IS NOT NULL;

CREATE OR REPLACE VIEW V_INCIDENT_ROOT_CAUSES AS
    SELECT incident_date, country, description,
        SNOWFLAKE.CORTEX.EXTRACT_ANSWER(description,'What was the root cause?') AS root_cause,
        SNOWFLAKE.CORTEX.EXTRACT_ANSWER(description,'What body part was injured?') AS injury
    FROM RAW.SAFETY_INCIDENTS_RAW WHERE description IS NOT NULL AND LENGTH(description)>100;

-- ML Feature Store table
CREATE OR REPLACE TABLE FEATURE_STORE (
    feature_timestamp TIMESTAMP_NTZ, factory_id VARCHAR(50),
    co2_1h_avg FLOAT, co2_1h_std FLOAT, co2_24h_avg FLOAT, co2_24h_max FLOAT,
    temp_1h_avg FLOAT, temp_1h_std FLOAT, temp_24h_avg FLOAT,
    humidity_1h_avg FLOAT, pm25_1h_avg FLOAT, pm25_24h_max FLOAT,
    noise_1h_avg FLOAT, noise_1h_max FLOAT,
    heat_index FLOAT, air_quality_index FLOAT, breach_rate_24h FLOAT,
    hour_of_day INTEGER, day_of_week INTEGER, is_weekend BOOLEAN,
    minutes_since_shift_start FLOAT,
    co2_anomaly_flag BOOLEAN, temp_anomaly_flag BOOLEAN,
    computed_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (factory_id, feature_timestamp)
    COMMENT = 'Pre-computed ML features for external model training';

-- ============================================================================
-- SECTION 19: RBAC ROLES
-- ============================================================================

USE ROLE ACCOUNTADMIN;

CREATE OR REPLACE ROLE SAFESHIFT_ADMIN COMMENT = 'Full access to all SafeShift data';
CREATE OR REPLACE ROLE SAFESHIFT_ANALYST COMMENT = 'Read access to analytics/staging';
CREATE OR REPLACE ROLE SAFESHIFT_AUDITOR COMMENT = 'Read access to compliance/blockchain/governance';
CREATE OR REPLACE ROLE SAFESHIFT_ML_ENGINEER COMMENT = 'Read/write ML schema';
CREATE OR REPLACE ROLE SAFESHIFT_BLOCKCHAIN COMMENT = 'Read/write blockchain schema';
CREATE OR REPLACE ROLE SAFESHIFT_FINANCE COMMENT = 'Read access to financial data';

GRANT ROLE SAFESHIFT_ANALYST TO ROLE SAFESHIFT_ADMIN;
GRANT ROLE SAFESHIFT_AUDITOR TO ROLE SAFESHIFT_ADMIN;
GRANT ROLE SAFESHIFT_ML_ENGINEER TO ROLE SAFESHIFT_ADMIN;
GRANT ROLE SAFESHIFT_BLOCKCHAIN TO ROLE SAFESHIFT_ADMIN;
GRANT ROLE SAFESHIFT_FINANCE TO ROLE SAFESHIFT_AUDITOR;

GRANT USAGE ON DATABASE SAFE_SHIFT TO ROLE SAFESHIFT_ANALYST;
GRANT USAGE ON DATABASE SAFE_SHIFT TO ROLE SAFESHIFT_AUDITOR;
GRANT USAGE ON DATABASE SAFE_SHIFT TO ROLE SAFESHIFT_ML_ENGINEER;
GRANT USAGE ON SCHEMA SAFE_SHIFT.ANALYTICS TO ROLE SAFESHIFT_ANALYST;
GRANT SELECT ON ALL TABLES IN SCHEMA SAFE_SHIFT.ANALYTICS TO ROLE SAFESHIFT_ANALYST;
GRANT SELECT ON ALL VIEWS IN SCHEMA SAFE_SHIFT.ANALYTICS TO ROLE SAFESHIFT_ANALYST;
GRANT USAGE ON SCHEMA SAFE_SHIFT.STAGING TO ROLE SAFESHIFT_ANALYST;
GRANT SELECT ON ALL TABLES IN SCHEMA SAFE_SHIFT.STAGING TO ROLE SAFESHIFT_ANALYST;
GRANT USAGE ON SCHEMA SAFE_SHIFT.ANALYTICS TO ROLE SAFESHIFT_AUDITOR;
GRANT SELECT ON ALL TABLES IN SCHEMA SAFE_SHIFT.ANALYTICS TO ROLE SAFESHIFT_AUDITOR;
GRANT USAGE ON SCHEMA SAFE_SHIFT.BLOCKCHAIN TO ROLE SAFESHIFT_AUDITOR;
GRANT SELECT ON ALL TABLES IN SCHEMA SAFE_SHIFT.BLOCKCHAIN TO ROLE SAFESHIFT_AUDITOR;
GRANT USAGE ON SCHEMA SAFE_SHIFT.GOVERNANCE TO ROLE SAFESHIFT_AUDITOR;
GRANT SELECT ON ALL TABLES IN SCHEMA SAFE_SHIFT.GOVERNANCE TO ROLE SAFESHIFT_AUDITOR;
GRANT USAGE ON SCHEMA SAFE_SHIFT.ML TO ROLE SAFESHIFT_ML_ENGINEER;
GRANT ALL ON ALL TABLES IN SCHEMA SAFE_SHIFT.ML TO ROLE SAFESHIFT_ML_ENGINEER;
GRANT USAGE ON WAREHOUSE ANALYTICS_WH TO ROLE SAFESHIFT_ANALYST;
GRANT USAGE ON WAREHOUSE ANALYTICS_WH TO ROLE SAFESHIFT_AUDITOR;
GRANT USAGE ON WAREHOUSE ML_WH TO ROLE SAFESHIFT_ML_ENGINEER;
GRANT USAGE ON WAREHOUSE CORTEX_WH TO ROLE SAFESHIFT_ML_ENGINEER;

-- ============================================================================
-- SECTION 20: SECURE DATA SHARING
-- ============================================================================

CREATE OR REPLACE SHARE SAFESHIFT_COMPLIANCE_SHARE
    COMMENT = 'SafeShift anonymized compliance data for regulators and NGOs';

GRANT USAGE ON DATABASE SAFE_SHIFT TO SHARE SAFESHIFT_COMPLIANCE_SHARE;
GRANT USAGE ON SCHEMA SAFE_SHIFT.ANALYTICS TO SHARE SAFESHIFT_COMPLIANCE_SHARE;
GRANT USAGE ON SCHEMA SAFE_SHIFT.BLOCKCHAIN TO SHARE SAFESHIFT_COMPLIANCE_SHARE;
GRANT SELECT ON VIEW SAFE_SHIFT.ANALYTICS.SV_PUBLIC_COMPLIANCE_SUMMARY TO SHARE SAFESHIFT_COMPLIANCE_SHARE;
GRANT SELECT ON VIEW SAFE_SHIFT.ANALYTICS.SV_BLOCKCHAIN_VERIFICATION TO SHARE SAFESHIFT_COMPLIANCE_SHARE;

-- ============================================================================
-- SECTION 21: ALERTS
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE SCHEMA ANALYTICS;

-- Notification integration for alerts (email addresses must be verified in account)
CREATE OR REPLACE NOTIFICATION INTEGRATION safeshift_alerts
    TYPE = EMAIL
    ENABLED = TRUE
    ALLOWED_RECIPIENTS = ('alerts@safeshift.io','ops@safeshift.io','emergency@safeshift.io','compliance@safeshift.io');

CREATE OR REPLACE ALERT ALERT_CRITICAL_RISK
    WAREHOUSE = ANALYTICS_WH SCHEDULE = '5 MINUTE'
    IF (EXISTS (SELECT 1 FROM FACT_HOURLY_COMPLIANCE
        WHERE risk_level='CRITICAL' AND hour_timestamp>=DATEADD('MINUTE',-10,CURRENT_TIMESTAMP())))
    THEN CALL SYSTEM$SEND_EMAIL('safeshift_alerts','alerts@safeshift.io',
        'CRITICAL RISK — SafeShift','A factory reached CRITICAL risk. Check dashboard.');

CREATE OR REPLACE ALERT ALERT_SENSOR_OFFLINE
    WAREHOUSE = ANALYTICS_WH SCHEDULE = '15 MINUTE'
    IF (EXISTS (SELECT 1 FROM DIM_SENSOR_NODE
        WHERE is_active=TRUE AND last_seen<DATEADD('MINUTE',-30,CURRENT_TIMESTAMP())))
    THEN CALL SYSTEM$SEND_EMAIL('safeshift_alerts','ops@safeshift.io',
        'SENSOR OFFLINE — SafeShift','Sensor nodes not reporting for 30+ minutes.');

CREATE OR REPLACE ALERT ALERT_CO2_DANGER
    WAREHOUSE = ANALYTICS_WH SCHEDULE = '1 MINUTE'
    IF (EXISTS (SELECT 1 FROM STAGING.SENSOR_READINGS_CLEAN
        WHERE co2_ppm>5000 AND reading_timestamp>=DATEADD('MINUTE',-5,CURRENT_TIMESTAMP())))
    THEN CALL SYSTEM$SEND_EMAIL('safeshift_alerts','emergency@safeshift.io',
        'DANGER: CO2 ABOVE PEL — SafeShift','CO2 exceeded 5000 ppm OSHA PEL.');

CREATE OR REPLACE ALERT ALERT_SHIFT_VIOLATION
    WAREHOUSE = ANALYTICS_WH SCHEDULE = '30 MINUTE'
    IF (EXISTS (SELECT 1 FROM FACT_DAILY_COMPLIANCE
        WHERE shift_hours_detected>10 AND compliance_date=CURRENT_DATE()))
    THEN CALL SYSTEM$SEND_EMAIL('safeshift_alerts','compliance@safeshift.io',
        'SHIFT VIOLATION — SafeShift','Factory exceeded ILO 10-hour shift max.');

ALTER ALERT ALERT_CRITICAL_RISK RESUME;
ALTER ALERT ALERT_SENSOR_OFFLINE RESUME;
ALTER ALERT ALERT_CO2_DANGER RESUME;
ALTER ALERT ALERT_SHIFT_VIOLATION RESUME;

-- ============================================================================
-- DONE! Your SafeShift database is fully deployed.
-- ============================================================================
-- Next steps:
-- 1. Upload CSV files to stages via Snowsight UI (Data > Stages > + Files)
-- 2. Run the COPY INTO commands from 08_data_sharing_and_load.sql
-- 3. Run 09_test_validation.sql to verify everything works
-- ============================================================================

SELECT '✅ SafeShift database deployed successfully!' AS status,
    CURRENT_TIMESTAMP() AS deployed_at,
    CURRENT_DATABASE() AS database_name,
    CURRENT_ACCOUNT() AS account;
