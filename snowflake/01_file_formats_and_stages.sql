-- ============================================================================
-- SafeShift Snowflake Database — File Formats, Stages, and Data Loading
-- ============================================================================
-- Snowflake features used:
--   - Named File Formats (CSV, JSON, Parquet)
--   - Internal Named Stages
--   - External Stages (S3)
--   - Snowpipe (auto-ingest)
--   - COPY INTO with transformations
--   - Directory Tables
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE SCHEMA RAW;
USE WAREHOUSE INGEST_WH;

-- ===================== FILE FORMATS =====================

-- CSV with semicolons (for European-format datasets like Air-Quality-Dataset.csv)
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

-- Standard CSV (comma-delimited)
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

-- Tab-delimited (for SML2010 .T15 files)
CREATE OR REPLACE FILE FORMAT TSV_FORMAT
    TYPE = 'CSV'
    FIELD_DELIMITER = '\t'
    RECORD_DELIMITER = '\n'
    SKIP_HEADER = 1
    TRIM_SPACE = TRUE
    NULL_IF = ('', 'NULL', 'null')
    COMMENT = 'Tab-delimited format for SML2010 sensor data';

-- JSON format (for safety thresholds config and API payloads)
CREATE OR REPLACE FILE FORMAT JSON_FORMAT
    TYPE = 'JSON'
    STRIP_OUTER_ARRAY = TRUE
    ALLOW_DUPLICATE = FALSE
    STRIP_NULL_VALUES = FALSE
    COMMENT = 'JSON format for config files and API data';

-- Parquet (for efficient columnar storage and model outputs)
CREATE OR REPLACE FILE FORMAT PARQUET_FORMAT
    TYPE = 'PARQUET'
    SNAPPY_COMPRESSION = TRUE
    COMMENT = 'Parquet format for ML model outputs and optimized storage';

-- ===================== INTERNAL STAGES =====================
-- Named stages with directory tables enabled for metadata tracking

CREATE OR REPLACE STAGE STG_SENSOR_DATA
    FILE_FORMAT = CSV_STANDARD_FORMAT
    DIRECTORY = (ENABLE = TRUE)     -- Directory table for file listing
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

-- ===================== EXTERNAL STAGE (S3 example) =====================
-- For production: connect to S3 bucket where IoT gateway pushes data

-- CREATE OR REPLACE STAGE STG_IOT_S3
--     URL = 's3://safeshift-iot-data/'
--     STORAGE_INTEGRATION = SAFESHIFT_S3_INTEGRATION
--     FILE_FORMAT = CSV_STANDARD_FORMAT
--     DIRECTORY = (ENABLE = TRUE)
--     COMMENT = 'External S3 stage for IoT gateway sensor uploads';

-- ===================== SNOWPIPE (auto-ingest) =====================
-- Automatically loads data as files land in stages

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
