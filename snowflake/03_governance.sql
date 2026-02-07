-- ============================================================================
-- SafeShift Snowflake Database — Governance, Tags, and Policies
-- ============================================================================
-- Snowflake features used:
--   - Object Tags (classification)
--   - Tag-Based Masking Policies
--   - Row Access Policies
--   - Column-Level Security (Dynamic Data Masking)
--   - Access History & Account Usage
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE SCHEMA GOVERNANCE;
USE WAREHOUSE ANALYTICS_WH;

-- ===================== OBJECT TAGS =====================
-- Tags for data classification and lineage tracking

CREATE OR REPLACE TAG DATA_SENSITIVITY
    ALLOWED_VALUES 'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'
    COMMENT = 'Data sensitivity classification per SafeShift data governance policy';

CREATE OR REPLACE TAG DATA_DOMAIN
    ALLOWED_VALUES 'SENSOR', 'AIR_QUALITY', 'INDUSTRIAL', 'SAFETY', 'BLOCKCHAIN', 'COMPLIANCE', 'CONFIG'
    COMMENT = 'Business domain classification for data assets';

CREATE OR REPLACE TAG PII_TYPE
    ALLOWED_VALUES 'NONE', 'FACTORY_ID', 'LOCATION', 'FINANCIAL'
    COMMENT = 'PII classification — SafeShift explicitly avoids personal data';

CREATE OR REPLACE TAG DATA_FRESHNESS
    ALLOWED_VALUES 'REAL_TIME', 'HOURLY', 'DAILY', 'HISTORICAL'
    COMMENT = 'Expected data refresh frequency';

CREATE OR REPLACE TAG REGULATORY_STANDARD
    ALLOWED_VALUES 'OSHA', 'ILO', 'EU_DIRECTIVE', 'ASHRAE', 'NIOSH', 'CUSTOM'
    COMMENT = 'Which regulatory standard applies to this data';

-- ---- Apply tags to tables ----

-- Sensor readings: internal, real-time sensor data
ALTER TABLE RAW.SENSOR_READINGS_RAW SET TAG
    DATA_SENSITIVITY = 'INTERNAL',
    DATA_DOMAIN = 'SENSOR',
    PII_TYPE = 'FACTORY_ID',
    DATA_FRESHNESS = 'REAL_TIME';

-- Air quality: public research datasets
ALTER TABLE RAW.AIR_QUALITY_RAW SET TAG
    DATA_SENSITIVITY = 'PUBLIC',
    DATA_DOMAIN = 'AIR_QUALITY',
    PII_TYPE = 'NONE',
    DATA_FRESHNESS = 'HISTORICAL';

-- Safety incidents: confidential (contains location details)
ALTER TABLE RAW.SAFETY_INCIDENTS_RAW SET TAG
    DATA_SENSITIVITY = 'CONFIDENTIAL',
    DATA_DOMAIN = 'SAFETY',
    PII_TYPE = 'LOCATION',
    DATA_FRESHNESS = 'HISTORICAL';

-- Blockchain payouts: restricted (financial data)
ALTER TABLE BLOCKCHAIN.REWARD_PAYOUTS SET TAG
    DATA_SENSITIVITY = 'RESTRICTED',
    DATA_DOMAIN = 'BLOCKCHAIN',
    PII_TYPE = 'FINANCIAL',
    DATA_FRESHNESS = 'DAILY';

-- Compliance scores
ALTER TABLE ANALYTICS.FACT_HOURLY_COMPLIANCE SET TAG
    DATA_SENSITIVITY = 'INTERNAL',
    DATA_DOMAIN = 'COMPLIANCE',
    DATA_FRESHNESS = 'HOURLY';

ALTER TABLE ANALYTICS.FACT_DAILY_COMPLIANCE SET TAG
    DATA_SENSITIVITY = 'INTERNAL',
    DATA_DOMAIN = 'COMPLIANCE',
    DATA_FRESHNESS = 'DAILY';

-- ===================== DYNAMIC DATA MASKING =====================
-- Mask sensitive fields based on role

CREATE OR REPLACE MASKING POLICY MASK_FACTORY_ID AS
    (val VARCHAR) RETURNS VARCHAR ->
    CASE
        WHEN CURRENT_ROLE() IN ('SAFESHIFT_ADMIN', 'SAFESHIFT_AUDITOR')
            THEN val
        WHEN CURRENT_ROLE() = 'SAFESHIFT_ANALYST'
            THEN CONCAT('FAC-', LEFT(SHA2(val, 256), 8))  -- Pseudonymized
        ELSE '***MASKED***'
    END
    COMMENT = 'Masks factory IDs — full access for admin/auditor, pseudonymized for analysts';

CREATE OR REPLACE MASKING POLICY MASK_SOLANA_TX AS
    (val VARCHAR) RETURNS VARCHAR ->
    CASE
        WHEN CURRENT_ROLE() IN ('SAFESHIFT_ADMIN', 'SAFESHIFT_BLOCKCHAIN')
            THEN val
        ELSE CONCAT(LEFT(val, 8), '...', RIGHT(val, 4))  -- Show partial hash
    END
    COMMENT = 'Masks Solana transaction hashes — partial display for non-blockchain roles';

CREATE OR REPLACE MASKING POLICY MASK_FINANCIAL AS
    (val FLOAT) RETURNS FLOAT ->
    CASE
        WHEN CURRENT_ROLE() IN ('SAFESHIFT_ADMIN', 'SAFESHIFT_FINANCE')
            THEN val
        WHEN CURRENT_ROLE() = 'SAFESHIFT_AUDITOR'
            THEN ROUND(val, 0)  -- Rounded for auditors
        ELSE NULL
    END
    COMMENT = 'Masks financial amounts — null for unauthorized roles';

-- Apply masking policies to columns
ALTER TABLE BLOCKCHAIN.REWARD_PAYOUTS MODIFY COLUMN
    solana_tx_hash SET MASKING POLICY MASK_SOLANA_TX;
ALTER TABLE BLOCKCHAIN.REWARD_PAYOUTS MODIFY COLUMN
    reward_amount_usd SET MASKING POLICY MASK_FINANCIAL;
ALTER TABLE BLOCKCHAIN.COMPLIANCE_REPORTS_ONCHAIN MODIFY COLUMN
    solana_tx_hash SET MASKING POLICY MASK_SOLANA_TX;

-- ===================== ROW ACCESS POLICIES =====================
-- Control which rows users can see based on their role/region

CREATE OR REPLACE ROW ACCESS POLICY FACTORY_REGION_ACCESS AS
    (row_factory_id VARCHAR) RETURNS BOOLEAN ->
    CASE
        -- Admins see everything
        WHEN CURRENT_ROLE() = 'SAFESHIFT_ADMIN' THEN TRUE
        -- Auditors see everything
        WHEN CURRENT_ROLE() = 'SAFESHIFT_AUDITOR' THEN TRUE
        -- Regional analysts only see factories in their assigned region
        WHEN CURRENT_ROLE() = 'SAFESHIFT_ANALYST' THEN
            EXISTS (
                SELECT 1 FROM ANALYTICS.DIM_FACTORY f
                JOIN GOVERNANCE.ANALYST_REGION_ASSIGNMENTS a
                    ON f.region = a.assigned_region
                WHERE f.factory_id = row_factory_id
                    AND a.username = CURRENT_USER()
            )
        ELSE FALSE
    END
    COMMENT = 'Row-level security: analysts see only their assigned regions';

-- Analyst region assignment table for the RAP
CREATE OR REPLACE TABLE ANALYST_REGION_ASSIGNMENTS (
    username        VARCHAR(100),
    assigned_region VARCHAR(100),
    assigned_at     TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
    COMMENT = 'Maps analysts to their authorized factory regions';

-- Apply RAP to compliance tables
ALTER TABLE ANALYTICS.FACT_HOURLY_COMPLIANCE
    ADD ROW ACCESS POLICY FACTORY_REGION_ACCESS ON (factory_id);
ALTER TABLE ANALYTICS.FACT_DAILY_COMPLIANCE
    ADD ROW ACCESS POLICY FACTORY_REGION_ACCESS ON (factory_id);

-- ===================== AUDIT LOG TABLE =====================

CREATE OR REPLACE TABLE AUDIT_LOG (
    audit_id            NUMBER AUTOINCREMENT,
    event_timestamp     TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    event_type          VARCHAR(50)     COMMENT 'DATA_LOAD, SCORE_COMPUTE, ALERT_FIRED, REWARD_ISSUED, REPORT_PUBLISHED',
    actor               VARCHAR(100),
    factory_id          VARCHAR(50),
    event_details       VARIANT,
    source_schema       VARCHAR(50),
    source_table        VARCHAR(100)
)
    CLUSTER BY (event_timestamp)
    COMMENT = 'Immutable audit log for all significant platform events';
