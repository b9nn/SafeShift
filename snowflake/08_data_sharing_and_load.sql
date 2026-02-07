-- ============================================================================
-- SafeShift Snowflake Database — Data Sharing & Initial Data Load
-- ============================================================================
-- Snowflake features used:
--   - Secure Data Sharing (listings for regulators/NGOs)
--   - Data Exchange
--   - COPY INTO with transformations
--   - PUT command (local file upload)
--   - VALIDATE function (dry-run validation)
--   - METADATA$FILENAME (stage metadata columns)
--   - Roles and Grants (RBAC)
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE WAREHOUSE INGEST_WH;

-- ===================== ROLE-BASED ACCESS CONTROL (RBAC) =====================

-- Create custom roles for SafeShift
CREATE OR REPLACE ROLE SAFESHIFT_ADMIN
    COMMENT = 'Full access to all SafeShift schemas and data';
CREATE OR REPLACE ROLE SAFESHIFT_ANALYST
    COMMENT = 'Read access to analytics and staging, no raw/blockchain';
CREATE OR REPLACE ROLE SAFESHIFT_AUDITOR
    COMMENT = 'Read access to compliance, blockchain, and governance';
CREATE OR REPLACE ROLE SAFESHIFT_ML_ENGINEER
    COMMENT = 'Read/write access to ML schema, read access to staging';
CREATE OR REPLACE ROLE SAFESHIFT_BLOCKCHAIN
    COMMENT = 'Read/write access to blockchain schema';
CREATE OR REPLACE ROLE SAFESHIFT_FINANCE
    COMMENT = 'Read access to reward payouts and financial data';

-- Role hierarchy
GRANT ROLE SAFESHIFT_ANALYST TO ROLE SAFESHIFT_ADMIN;
GRANT ROLE SAFESHIFT_AUDITOR TO ROLE SAFESHIFT_ADMIN;
GRANT ROLE SAFESHIFT_ML_ENGINEER TO ROLE SAFESHIFT_ADMIN;
GRANT ROLE SAFESHIFT_BLOCKCHAIN TO ROLE SAFESHIFT_ADMIN;
GRANT ROLE SAFESHIFT_FINANCE TO ROLE SAFESHIFT_AUDITOR;

-- Schema grants
GRANT USAGE ON DATABASE SAFE_SHIFT TO ROLE SAFESHIFT_ANALYST;
GRANT USAGE ON DATABASE SAFE_SHIFT TO ROLE SAFESHIFT_AUDITOR;
GRANT USAGE ON DATABASE SAFE_SHIFT TO ROLE SAFESHIFT_ML_ENGINEER;

GRANT USAGE ON SCHEMA ANALYTICS TO ROLE SAFESHIFT_ANALYST;
GRANT SELECT ON ALL TABLES IN SCHEMA ANALYTICS TO ROLE SAFESHIFT_ANALYST;
GRANT SELECT ON ALL VIEWS IN SCHEMA ANALYTICS TO ROLE SAFESHIFT_ANALYST;
GRANT SELECT ON FUTURE TABLES IN SCHEMA ANALYTICS TO ROLE SAFESHIFT_ANALYST;

GRANT USAGE ON SCHEMA STAGING TO ROLE SAFESHIFT_ANALYST;
GRANT SELECT ON ALL TABLES IN SCHEMA STAGING TO ROLE SAFESHIFT_ANALYST;

GRANT USAGE ON SCHEMA ANALYTICS TO ROLE SAFESHIFT_AUDITOR;
GRANT SELECT ON ALL TABLES IN SCHEMA ANALYTICS TO ROLE SAFESHIFT_AUDITOR;
GRANT USAGE ON SCHEMA BLOCKCHAIN TO ROLE SAFESHIFT_AUDITOR;
GRANT SELECT ON ALL TABLES IN SCHEMA BLOCKCHAIN TO ROLE SAFESHIFT_AUDITOR;
GRANT USAGE ON SCHEMA GOVERNANCE TO ROLE SAFESHIFT_AUDITOR;
GRANT SELECT ON ALL TABLES IN SCHEMA GOVERNANCE TO ROLE SAFESHIFT_AUDITOR;

GRANT USAGE ON SCHEMA ML TO ROLE SAFESHIFT_ML_ENGINEER;
GRANT ALL ON ALL TABLES IN SCHEMA ML TO ROLE SAFESHIFT_ML_ENGINEER;
GRANT USAGE ON SCHEMA STAGING TO ROLE SAFESHIFT_ML_ENGINEER;
GRANT SELECT ON ALL TABLES IN SCHEMA STAGING TO ROLE SAFESHIFT_ML_ENGINEER;

GRANT USAGE ON WAREHOUSE ANALYTICS_WH TO ROLE SAFESHIFT_ANALYST;
GRANT USAGE ON WAREHOUSE ANALYTICS_WH TO ROLE SAFESHIFT_AUDITOR;
GRANT USAGE ON WAREHOUSE ML_WH TO ROLE SAFESHIFT_ML_ENGINEER;
GRANT USAGE ON WAREHOUSE CORTEX_WH TO ROLE SAFESHIFT_ML_ENGINEER;

-- ===================== SECURE DATA SHARING =====================
-- Share anonymized compliance data with regulators and NGOs

CREATE OR REPLACE SHARE SAFESHIFT_COMPLIANCE_SHARE
    COMMENT = 'SafeShift anonymized compliance data for regulators and NGOs';

-- Grant access to the secure views
GRANT USAGE ON DATABASE SAFE_SHIFT TO SHARE SAFESHIFT_COMPLIANCE_SHARE;
GRANT USAGE ON SCHEMA ANALYTICS TO SHARE SAFESHIFT_COMPLIANCE_SHARE;
GRANT SELECT ON VIEW ANALYTICS.SV_PUBLIC_COMPLIANCE_SUMMARY
    TO SHARE SAFESHIFT_COMPLIANCE_SHARE;
GRANT SELECT ON VIEW ANALYTICS.SV_BLOCKCHAIN_VERIFICATION
    TO SHARE SAFESHIFT_COMPLIANCE_SHARE;

-- To add a consumer account:
-- ALTER SHARE SAFESHIFT_COMPLIANCE_SHARE ADD ACCOUNTS = <regulator_account>;

-- ===================== DATA LOADING =====================
-- Load the actual CSV files from the SafeShift data/ directory

USE SCHEMA RAW;

-- Step 1: PUT files from local filesystem to internal stages
-- (Run these from SnowSQL CLI or Snowflake UI)

-- PUT file:///path/to/SafeShift/data/air-quality/Air-Quality-Dataset.csv @STG_AIR_QUALITY;
-- PUT file:///path/to/SafeShift/data/air-quality/AirQualityUCI.csv @STG_AIR_QUALITY;
-- PUT file:///path/to/SafeShift/data/beijing-pm25/PRSA_data_2010.1.1-2014.12.31.csv @STG_INDUSTRIAL;
-- PUT file:///path/to/SafeShift/data/steel-industry/Steel_industry.csv @STG_INDUSTRIAL;
-- PUT file:///path/to/SafeShift/data/sml2010/NEW-DATA-1.T15.txt @STG_SML2010;
-- PUT file:///path/to/SafeShift/data/sml2010/NEW-DATA-2.T15.txt @STG_SML2010;
-- PUT file:///path/to/SafeShift/data/Industrial\ Safety\ and\ Health/*.csv @STG_INDUSTRIAL;
-- PUT file:///path/to/SafeShift/config/safety_thresholds.json @STG_CONFIG;

-- Step 2: COPY INTO with transformations

-- ---- Load Air Quality 2023 ----
COPY INTO AIR_QUALITY_RAW (
    time_str, co2_ppm, pm25, pm10, temperature, humidity,
    category_1, category_2, status, source_file
)
FROM (
    SELECT
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        METADATA$FILENAME      -- Capture source file from stage metadata
    FROM @STG_AIR_QUALITY/Air-Quality-Dataset.csv
        (FILE_FORMAT => CSV_SEMICOLON_FORMAT)
)
ON_ERROR = 'CONTINUE'
PURGE = FALSE;                 -- Keep files in stage for reprocessing

-- ---- Load Air Quality UCI 2004 ----
COPY INTO AIR_QUALITY_UCI_RAW (
    date_str, time_str, co_gt, pt08_s1_co, nmhc_gt, c6h6_gt,
    pt08_s2_nmhc, nox_gt, pt08_s3_nox, no2_gt, pt08_s4_no2,
    pt08_s5_o3, temperature, relative_humidity, absolute_humidity,
    source_file
)
FROM (
    SELECT
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        METADATA$FILENAME
    FROM @STG_AIR_QUALITY/AirQualityUCI.csv
        (FILE_FORMAT => CSV_SEMICOLON_FORMAT)
)
ON_ERROR = 'CONTINUE';

-- ---- Load Beijing PM2.5 ----
COPY INTO BEIJING_PM25_RAW (
    row_no, year, month, day, hour, pm25, dewp, temp, pres,
    cbwd, iws, is_snow, ir_rain, source_file
)
FROM (
    SELECT
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        METADATA$FILENAME
    FROM @STG_INDUSTRIAL/PRSA_data_2010.1.1-2014.12.31.csv
        (FILE_FORMAT => CSV_STANDARD_FORMAT)
)
ON_ERROR = 'CONTINUE';

-- ---- Load Steel Industry ----
COPY INTO STEEL_INDUSTRY_RAW (
    date_time_str, usage_kwh, lagging_reactive, leading_reactive,
    co2_tco2, lagging_pf, leading_pf, nsm, week_status,
    day_of_week, load_type, source_file
)
FROM (
    SELECT
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        METADATA$FILENAME
    FROM @STG_INDUSTRIAL/Steel_industry.csv
        (FILE_FORMAT => CSV_STANDARD_FORMAT)
)
ON_ERROR = 'CONTINUE';

-- ---- Load SML2010 datasets ----
COPY INTO SML2010_RAW
FROM @STG_SML2010
FILE_FORMAT = TSV_FORMAT
ON_ERROR = 'CONTINUE';

-- ---- Load Safety Incidents (with accident descriptions) ----
COPY INTO SAFETY_INCIDENTS_RAW (
    incident_date, country, local_site, industry_sector,
    accident_level, potential_level, genre, employee_type,
    critical_risk, description, source_file
)
FROM (
    SELECT
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        METADATA$FILENAME
    FROM @STG_INDUSTRIAL/IHMStefanini_industrial_safety_and_health_database_with_accidents_description.csv
        (FILE_FORMAT => CSV_STANDARD_FORMAT)
)
ON_ERROR = 'CONTINUE';

-- ---- Load Safety Thresholds from JSON ----
-- Parse JSON config and call the stored procedure
CALL SP_LOAD_SAFETY_THRESHOLDS(
    (SELECT PARSE_JSON($1) FROM @STG_CONFIG/safety_thresholds.json
     (FILE_FORMAT => 'JSON_FORMAT'))
);

-- ===================== VALIDATE LOADS =====================
-- Dry-run validation before committing

-- Check for load errors
SELECT * FROM TABLE(VALIDATE(AIR_QUALITY_RAW, JOB_ID => '_last'));
SELECT * FROM TABLE(VALIDATE(BEIJING_PM25_RAW, JOB_ID => '_last'));
SELECT * FROM TABLE(VALIDATE(STEEL_INDUSTRY_RAW, JOB_ID => '_last'));
SELECT * FROM TABLE(VALIDATE(SAFETY_INCIDENTS_RAW, JOB_ID => '_last'));

-- ===================== LOAD VERIFICATION QUERIES =====================

SELECT 'AIR_QUALITY_RAW' AS table_name, COUNT(*) AS row_count FROM AIR_QUALITY_RAW
UNION ALL
SELECT 'AIR_QUALITY_UCI_RAW', COUNT(*) FROM AIR_QUALITY_UCI_RAW
UNION ALL
SELECT 'BEIJING_PM25_RAW', COUNT(*) FROM BEIJING_PM25_RAW
UNION ALL
SELECT 'STEEL_INDUSTRY_RAW', COUNT(*) FROM STEEL_INDUSTRY_RAW
UNION ALL
SELECT 'SML2010_RAW', COUNT(*) FROM SML2010_RAW
UNION ALL
SELECT 'SAFETY_INCIDENTS_RAW', COUNT(*) FROM SAFETY_INCIDENTS_RAW;
