-- ============================================================================
-- SafeShift Snowflake Database — Infrastructure Setup
-- ============================================================================
-- This script sets up the foundational Snowflake infrastructure:
--   - Database & Schemas
--   - Virtual Warehouses (multi-cluster, auto-scaling)
--   - Resource Monitors
--   - Network Policies
-- ============================================================================

-- ===================== DATABASE =====================

CREATE OR REPLACE DATABASE SAFE_SHIFT
    DATA_RETENTION_TIME_IN_DAYS = 90        -- Time Travel up to 90 days
    MAX_DATA_EXTENSION_TIME_IN_DAYS = 30    -- Extended Fail-safe
    COMMENT = 'SafeShift: Factory condition monitoring, ML risk scoring, and incentive management';

USE DATABASE SAFE_SHIFT;

-- ===================== SCHEMAS =====================
-- Separation of concerns: raw ingestion, cleaned data, analytics, ML, governance

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

-- ===================== VIRTUAL WAREHOUSES =====================
-- Multi-cluster, auto-scaling warehouses for different workload types

CREATE OR REPLACE WAREHOUSE INGEST_WH
    WAREHOUSE_SIZE = 'XSMALL'
    AUTO_SUSPEND = 60               -- Suspend after 1 min idle
    AUTO_RESUME = TRUE
    MIN_CLUSTER_COUNT = 1
    MAX_CLUSTER_COUNT = 2           -- Multi-cluster auto-scale
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
    SCALING_POLICY = 'ECONOMY'      -- Cost-optimized for long-running ML
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

-- ===================== RESOURCE MONITORS =====================
-- Budget guardrails for hackathon cost control

CREATE OR REPLACE RESOURCE MONITOR HACKATHON_BUDGET
    WITH
        CREDIT_QUOTA = 50                       -- 50 credits total
        FREQUENCY = MONTHLY
        START_TIMESTAMP = IMMEDIATELY
        TRIGGERS
            ON 75 PERCENT DO NOTIFY             -- Alert at 75%
            ON 90 PERCENT DO NOTIFY             -- Alert at 90%
            ON 100 PERCENT DO SUSPEND_IMMEDIATE; -- Hard stop at 100%

ALTER WAREHOUSE INGEST_WH SET RESOURCE_MONITOR = HACKATHON_BUDGET;
ALTER WAREHOUSE ANALYTICS_WH SET RESOURCE_MONITOR = HACKATHON_BUDGET;
ALTER WAREHOUSE ML_WH SET RESOURCE_MONITOR = HACKATHON_BUDGET;
ALTER WAREHOUSE CORTEX_WH SET RESOURCE_MONITOR = HACKATHON_BUDGET;
