-- ============================================================================
-- SafeShift Snowflake Database — Dynamic Tables & Materialized Views
-- ============================================================================
-- Snowflake features used:
--   - Dynamic Tables (declarative pipelines with automatic refresh)
--   - Materialized Views (pre-computed for fast dashboard queries)
--   - Secure Views (for data sharing)
--   - Lateral Flatten (semi-structured data processing)
--   - Window Functions
--   - OBJECT_CONSTRUCT / ARRAY_AGG
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE WAREHOUSE ANALYTICS_WH;

-- ===================== DYNAMIC TABLES =====================
-- Dynamic tables automatically refresh based on changes to source tables.
-- They replace the need for manual ETL for many transformations.

-- ---- Dynamic Table: Unified air quality (auto-refreshes from all raw sources) ----
USE SCHEMA STAGING;

CREATE OR REPLACE DYNAMIC TABLE DT_AIR_QUALITY_UNIFIED
    TARGET_LAG = '30 minutes'       -- Refresh within 30 min of source changes
    WAREHOUSE = INGEST_WH
    COMMENT = 'Dynamic table: auto-unifies all air quality data sources'
AS
    -- Air Quality 2023
    SELECT
        'AQ2023' AS source_dataset,
        TRY_TO_TIMESTAMP(time_str, 'DD/MM/YYYY HH24:MI') AS reading_timestamp,
        co2_ppm,
        pm25 AS pm25,
        pm10 AS pm10,
        temperature AS temperature_c,
        humidity AS humidity_pct,
        NULL AS voc_indicator,
        OBJECT_CONSTRUCT('status', status, 'category_1', category_1) AS additional_metrics
    FROM RAW.AIR_QUALITY_RAW
    WHERE co2_ppm IS NOT NULL

    UNION ALL

    -- UCI 2004
    SELECT
        'UCI2004',
        TRY_TO_TIMESTAMP(CONCAT(date_str, ' ', time_str), 'DD/MM/YYYY HH24:MI:SS'),
        NULL AS co2_ppm,
        NULL AS pm25,
        NULL AS pm10,
        temperature AS temperature_c,
        relative_humidity AS humidity_pct,
        c6h6_gt AS voc_indicator,
        OBJECT_CONSTRUCT(
            'co_gt', co_gt, 'nox_gt', nox_gt, 'no2_gt', no2_gt
        )
    FROM RAW.AIR_QUALITY_UCI_RAW
    WHERE temperature IS NOT NULL

    UNION ALL

    -- Beijing PM2.5
    SELECT
        'BEIJING',
        TRY_TO_TIMESTAMP(
            CONCAT(year, '-', LPAD(month, 2, '0'), '-', LPAD(day, 2, '0'),
                   ' ', LPAD(hour, 2, '0'), ':00:00')
        ),
        NULL,
        pm25,
        NULL,
        temp,
        NULL,
        NULL,
        OBJECT_CONSTRUCT('dewp', dewp, 'pres', pres, 'cbwd', cbwd, 'iws', iws)
    FROM RAW.BEIJING_PM25_RAW
    WHERE pm25 IS NOT NULL

    UNION ALL

    -- SML2010
    SELECT
        'SML2010',
        DATEADD('SECOND', epoch_time, '1970-01-01 00:00:00'::TIMESTAMP_NTZ),
        co2_comedor AS co2_ppm,
        NULL,
        NULL,
        temp_comedor_c AS temperature_c,
        humidity_comedor AS humidity_pct,
        NULL,
        OBJECT_CONSTRUCT(
            'temp_habitacion', temp_habitacion_c,
            'co2_habitacion', co2_habitacion,
            'lighting', lighting_comedor,
            'solar_irradiance', solar_irradiance
        )
    FROM RAW.SML2010_RAW
    WHERE temp_comedor_c IS NOT NULL;

-- ---- Dynamic Table: Real-time factory dashboard ----
USE SCHEMA ANALYTICS;

CREATE OR REPLACE DYNAMIC TABLE DT_FACTORY_DASHBOARD
    TARGET_LAG = '5 minutes'        -- Near real-time for dashboards
    WAREHOUSE = ANALYTICS_WH
    COMMENT = 'Dynamic table: real-time factory status dashboard'
AS
    SELECT
        f.factory_id,
        f.factory_name,
        f.country,
        f.region,
        f.industry_sector,
        -- Latest readings (most recent hour)
        latest.hour_timestamp AS last_reading_time,
        latest.avg_temperature_c AS current_temp_c,
        latest.avg_humidity_pct AS current_humidity,
        latest.avg_co2_ppm AS current_co2,
        latest.avg_pm25 AS current_pm25,
        latest.avg_noise_dba AS current_noise,
        latest.avg_light_lux AS current_light,
        latest.compliance_score AS current_compliance_score,
        latest.risk_level AS current_risk_level,
        latest.breach_details AS current_breaches,
        -- 24-hour trend
        AVG(hc.compliance_score) AS avg_score_24h,
        MIN(hc.compliance_score) AS min_score_24h,
        COUNT(DISTINCT hc.hour_timestamp) AS active_hours_24h,
        SUM(hc.temperature_breaches + hc.noise_breaches + hc.vibration_breaches) AS critical_breaches_24h,
        -- Reward eligibility
        CASE
            WHEN AVG(hc.compliance_score) >= 95 THEN 'CERTIFICATION ELIGIBLE'
            WHEN AVG(hc.compliance_score) >= 85 THEN 'INSURANCE DISCOUNT ELIGIBLE'
            WHEN AVG(hc.compliance_score) >= 75 THEN 'STABLECOIN REWARD ELIGIBLE'
            ELSE 'NOT ELIGIBLE'
        END AS reward_status
    FROM DIM_FACTORY f
    LEFT JOIN FACT_HOURLY_COMPLIANCE hc
        ON f.factory_id = hc.factory_id
        AND hc.hour_timestamp >= DATEADD('HOUR', -24, CURRENT_TIMESTAMP())
    LEFT JOIN (
        SELECT * FROM FACT_HOURLY_COMPLIANCE
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY factory_id ORDER BY hour_timestamp DESC
        ) = 1
    ) latest ON f.factory_id = latest.factory_id
    WHERE f.is_active = TRUE
    GROUP BY
        f.factory_id, f.factory_name, f.country, f.region, f.industry_sector,
        latest.hour_timestamp, latest.avg_temperature_c, latest.avg_humidity_pct,
        latest.avg_co2_ppm, latest.avg_pm25, latest.avg_noise_dba,
        latest.avg_light_lux, latest.compliance_score, latest.risk_level,
        latest.breach_details;

-- ---- Dynamic Table: Incident analytics ----
CREATE OR REPLACE DYNAMIC TABLE DT_INCIDENT_ANALYTICS
    TARGET_LAG = '1 hour'
    WAREHOUSE = ANALYTICS_WH
    COMMENT = 'Dynamic table: incident pattern analysis'
AS
    WITH incident_employee_counts AS (
        SELECT
            country,
            industry_sector,
            accident_level,
            critical_risk,
            COALESCE(employee_type, 'Unknown') AS employee_type,
            local_site,
            potential_level,
            COUNT(*) AS emp_type_count
        FROM RAW.SAFETY_INCIDENTS_RAW
        GROUP BY country, industry_sector, accident_level, critical_risk, employee_type, local_site, potential_level
    )
    SELECT
        country,
        industry_sector,
        accident_level,
        critical_risk,
        SUM(emp_type_count) AS incident_count,
        COUNT(DISTINCT local_site) AS affected_sites,
        ARRAY_AGG(DISTINCT potential_level) AS potential_levels,
        OBJECT_CONSTRUCT(
            'total', SUM(emp_type_count),
            'by_employee_type', OBJECT_AGG(
                employee_type,
                emp_type_count::VARIANT
            )
        ) AS breakdown
    FROM incident_employee_counts
    GROUP BY country, industry_sector, accident_level, critical_risk;

-- ===================== MATERIALIZED VIEWS =====================
-- Pre-computed aggregations for fast dashboard performance

USE SCHEMA ANALYTICS;

-- ---- Weekly compliance trends (materialized for chart performance) ----
CREATE OR REPLACE MATERIALIZED VIEW MV_WEEKLY_COMPLIANCE_TREND AS
    SELECT
        factory_id,
        DATE_TRUNC('WEEK', compliance_date) AS week_start,
        AVG(avg_compliance_score) AS weekly_avg_score,
        MIN(min_compliance_score) AS weekly_min_score,
        SUM(total_breaches) AS weekly_total_breaches,
        MODE(risk_level) AS predominant_risk_level,
        COUNT(*) AS days_monitored
    FROM FACT_DAILY_COMPLIANCE
    GROUP BY factory_id, DATE_TRUNC('WEEK', compliance_date);

-- ===================== SECURE VIEWS =====================
-- For sharing data with external stakeholders (regulators, NGOs)

CREATE OR REPLACE SECURE VIEW SV_PUBLIC_COMPLIANCE_SUMMARY AS
    SELECT
        f.country,
        f.region,
        f.industry_sector,
        dc.compliance_date,
        COUNT(DISTINCT dc.factory_id) AS factories_monitored,
        AVG(dc.avg_compliance_score) AS region_avg_score,
        SUM(IFF(dc.risk_level = 'LOW', 1, 0)) AS factories_low_risk,
        SUM(IFF(dc.risk_level IN ('HIGH', 'CRITICAL'), 1, 0)) AS factories_high_risk
    FROM FACT_DAILY_COMPLIANCE dc
    JOIN DIM_FACTORY f ON dc.factory_id = f.factory_id
    GROUP BY f.country, f.region, f.industry_sector, dc.compliance_date
    COMMENT = 'Secure view: anonymized regional compliance for public sharing';

-- ---- Secure view for blockchain verification ----
CREATE OR REPLACE SECURE VIEW SV_BLOCKCHAIN_VERIFICATION AS
    SELECT
        r.report_date,
        r.report_hash,
        r.solana_tx_hash,
        f.country,
        f.region,
        r.report_summary
    FROM BLOCKCHAIN.COMPLIANCE_REPORTS_ONCHAIN r
    JOIN DIM_FACTORY f ON r.factory_id = f.factory_id
    COMMENT = 'Secure view: blockchain report verification for auditors';

-- ===================== LATERAL FLATTEN EXAMPLES =====================
-- Process semi-structured VARIANT data

-- Flatten breach details from hourly compliance
CREATE OR REPLACE VIEW V_BREACH_DETAILS_FLAT AS
    SELECT
        hc.factory_id,
        hc.hour_timestamp,
        hc.compliance_score,
        kv.key AS breach_category,
        kv.value::INTEGER AS breach_count
    FROM FACT_HOURLY_COMPLIANCE hc,
        LATERAL FLATTEN(INPUT => hc.breach_details) kv
    WHERE kv.value::INTEGER > 0;

-- Flatten factory metadata
CREATE OR REPLACE VIEW V_FACTORY_METADATA_FLAT AS
    SELECT
        f.factory_id,
        f.factory_name,
        kv.key AS metadata_key,
        kv.value::VARCHAR AS metadata_value
    FROM DIM_FACTORY f,
        LATERAL FLATTEN(INPUT => f.factory_metadata, OUTER => TRUE) kv;

-- Flatten sensor node capabilities
CREATE OR REPLACE VIEW V_SENSOR_CAPABILITIES AS
    SELECT
        sn.sensor_node_id,
        sn.factory_id,
        sn.node_type,
        s.value::VARCHAR AS sensor_type
    FROM DIM_SENSOR_NODE sn,
        LATERAL FLATTEN(INPUT => sn.sensors_available) s;
