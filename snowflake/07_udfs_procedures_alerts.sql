-- ============================================================================
-- SafeShift Snowflake Database — UDFs, Stored Procedures, and Alerts
-- ============================================================================
-- Snowflake features used:
--   - SQL UDFs (scalar and table)
--   - JavaScript UDFs
--   - Python UDFs (Snowpark)
--   - Stored Procedures (SQL and JavaScript)
--   - Snowflake Alerts
--   - EXECUTE IMMEDIATE
--   - SYSTEM$SEND_EMAIL
--   - Time Travel queries (AT / BEFORE)
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE SCHEMA ANALYTICS;
USE WAREHOUSE ANALYTICS_WH;

-- ===================== SQL UDFs =====================

-- ---- Compute compliance score from raw metrics ----
CREATE OR REPLACE FUNCTION COMPUTE_COMPLIANCE_SCORE(
    temperature_c FLOAT,
    humidity_pct FLOAT,
    co2_ppm FLOAT,
    pm25_mg_m3 FLOAT,
    noise_dba FLOAT,
    light_lux FLOAT,
    vibration_ms2 FLOAT
)
RETURNS FLOAT
LANGUAGE SQL
COMMENT = 'Computes a 0-100 compliance score based on OSHA/ILO thresholds from safety_thresholds.json'
AS
$$
    GREATEST(0, LEAST(100,
        100
        - IFF(temperature_c < 20 OR temperature_c > 24.4, 10, 0)       -- 68-76°F range
        - IFF(humidity_pct < 20 OR humidity_pct > 60, 5, 0)
        - IFF(co2_ppm > 5000, 30, IFF(co2_ppm > 1000, 15, 0))         -- PEL vs recommended
        - IFF(pm25_mg_m3 > 5.0, 20, IFF(pm25_mg_m3 > 2.5, 10, 0))
        - IFF(noise_dba > 90, 20, IFF(noise_dba > 85, 10, 0))         -- PEL vs action level
        - IFF(light_lux < 110, 10, IFF(light_lux < 300, 5, 0))        -- Warehouse vs factory
        - IFF(vibration_ms2 > 5.0, 15, IFF(vibration_ms2 > 2.5, 8, 0)) -- EU limit vs action
    ))
$$;

-- ---- Classify risk level from score ----
CREATE OR REPLACE FUNCTION CLASSIFY_RISK_LEVEL(compliance_score FLOAT)
RETURNS VARCHAR
LANGUAGE SQL
COMMENT = 'Maps compliance score to risk level category'
AS
$$
    CASE
        WHEN compliance_score >= 80 THEN 'LOW'
        WHEN compliance_score >= 50 THEN 'MEDIUM'
        WHEN compliance_score >= 20 THEN 'HIGH'
        ELSE 'CRITICAL'
    END
$$;

-- ---- Convert temperature units ----
CREATE OR REPLACE FUNCTION F_TO_C(temp_f FLOAT)
RETURNS FLOAT
LANGUAGE SQL
AS $$ (temp_f - 32) * 5.0 / 9.0 $$;

CREATE OR REPLACE FUNCTION C_TO_F(temp_c FLOAT)
RETURNS FLOAT
LANGUAGE SQL
AS $$ (temp_c * 9.0 / 5.0) + 32 $$;

-- ---- Compute Heat Index (simplified Rothfusz regression) ----
CREATE OR REPLACE FUNCTION HEAT_INDEX(temp_f FLOAT, humidity_pct FLOAT)
RETURNS FLOAT
LANGUAGE SQL
COMMENT = 'Simplified heat index calculation (NOAA/NWS Rothfusz regression)'
AS
$$
    CASE
        WHEN temp_f < 80 THEN temp_f
        ELSE
            -42.379
            + 2.04901523 * temp_f
            + 10.14333127 * humidity_pct
            - 0.22475541 * temp_f * humidity_pct
            - 0.00683783 * POW(temp_f, 2)
            - 0.05481717 * POW(humidity_pct, 2)
            + 0.00122874 * POW(temp_f, 2) * humidity_pct
            + 0.00085282 * temp_f * POW(humidity_pct, 2)
            - 0.00000199 * POW(temp_f, 2) * POW(humidity_pct, 2)
    END
$$;

-- ---- Noise exposure duration limit (OSHA Table G-16) ----
CREATE OR REPLACE FUNCTION MAX_NOISE_EXPOSURE_HOURS(noise_dba FLOAT)
RETURNS FLOAT
LANGUAGE SQL
COMMENT = 'Maximum permissible exposure hours per OSHA 29 CFR 1910.95 Table G-16 (5 dB exchange rate)'
AS
$$
    CASE
        WHEN noise_dba < 85 THEN NULL           -- No restriction below action level
        WHEN noise_dba >= 115 THEN 0.25         -- 15 minutes max
        ELSE 8.0 / POW(2, (noise_dba - 90) / 5) -- OSHA formula with 5 dB exchange rate
    END
$$;

-- ---- Table UDF: Breach summary for a factory over a date range ----
CREATE OR REPLACE FUNCTION GET_FACTORY_BREACH_SUMMARY(
    p_factory_id VARCHAR,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    breach_category VARCHAR,
    total_breaches INTEGER,
    breach_hours INTEGER,
    pct_of_hours FLOAT
)
LANGUAGE SQL
COMMENT = 'Returns breach breakdown for a factory over a date range'
AS
$$
    SELECT
        breach_category,
        SUM(breach_count) AS total_breaches,
        COUNT(DISTINCT hour_timestamp) AS breach_hours,
        COUNT(DISTINCT hour_timestamp) * 100.0 /
            NULLIF(DATEDIFF('HOUR', p_start_date, p_end_date), 0) AS pct_of_hours
    FROM V_BREACH_DETAILS_FLAT
    WHERE factory_id = p_factory_id
        AND hour_timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY breach_category
$$;

-- ===================== JAVASCRIPT UDF =====================

-- ---- Calculate AQI from PM2.5 (EPA breakpoint interpolation) ----
CREATE OR REPLACE FUNCTION CALCULATE_AQI_PM25(pm25_value FLOAT)
RETURNS FLOAT
LANGUAGE JAVASCRIPT
COMMENT = 'EPA AQI calculation from PM2.5 concentration using breakpoint interpolation'
AS
$$
    if (PM25_VALUE === null || PM25_VALUE < 0) return null;

    // EPA AQI breakpoints for PM2.5 (24-hour average, mg/m³ converted from µg/m³)
    var breakpoints = [
        { cLow: 0.0,    cHigh: 0.0121, iLow: 0,   iHigh: 50  },
        { cLow: 0.0121, cHigh: 0.0354, iLow: 51,  iHigh: 100 },
        { cLow: 0.0354, cHigh: 0.0554, iLow: 101, iHigh: 150 },
        { cLow: 0.0554, cHigh: 0.1504, iLow: 151, iHigh: 200 },
        { cLow: 0.1504, cHigh: 0.2504, iLow: 201, iHigh: 300 },
        { cLow: 0.2504, cHigh: 0.3504, iLow: 301, iHigh: 400 },
        { cLow: 0.3504, cHigh: 0.5004, iLow: 401, iHigh: 500 }
    ];

    for (var i = 0; i < breakpoints.length; i++) {
        var bp = breakpoints[i];
        if (PM25_VALUE >= bp.cLow && PM25_VALUE <= bp.cHigh) {
            return ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) *
                   (PM25_VALUE - bp.cLow) + bp.iLow;
        }
    }
    return 500; // Beyond AQI scale
$$;

-- ===================== PYTHON UDF (Snowpark) =====================

-- ---- Detect shift patterns from timestamps ----
CREATE OR REPLACE FUNCTION DETECT_SHIFT_PATTERN(timestamps ARRAY)
RETURNS VARIANT
LANGUAGE PYTHON
RUNTIME_VERSION = '3.11'
PACKAGES = ('numpy')
HANDLER = 'detect_shifts'
COMMENT = 'Detects shift start/end times and duration from an array of reading timestamps'
AS
$$
import numpy as np
from datetime import datetime

def detect_shifts(timestamps):
    if not timestamps or len(timestamps) < 2:
        return {"shift_detected": False, "reason": "insufficient data"}

    # Parse timestamps and extract hours
    hours = []
    for ts in timestamps:
        try:
            if isinstance(ts, str):
                dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            else:
                dt = ts
            hours.append(dt.hour + dt.minute / 60.0)
        except:
            continue

    if len(hours) < 2:
        return {"shift_detected": False, "reason": "parse failure"}

    hours = np.array(hours)
    min_hour = float(np.min(hours))
    max_hour = float(np.max(hours))
    duration = max_hour - min_hour

    # Detect shift pattern
    return {
        "shift_detected": True,
        "estimated_start_hour": round(min_hour, 1),
        "estimated_end_hour": round(max_hour, 1),
        "estimated_duration_hours": round(duration, 1),
        "exceeds_standard_shift": duration > 8,
        "exceeds_extended_shift": duration > 10,
        "reading_count": len(hours)
    }
$$;

-- ===================== STORED PROCEDURES =====================

-- ---- Procedure: Load safety thresholds from JSON config ----
CREATE OR REPLACE PROCEDURE SP_LOAD_SAFETY_THRESHOLDS(config_json VARIANT)
RETURNS VARCHAR
LANGUAGE SQL
COMMENT = 'Loads safety thresholds from JSON config into DIM_SAFETY_THRESHOLDS table'
AS
$$
BEGIN
    -- Temperature thresholds
    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS
        (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'temperature', 'F', 'recommended_min', :config_json:temperature.recommended_min,
           'OSHA/ASHRAE', :config_json:temperature
    UNION ALL
    SELECT 'temperature', 'F', 'recommended_max', :config_json:temperature.recommended_max,
           'OSHA/ASHRAE', :config_json:temperature
    UNION ALL
    SELECT 'temperature', 'F', 'heat_action_trigger', :config_json:temperature.heat_action_trigger,
           'OSHA/ASHRAE', :config_json:temperature;

    -- CO2 thresholds
    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS
        (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'co2', 'ppm', 'pel_8hr_twa', :config_json:air_quality.co2.pel_8hr_twa,
           'OSHA PEL Table Z-1', :config_json:air_quality.co2
    UNION ALL
    SELECT 'co2', 'ppm', 'recommended_max', :config_json:air_quality.co2.recommended_max,
           'OSHA CO2 Guidelines', :config_json:air_quality.co2
    UNION ALL
    SELECT 'co2', 'ppm', 'stel_15min', :config_json:air_quality.co2.stel_15min,
           'NIOSH', :config_json:air_quality.co2
    UNION ALL
    SELECT 'co2', 'ppm', 'idlh', :config_json:air_quality.co2.idlh,
           'NIOSH', :config_json:air_quality.co2;

    -- PM2.5 thresholds
    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS
        (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'pm25', 'mg/m3', 'respirable_pel', :config_json:air_quality.pm2_5.respirable_fraction_pel,
           'OSHA PNOR', :config_json:air_quality.pm2_5
    UNION ALL
    SELECT 'pm25', 'mg/m3', 'total_dust_pel', :config_json:air_quality.pm2_5.total_dust_pel,
           'OSHA PNOR', :config_json:air_quality.pm2_5;

    -- Noise thresholds
    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS
        (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'noise', 'dBA', 'action_level', :config_json:noise.action_level_8hr_twa,
           'OSHA 29 CFR 1910.95', :config_json:noise
    UNION ALL
    SELECT 'noise', 'dBA', 'pel_8hr_twa', :config_json:noise.pel_8hr_twa,
           'OSHA 29 CFR 1910.95', :config_json:noise;

    -- Lighting thresholds
    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS
        (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'lighting', 'lux', 'factory_floor_min', :config_json:lighting.factory_floor_min,
           'OSHA 29 CFR 1926.56', :config_json:lighting
    UNION ALL
    SELECT 'lighting', 'lux', 'machine_shop_min', :config_json:lighting.machine_shop_min,
           'OSHA 29 CFR 1926.56', :config_json:lighting;

    -- Vibration thresholds
    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS
        (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'vibration_hand_arm', 'm/s2', 'action_value',
           :config_json:vibration.hand_arm.action_value_8hr,
           'EU Directive 2002/44/EC', :config_json:vibration
    UNION ALL
    SELECT 'vibration_hand_arm', 'm/s2', 'exposure_limit',
           :config_json:vibration.hand_arm.exposure_limit_8hr,
           'EU Directive 2002/44/EC', :config_json:vibration;

    -- Shift thresholds
    INSERT INTO ANALYTICS.DIM_SAFETY_THRESHOLDS
        (metric_name, unit, threshold_type, threshold_value, standard_source, raw_config)
    SELECT 'shift_length', 'hours', 'standard_daily_max', :config_json:shift_length.standard_daily_max,
           'ILO Convention No. 1', :config_json:shift_length
    UNION ALL
    SELECT 'shift_length', 'hours', 'weekly_max', :config_json:shift_length.weekly_max,
           'ILO Convention No. 1', :config_json:shift_length;

    RETURN 'Safety thresholds loaded successfully';
END;
$$;

-- ---- Procedure: Generate and publish compliance report to blockchain ----
CREATE OR REPLACE PROCEDURE SP_PUBLISH_COMPLIANCE_REPORT(
    p_factory_id VARCHAR,
    p_report_date DATE
)
RETURNS VARIANT
LANGUAGE SQL
COMMENT = 'Generates compliance report, hashes it, and prepares for Solana publishing'
AS
$$
DECLARE
    v_report VARIANT;
    v_hash VARCHAR;
BEGIN
    -- Build report from daily compliance
    SELECT OBJECT_CONSTRUCT(
        'factory_id', factory_id,
        'date', compliance_date,
        'avg_score', avg_compliance_score,
        'min_score', min_compliance_score,
        'max_score', max_compliance_score,
        'breaches', total_breaches,
        'breach_breakdown', breach_breakdown,
        'risk_level', risk_level,
        'shift_hours', shift_hours_detected,
        'shift_compliant', shift_compliance,
        'generated_at', CURRENT_TIMESTAMP()
    ) INTO :v_report
    FROM ANALYTICS.FACT_DAILY_COMPLIANCE
    WHERE factory_id = :p_factory_id
        AND compliance_date = :p_report_date;

    -- Hash the report for blockchain
    v_hash := SHA2(v_report::VARCHAR, 256);

    -- Insert into blockchain table
    INSERT INTO BLOCKCHAIN.COMPLIANCE_REPORTS_ONCHAIN
        (factory_id, report_date, report_hash, report_summary)
    VALUES (:p_factory_id, :p_report_date, :v_hash, :v_report);

    -- Audit log
    INSERT INTO GOVERNANCE.AUDIT_LOG
        (event_type, actor, factory_id, event_details, source_schema, source_table)
    VALUES ('REPORT_PUBLISHED', CURRENT_USER(), :p_factory_id,
            OBJECT_CONSTRUCT('report_hash', :v_hash, 'report_date', :p_report_date),
            'BLOCKCHAIN', 'COMPLIANCE_REPORTS_ONCHAIN');

    RETURN OBJECT_CONSTRUCT(
        'status', 'SUCCESS',
        'factory_id', :p_factory_id,
        'report_date', :p_report_date,
        'report_hash', :v_hash
    );
END;
$$;

-- ---- Procedure: Time Travel — Compare conditions between two points in time ----
CREATE OR REPLACE PROCEDURE SP_TIME_TRAVEL_COMPARISON(
    p_factory_id VARCHAR,
    p_minutes_ago INTEGER
)
RETURNS TABLE (
    metric VARCHAR,
    current_value FLOAT,
    past_value FLOAT,
    change_pct FLOAT
)
LANGUAGE SQL
COMMENT = 'Uses Snowflake Time Travel to compare current vs historical sensor readings'
AS
$$
DECLARE
    res RESULTSET;
BEGIN
    res := (
        WITH current_data AS (
            SELECT
                AVG(co2_ppm) AS avg_co2,
                AVG(temperature_c) AS avg_temp,
                AVG(humidity_pct) AS avg_humidity,
                AVG(pm25_mg_m3) AS avg_pm25,
                AVG(noise_dba) AS avg_noise
            FROM STAGING.SENSOR_READINGS_CLEAN
            WHERE factory_id = :p_factory_id
                AND reading_timestamp >= DATEADD('HOUR', -1, CURRENT_TIMESTAMP())
        ),
        past_data AS (
            SELECT
                AVG(co2_ppm) AS avg_co2,
                AVG(temperature_c) AS avg_temp,
                AVG(humidity_pct) AS avg_humidity,
                AVG(pm25_mg_m3) AS avg_pm25,
                AVG(noise_dba) AS avg_noise
            FROM STAGING.SENSOR_READINGS_CLEAN
                AT(OFFSET => -60 * :p_minutes_ago)
            WHERE factory_id = :p_factory_id
                AND reading_timestamp >= DATEADD('HOUR', -1, CURRENT_TIMESTAMP())
        )
        SELECT 'CO2 (ppm)' AS metric, c.avg_co2, p.avg_co2,
               (c.avg_co2 - p.avg_co2) / NULLIF(p.avg_co2, 0) * 100
        FROM current_data c, past_data p
        UNION ALL
        SELECT 'Temperature (C)', c.avg_temp, p.avg_temp,
               (c.avg_temp - p.avg_temp) / NULLIF(p.avg_temp, 0) * 100
        FROM current_data c, past_data p
        UNION ALL
        SELECT 'Humidity (%)', c.avg_humidity, p.avg_humidity,
               (c.avg_humidity - p.avg_humidity) / NULLIF(p.avg_humidity, 0) * 100
        FROM current_data c, past_data p
        UNION ALL
        SELECT 'PM2.5 (mg/m3)', c.avg_pm25, p.avg_pm25,
               (c.avg_pm25 - p.avg_pm25) / NULLIF(p.avg_pm25, 0) * 100
        FROM current_data c, past_data p
        UNION ALL
        SELECT 'Noise (dBA)', c.avg_noise, p.avg_noise,
               (c.avg_noise - p.avg_noise) / NULLIF(p.avg_noise, 0) * 100
        FROM current_data c, past_data p
    );
    RETURN TABLE(res);
END;
$$;

-- ===================== SNOWFLAKE ALERTS =====================
-- Proactive monitoring with automated notifications

-- Notification integration (email addresses must be verified in account settings)
CREATE OR REPLACE NOTIFICATION INTEGRATION safeshift_alerts
    TYPE = EMAIL
    ENABLED = TRUE
    ALLOWED_RECIPIENTS = ('alerts@safeshift.io','ops@safeshift.io','emergency@safeshift.io','compliance@safeshift.io');

-- ---- Alert: Critical risk level detected ----
CREATE OR REPLACE ALERT ALERT_CRITICAL_RISK
    WAREHOUSE = ANALYTICS_WH
    SCHEDULE = '5 MINUTE'
    IF (EXISTS (
        SELECT 1
        FROM ANALYTICS.FACT_HOURLY_COMPLIANCE
        WHERE risk_level = 'CRITICAL'
            AND hour_timestamp >= DATEADD('MINUTE', -10, CURRENT_TIMESTAMP())
    ))
    THEN
        CALL SYSTEM$SEND_EMAIL(
            'safeshift_alerts',
            'alerts@safeshift.io',
            'CRITICAL RISK ALERT — SafeShift',
            'A factory has reached CRITICAL risk level. Immediate review required. Check the SafeShift dashboard for details.'
        );

-- ---- Alert: Sensor node offline (no data for 30+ minutes) ----
CREATE OR REPLACE ALERT ALERT_SENSOR_OFFLINE
    WAREHOUSE = ANALYTICS_WH
    SCHEDULE = '15 MINUTE'
    IF (EXISTS (
        SELECT 1
        FROM ANALYTICS.DIM_SENSOR_NODE sn
        WHERE sn.is_active = TRUE
            AND sn.last_seen < DATEADD('MINUTE', -30, CURRENT_TIMESTAMP())
    ))
    THEN
        CALL SYSTEM$SEND_EMAIL(
            'safeshift_alerts',
            'ops@safeshift.io',
            'SENSOR OFFLINE — SafeShift',
            'One or more active sensor nodes have not reported data in 30+ minutes. Check connectivity.'
        );

-- ---- Alert: CO2 approaching IDLH (40,000 ppm) ----
CREATE OR REPLACE ALERT ALERT_CO2_DANGER
    WAREHOUSE = ANALYTICS_WH
    SCHEDULE = '1 MINUTE'
    IF (EXISTS (
        SELECT 1
        FROM STAGING.SENSOR_READINGS_CLEAN
        WHERE co2_ppm > 5000     -- Above PEL
            AND reading_timestamp >= DATEADD('MINUTE', -5, CURRENT_TIMESTAMP())
    ))
    THEN
        CALL SYSTEM$SEND_EMAIL(
            'safeshift_alerts',
            'emergency@safeshift.io',
            'DANGER: CO2 ABOVE PEL — SafeShift',
            'CO2 levels have exceeded the OSHA PEL of 5,000 ppm. If levels approach 40,000 ppm (IDLH), evacuation is necessary.'
        );

-- ---- Alert: Excessive shift length detected ----
CREATE OR REPLACE ALERT ALERT_SHIFT_VIOLATION
    WAREHOUSE = ANALYTICS_WH
    SCHEDULE = '30 MINUTE'
    IF (EXISTS (
        SELECT 1
        FROM ANALYTICS.FACT_DAILY_COMPLIANCE
        WHERE shift_hours_detected > 10    -- ILO extended max
            AND compliance_date = CURRENT_DATE()
    ))
    THEN
        CALL SYSTEM$SEND_EMAIL(
            'safeshift_alerts',
            'compliance@safeshift.io',
            'SHIFT VIOLATION — SafeShift',
            'A factory has exceeded the ILO extended shift maximum of 10 hours. Review required.'
        );

-- Resume all alerts
ALTER ALERT ALERT_CRITICAL_RISK RESUME;
ALTER ALERT ALERT_SENSOR_OFFLINE RESUME;
ALTER ALERT ALERT_CO2_DANGER RESUME;
ALTER ALERT ALERT_SHIFT_VIOLATION RESUME;
