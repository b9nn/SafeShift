# SafeShift Snowflake Architecture

## Quick Start

1. Log into Snowflake (use ACCOUNTADMIN role)
2. Open a SQL Worksheet
3. Paste the entire contents of `snowflake/RUN_ALL.sql` and click **Run All** (Ctrl+Shift+Enter)
4. Upload CSV datasets to stages via Snowsight (Data > Stages > + Files)
5. Run `snowflake/08_data_sharing_and_load.sql` to COPY INTO tables
6. Run `snowflake/09_test_validation.sql` to verify everything works
7. Run `snowflake/11_verify_bridge_data.sql` after Express sends data, to verify the bridge

---

## What Snowflake Does in SafeShift

Snowflake is the **data warehouse**. It stores everything: raw sensor readings, cleaned data, compliance scores, ML features, reward payouts, and blockchain transaction records. It also runs its own anomaly detection (Cortex ML) and generates AI compliance reports (Cortex LLM).

```
Arduino → Express → Snowflake (raw readings)
                  → ML API → Snowflake (risk scores)
                  → Solana → Snowflake (reward txns)

Inside Snowflake:
RAW → STAGING → ANALYTICS → ML / BLOCKCHAIN / GOVERNANCE
 ↑       ↑          ↑
 |   Streams     Tasks (automated pipeline)
 |   (CDC)       run every 5 min
```

---

## 6 Schemas

| Schema | Purpose | Key Tables |
|---|---|---|
| **RAW** | Landing zone — raw data exactly as received | SENSOR_READINGS_RAW, ML_RISK_SCORES, AIR_QUALITY_RAW, BEIJING_PM25_RAW, SML2010_RAW, etc. |
| **STAGING** | Cleaned + validated data | SENSOR_READINGS_CLEAN (F→C conversion, quality flags) |
| **ANALYTICS** | Compliance scores, factory registry, daily rollups | DIM_FACTORY, FACT_HOURLY_COMPLIANCE, FACT_DAILY_COMPLIANCE, DIM_SAFETY_THRESHOLDS |
| **ML** | Feature store, Cortex models, anomaly results | FEATURE_STORE, ANOMALY_RESULTS, TEMP_FORECAST_RESULTS |
| **BLOCKCHAIN** | Solana transaction records | REWARD_PAYOUTS, COMPLIANCE_REPORTS_ONCHAIN |
| **GOVERNANCE** | Tags, masking policies, audit logs | AUDIT_LOG, ANALYST_REGION_ASSIGNMENTS |

---

## How Data Flows (The Pipeline)

### Step 1: Data Arrives in RAW

Express server inserts into three tables:
- `RAW.SENSOR_READINGS_RAW` — every sensor reading (temp, humidity, pressure, light, noise, vibration)
- `RAW.ML_RISK_SCORES` — risk scores from the ML API after each `/predict` call
- `BLOCKCHAIN.REWARD_PAYOUTS` — reward records when Solana tx is sent

Training datasets (SML2010, AirQualityUCI, etc.) are also loaded into RAW via COPY INTO from stages.

### Step 2: Streams Detect Changes

Snowflake **Streams** watch RAW tables for new rows (Change Data Capture):
- `STREAM_SENSOR_RAW` → watches SENSOR_READINGS_RAW
- `STREAM_AIR_QUALITY_RAW` → watches AIR_QUALITY_RAW
- `STREAM_SENSOR_CLEAN` → watches SENSOR_READINGS_CLEAN
- `STREAM_DAILY_COMPLIANCE` → watches FACT_DAILY_COMPLIANCE

When new rows appear, streams "wake up" the Tasks.

### Step 3: Tasks Run Automatically (DAG Pipeline)

Tasks form a dependency chain that runs every 5 minutes:

```
TASK_CLEAN_SENSOR_DATA (every 5 min, root)
    │   Converts F→C, validates ranges, flags bad data
    │   RAW.SENSOR_READINGS_RAW → STAGING.SENSOR_READINGS_CLEAN
    │
    ├── TASK_COMPUTE_HOURLY_COMPLIANCE
    │       Groups by factory+hour, counts threshold breaches,
    │       computes compliance score (0-100)
    │       STAGING → ANALYTICS.FACT_HOURLY_COMPLIANCE
    │
    ├── TASK_UPDATE_FEATURE_STORE
    │       Computes rolling window features (1h avg, 24h avg, etc.)
    │       for external ML model training
    │       STAGING → ML.FEATURE_STORE
    │
    └── TASK_LOG_PIPELINE_RUN
            Writes audit log entry

TASK_DAILY_COMPLIANCE_ROLLUP (daily at 2 AM ET)
    │   Rolls up hourly → daily compliance summaries
    │   ANALYTICS.FACT_HOURLY_COMPLIANCE → ANALYTICS.FACT_DAILY_COMPLIANCE
    │
    └── TASK_EVALUATE_REWARDS
            Checks if factory scored 75+ → inserts reward record
            ANALYTICS → BLOCKCHAIN.REWARD_PAYOUTS
```

### Step 4: Dynamic Tables Auto-Refresh

These tables refresh themselves when source data changes:
- `DT_AIR_QUALITY_UNIFIED` (30-min lag) — merges all 4 training datasets into one table
- `DT_FACTORY_DASHBOARD` (5-min lag) — real-time dashboard: latest readings, 24h trends, reward eligibility
- `DT_INCIDENT_ANALYTICS` (1-hour lag) — incident pattern analysis from safety dataset

---

## Compliance Scoring

The `COMPUTE_COMPLIANCE_SCORE` function scores each sensor reading on a 0-100 scale based on OSHA/ILO/EU thresholds. **5 parameters** matching the Arduino Nano 33 BLE Sense sensors:

```sql
COMPUTE_COMPLIANCE_SCORE(temperature_c, humidity_pct, noise_dba, light_lux, vibration_ms2)
```

| Sensor | Safe Range | Penalty | Standard |
|---|---|---|---|
| Temperature | 20-24.4°C (68-76°F) | -15 pts | OSHA/ASHRAE |
| Humidity | 20-60% | -10 pts | OSHA/ASHRAE |
| Noise | ≤85 dBA | -15 (action) / -25 (PEL >90) | OSHA 29 CFR 1910.95 |
| Light | ≥300 lux | -8 (warehouse) / -15 (<110 lux) | OSHA 29 CFR 1926.56 |
| Vibration | ≤2.5 m/s² | -12 (action) / -20 (>5.0 limit) | EU 2002/44/EC |

**Score = 100 minus penalties.** Max penalty = 85 points → worst possible score = 15.

Risk levels: 80+ = LOW, 50-79 = MEDIUM, 20-49 = HIGH, <20 = CRITICAL.

---

## UDFs (User-Defined Functions)

| Function | Type | What It Does |
|---|---|---|
| `COMPUTE_COMPLIANCE_SCORE(temp, hum, noise, light, vib)` | SQL | Returns 0-100 compliance score |
| `CLASSIFY_RISK_LEVEL(score)` | SQL | Returns LOW/MEDIUM/HIGH/CRITICAL |
| `F_TO_C(temp_f)` | SQL | Fahrenheit → Celsius |
| `C_TO_F(temp_c)` | SQL | Celsius → Fahrenheit |
| `HEAT_INDEX(temp_f, humidity)` | SQL | NOAA heat index (Rothfusz regression) |
| `MAX_NOISE_EXPOSURE_HOURS(dba)` | SQL | Max hours per OSHA Table G-16 |
| `CALCULATE_AQI_PM25(pm25)` | JavaScript | EPA AQI from PM2.5 breakpoints |
| `GET_FACTORY_BREACH_SUMMARY(factory, start, end)` | Table UDF | Breach breakdown over date range |

---

## Stored Procedures

| Procedure | What It Does |
|---|---|
| `SP_LOAD_SAFETY_THRESHOLDS(config_json)` | Loads `config/safety_thresholds.json` into DIM_SAFETY_THRESHOLDS |
| `SP_PUBLISH_COMPLIANCE_REPORT(factory_id, date)` | Hashes daily compliance report (SHA-256) and inserts into BLOCKCHAIN schema for Solana publishing |
| `SP_TIME_TRAVEL_COMPARISON(factory_id, minutes_ago)` | Uses Snowflake Time Travel to compare current vs past sensor readings (temp, humidity, light, noise, vibration) |

---

## Cortex ML (Snowflake's Built-in ML)

These require data in the tables first. Run `04_cortex_ml.sql` **after** loading datasets.

| Model | Type | What It Does |
|---|---|---|
| `SENSOR_ANOMALY_MODEL` | Anomaly Detection | Detects abnormal temperature patterns per factory |
| `TEMP_ANOMALY_MODEL` | Anomaly Detection | Secondary temperature anomaly model |
| `SENSOR_FORECAST_MODEL` | Forecast | Predicts next 24 hours of temperature per factory |

Results go into `ML.ANOMALY_RESULTS` and `ML.TEMP_FORECAST_RESULTS`.

---

## Cortex LLM (AI-Powered Views)

These views call Snowflake Cortex AI functions when queried:

| View | Cortex Function | What It Does |
|---|---|---|
| `V_CORTEX_COMPLIANCE_REPORTS` | COMPLETE (mistral-large2) | AI-generated daily compliance report per factory |
| `V_INCIDENT_SUMMARIES` | SUMMARIZE | Summarizes safety incident descriptions |
| `V_INCIDENT_SENTIMENT` | SENTIMENT | Sentiment score for incident descriptions |
| `V_INCIDENTS_ENGLISH` | TRANSLATE (pt→en) | Translates Portuguese incident reports to English |
| `V_INCIDENT_ROOT_CAUSES` | EXTRACT_ANSWER | Extracts root cause, injury, safety equipment from incident text |
| `V_INCIDENT_CLASSIFICATION` | CLASSIFY_TEXT | Classifies incidents into hazard categories |
| `V_ANOMALY_EXPLANATIONS` | COMPLETE (mistral-large2) | Plain-English explanation of detected anomalies |

---

## Security & Governance

### RBAC Roles

```
ACCOUNTADMIN
    └── SAFESHIFT_ADMIN (full access)
            ├── SAFESHIFT_ANALYST (read analytics/staging, region-restricted)
            ├── SAFESHIFT_AUDITOR (read analytics/blockchain/governance)
            │       └── SAFESHIFT_FINANCE (read financial data)
            ├── SAFESHIFT_ML_ENGINEER (read/write ML schema)
            └── SAFESHIFT_BLOCKCHAIN (read/write blockchain schema)
```

### Data Masking Policies

| Policy | What It Masks | Who Sees Real Data |
|---|---|---|
| `MASK_FACTORY_ID` | Factory identifiers | ADMIN, AUDITOR (analysts see hashed IDs) |
| `MASK_SOLANA_TX` | Solana transaction hashes | ADMIN, BLOCKCHAIN (others see `abc12345...wxyz`) |
| `MASK_FINANCIAL` | Reward amounts | ADMIN, FINANCE (auditors see rounded, others see NULL) |

### Row Access Policy

`FACTORY_REGION_ACCESS` restricts analysts to only see factories in their assigned regions. Admins and auditors see everything.

### Tags

Tables are tagged with `DATA_SENSITIVITY`, `DATA_DOMAIN`, `PII_TYPE`, `DATA_FRESHNESS`, and `REGULATORY_STANDARD` for data catalog classification.

---

## Alerts

Automated monitoring (requires email notification integration — uncomment in RUN_ALL.sql section 21):

| Alert | Trigger | Schedule |
|---|---|---|
| `ALERT_CRITICAL_RISK` | Any factory reaches CRITICAL risk level | Every 5 min |
| `ALERT_SENSOR_OFFLINE` | Active sensor node not reporting for 30+ min | Every 15 min |
| `ALERT_NOISE_DANGER` | Noise exceeds 90 dBA OSHA PEL | Every 5 min |

---

## Secure Data Sharing

A Snowflake Share (`SAFESHIFT_COMPLIANCE_SHARE`) provides external stakeholders (regulators, NGOs) read-only access to:
- `SV_PUBLIC_COMPLIANCE_SUMMARY` — anonymized regional compliance averages
- `SV_BLOCKCHAIN_VERIFICATION` — blockchain report hashes for audit verification

---

## ML Feature Store

`ML.FEATURE_STORE` pre-computes rolling window features for external ML training (our LSTM autoencoder). Updated automatically by the task pipeline.

| Feature | Description |
|---|---|
| `temp_1h_avg`, `temp_1h_std`, `temp_24h_avg` | Temperature rolling windows |
| `humidity_1h_avg`, `humidity_1h_std`, `humidity_24h_avg` | Humidity rolling windows |
| `light_1h_avg`, `light_1h_std` | Light rolling windows |
| `pressure_1h_avg` | Pressure rolling window |
| `noise_1h_avg`, `noise_1h_max` | Noise rolling windows |
| `vibration_1h_avg`, `vibration_1h_max` | Vibration rolling windows |
| `heat_index` | Computed from temp + humidity (NOAA formula) |
| `breach_rate_24h` | Fraction of readings breaching any threshold in 24h |
| `hour_of_day`, `day_of_week`, `is_weekend` | Temporal features |
| `temp_anomaly_flag` | Flag from Cortex anomaly detection |

---

## SQL File Reference

Run these **in order** (or just use `RUN_ALL.sql`):

| File | What It Creates |
|---|---|
| `00_setup_infrastructure.sql` | Database, schemas, warehouses, resource monitor |
| `01_file_formats_and_stages.sql` | CSV/TSV/JSON/Parquet formats, 6 internal stages |
| `02_tables.sql` | All RAW, STAGING, ANALYTICS, BLOCKCHAIN tables |
| `03_governance.sql` | Tags, masking policies, row access, audit log |
| `04_cortex_ml.sql` | Cortex ML models + LLM views (**run after data load**) |
| `05_streams_and_tasks.sql` | CDC streams + automated task DAG |
| `06_dynamic_tables_and_views.sql` | Dynamic tables, materialized views, secure views |
| `07_udfs_procedures_alerts.sql` | UDFs, stored procedures, alerts |
| `08_data_sharing_and_load.sql` | RBAC roles, data sharing, COPY INTO commands |
| `09_test_validation.sql` | 20 tests to verify the whole setup |
| `10_ml_risk_scores.sql` | ML_RISK_SCORES table (for Express bridge) |
| `11_verify_bridge_data.sql` | Quick check that Express data landed |
| **`RUN_ALL.sql`** | **Combined script — deploys everything in one shot** |

---

## How Express Writes to Snowflake

The Express server uses the Snowflake Node.js SDK. When `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, and `SNOWFLAKE_PASSWORD` are set in `.env`:

1. **Every sensor reading** → INSERT into `RAW.SENSOR_READINGS_RAW`
2. **Every ML prediction** → INSERT into `RAW.ML_RISK_SCORES`
3. **Every Solana reward** → INSERT into `BLOCKCHAIN.REWARD_PAYOUTS`

If env vars are not set, Snowflake writes are silently skipped.

---

## Loading Training Datasets

1. Go to Snowsight → Data → Stages
2. Upload files to the correct stage:
   - `Air-Quality-Dataset.csv` → `@STG_AIR_QUALITY`
   - `AirQualityUCI.csv` → `@STG_AIR_QUALITY`
   - `PRSA_data_2010.1.1-2014.12.31.csv` → `@STG_SENSOR_DATA`
   - `SML2010 NEW.txt` / `SML2010.txt` → `@STG_SML2010`
   - `Steel_industry_data.csv` → `@STG_INDUSTRIAL`
   - `IHMStefanini_industrial_safety.csv` → `@STG_INDUSTRIAL`
3. Run the COPY INTO commands from `08_data_sharing_and_load.sql`
4. Verify with: `SELECT table_name, COUNT(*) FROM ... UNION ALL ...` at the bottom of that file

---

## Cost Control

A resource monitor (`HACKATHON_BUDGET`) is set with 50 credits/month:
- 75% → notification
- 90% → notification
- 100% → all warehouses suspended immediately

All warehouses auto-suspend after 1-5 minutes of inactivity.
