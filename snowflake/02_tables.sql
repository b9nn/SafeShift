-- ============================================================================
-- SafeShift Snowflake Database — Table Definitions
-- ============================================================================
-- Snowflake features used:
--   - VARIANT columns (semi-structured data)
--   - Clustering keys
--   - Transient tables (for staging)
--   - Sequences
--   - DEFAULT expressions
--   - CHANGE_TRACKING (for Streams)
--   - Table comments & column comments
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE WAREHOUSE INGEST_WH;

-- =====================================================
-- SCHEMA: RAW — Landing zone for all ingested data
-- =====================================================
USE SCHEMA RAW;

-- Sequence for globally unique reading IDs
CREATE OR REPLACE SEQUENCE SEQ_READING_ID
    START = 1
    INCREMENT = 1
    COMMENT = 'Global sequence for sensor reading IDs';

-- ---- Core sensor readings (from Arduino/ESP32 devices) ----
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
    raw_payload         VARIANT         COMMENT 'Full raw JSON payload from sensor node',
    ingestion_timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    source_file         VARCHAR(500)    COMMENT 'Source file path from stage metadata'
)
    CLUSTER BY (factory_id, reading_timestamp)  -- Clustering for query performance
    CHANGE_TRACKING = TRUE                      -- Enable for Streams
    DATA_RETENTION_TIME_IN_DAYS = 30
    COMMENT = 'Raw sensor readings from factory sensor nodes';

-- ---- Air Quality Dataset (2023, semicolon-delimited) ----
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

-- ---- Air Quality UCI (2004 historical) ----
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

-- ---- Beijing PM2.5 (2010-2014) ----
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

-- ---- Steel Industry Energy (2018) ----
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

-- ---- SML2010 Indoor Environment ----
CREATE OR REPLACE TABLE SML2010_RAW (
    epoch_time          FLOAT,
    temp_comedor_c      FLOAT,      -- Dining room temperature
    temp_habitacion_c   FLOAT,      -- Room temperature
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

-- ---- Industrial Safety & Health Incidents ----
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

-- =====================================================
-- SCHEMA: STAGING — Cleaned and validated data
-- =====================================================
USE SCHEMA STAGING;

-- Transient table (no Fail-safe, cheaper for intermediate data)
CREATE OR REPLACE TRANSIENT TABLE SENSOR_READINGS_CLEAN (
    reading_id          NUMBER,
    factory_id          VARCHAR(50),
    sensor_node_id      VARCHAR(50),
    reading_timestamp   TIMESTAMP_NTZ,
    temperature_f       FLOAT,
    temperature_c       FLOAT       COMMENT 'Converted: (F-32)*5/9',
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
    -- Data quality flags
    is_valid            BOOLEAN DEFAULT TRUE,
    quality_flags       ARRAY       COMMENT 'Array of quality issue codes',
    cleaned_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (factory_id, reading_timestamp)
    COMMENT = 'Cleaned and validated sensor readings with quality flags';

CREATE OR REPLACE TRANSIENT TABLE AIR_QUALITY_UNIFIED (
    record_id           NUMBER AUTOINCREMENT,
    source_dataset      VARCHAR(50)     COMMENT 'Which dataset: AQ2023, UCI2004, BEIJING, SML2010',
    reading_timestamp   TIMESTAMP_NTZ,
    co2_ppm             FLOAT,
    pm25                FLOAT,
    pm10                FLOAT,
    temperature_c       FLOAT,
    humidity_pct        FLOAT,
    voc_indicator       FLOAT,
    additional_metrics  VARIANT         COMMENT 'Dataset-specific fields as JSON',
    quality_score       FLOAT           COMMENT 'Data completeness score 0-1',
    cleaned_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (source_dataset, reading_timestamp)
    COMMENT = 'Unified air quality data from all source datasets';

-- =====================================================
-- SCHEMA: ANALYTICS — Aggregations and scores
-- =====================================================
USE SCHEMA ANALYTICS;

-- ---- Factory registry (dimension table) ----
CREATE OR REPLACE TABLE DIM_FACTORY (
    factory_id          VARCHAR(50) PRIMARY KEY,
    factory_name        VARCHAR(200),
    country             VARCHAR(100),
    region              VARCHAR(100),
    industry_sector     VARCHAR(100),
    num_sensor_nodes    INTEGER,
    deployment_date     DATE,
    is_active           BOOLEAN DEFAULT TRUE,
    factory_metadata    VARIANT         COMMENT 'Flexible factory attributes as JSON',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    COMMENT = 'Factory dimension table — registry of monitored facilities';

-- ---- Sensor node registry ----
CREATE OR REPLACE TABLE DIM_SENSOR_NODE (
    sensor_node_id      VARCHAR(50) PRIMARY KEY,
    factory_id          VARCHAR(50) REFERENCES DIM_FACTORY(factory_id),
    node_type           VARCHAR(50)     COMMENT 'e.g., ARDUINO_NANO_33_BLE, ESP32',
    location_zone       VARCHAR(100)    COMMENT 'Zone within factory',
    sensors_available   ARRAY           COMMENT 'List of sensor types on this node',
    firmware_version    VARCHAR(20),
    installed_date      DATE,
    is_active           BOOLEAN DEFAULT TRUE,
    last_seen           TIMESTAMP_NTZ
)
    COMMENT = 'Sensor node dimension — registry of deployed hardware';

-- ---- Safety thresholds (from config JSON) ----
CREATE OR REPLACE TABLE DIM_SAFETY_THRESHOLDS (
    threshold_id        NUMBER AUTOINCREMENT,
    metric_name         VARCHAR(100),
    unit                VARCHAR(50),
    threshold_type      VARCHAR(50)     COMMENT 'e.g., PEL, STEL, IDLH, recommended_min, recommended_max',
    threshold_value     FLOAT,
    standard_source     VARCHAR(200)    COMMENT 'e.g., OSHA 29 CFR 1910.95',
    source_url          VARCHAR(500),
    effective_date      DATE DEFAULT CURRENT_DATE(),
    is_active           BOOLEAN DEFAULT TRUE,
    raw_config          VARIANT         COMMENT 'Original JSON block from config'
)
    COMMENT = 'Safety threshold reference data from OSHA/ILO/EU standards';

-- ---- Hourly compliance scores ----
CREATE OR REPLACE TABLE FACT_HOURLY_COMPLIANCE (
    compliance_id       NUMBER AUTOINCREMENT,
    factory_id          VARCHAR(50),
    sensor_node_id      VARCHAR(50),
    hour_timestamp      TIMESTAMP_NTZ,
    -- Metric averages for the hour
    avg_temperature_c   FLOAT,
    avg_humidity_pct    FLOAT,
    avg_co2_ppm         FLOAT,
    avg_pm25            FLOAT,
    avg_noise_dba       FLOAT,
    avg_light_lux       FLOAT,
    avg_vibration_ms2   FLOAT,
    -- Threshold breach counts
    temperature_breaches    INTEGER DEFAULT 0,
    humidity_breaches       INTEGER DEFAULT 0,
    co2_breaches            INTEGER DEFAULT 0,
    pm25_breaches           INTEGER DEFAULT 0,
    noise_breaches          INTEGER DEFAULT 0,
    light_breaches          INTEGER DEFAULT 0,
    vibration_breaches      INTEGER DEFAULT 0,
    -- Composite scores
    compliance_score        FLOAT   COMMENT 'Overall compliance 0-100',
    risk_level              VARCHAR(20) COMMENT 'LOW / MEDIUM / HIGH / CRITICAL',
    breach_details          VARIANT     COMMENT 'JSON array of specific breaches',
    computed_at             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (factory_id, hour_timestamp)
    COMMENT = 'Hourly aggregated compliance scores per factory/sensor';

-- ---- Daily compliance summary ----
CREATE OR REPLACE TABLE FACT_DAILY_COMPLIANCE (
    daily_compliance_id NUMBER AUTOINCREMENT,
    factory_id          VARCHAR(50),
    compliance_date     DATE,
    avg_compliance_score FLOAT,
    min_compliance_score FLOAT,
    max_compliance_score FLOAT,
    total_breaches      INTEGER,
    breach_breakdown    VARIANT     COMMENT 'Breach counts by category',
    risk_level          VARCHAR(20),
    shift_hours_detected FLOAT      COMMENT 'Estimated hours of operation',
    shift_compliance    BOOLEAN     COMMENT 'Within ILO shift limits?',
    computed_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    CLUSTER BY (factory_id, compliance_date)
    COMMENT = 'Daily compliance summary per factory';

-- =====================================================
-- SCHEMA: BLOCKCHAIN — On-chain event tracking
-- =====================================================
USE SCHEMA BLOCKCHAIN;

CREATE OR REPLACE TABLE REWARD_PAYOUTS (
    payout_id           NUMBER AUTOINCREMENT,
    factory_id          VARCHAR(50),
    payout_date         DATE,
    reward_type         VARCHAR(50)     COMMENT 'STABLECOIN, CERTIFICATION, INSURANCE_DISCOUNT, SUPPLIER_STATUS',
    reward_amount_usd   FLOAT,
    solana_tx_hash      VARCHAR(128)    COMMENT 'Solana transaction signature',
    solana_slot         NUMBER,
    compliance_period   VARCHAR(20)     COMMENT 'e.g., 2025-W05, 2025-01',
    avg_compliance_score FLOAT,
    payout_status       VARCHAR(20)     COMMENT 'PENDING, CONFIRMED, FAILED',
    payout_metadata     VARIANT,
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    COMMENT = 'Blockchain reward payout records with Solana transaction references';

CREATE OR REPLACE TABLE COMPLIANCE_REPORTS_ONCHAIN (
    report_id           NUMBER AUTOINCREMENT,
    factory_id          VARCHAR(50),
    report_date         DATE,
    report_hash         VARCHAR(128)    COMMENT 'SHA-256 hash of the full report',
    solana_tx_hash      VARCHAR(128),
    solana_slot         NUMBER,
    report_summary      VARIANT         COMMENT 'Summary metrics included in hash',
    published_at        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    COMMENT = 'Hashed compliance reports published to Solana blockchain';
