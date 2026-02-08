# Snowflake Setup Guide

## Quick Setup

### 1. Environment Variables

Your Snowflake credentials are already in `.env`:

```env
SNOWFLAKE_ACCOUNT=LPCJKSM-FS98034
SNOWFLAKE_USER=B9NN
SNOWFLAKE_PASSWORD=Whiteferrari91!
SNOWFLAKE_DATABASE=SAFE_SHIFT
SNOWFLAKE_WAREHOUSE=INGEST_WH
```

### 2. Test Connection

```bash
npm run test-snowflake
```

This will:
- ✅ Test connection to Snowflake
- ✅ Check if required tables exist
- ✅ Test insert operations

### 3. Create Tables (If Needed)

If tables don't exist, run the migration scripts in Snowflake:

1. **Open Snowflake Web UI** or use SnowSQL
2. **Run the migration scripts** in order:
   ```sql
   -- Run these in Snowflake:
   -- 1. snowflake/00_setup_infrastructure.sql
   -- 2. snowflake/02_tables.sql (creates RAW.SENSOR_READINGS_RAW)
   -- 3. snowflake/10_ml_risk_scores.sql (creates RAW.ML_RISK_SCORES)
   -- 4. snowflake/02_tables.sql also creates BLOCKCHAIN.REWARD_PAYOUTS
   ```

Or run all at once:
```sql
-- In Snowflake, run:
snowflake/RUN_ALL.sql
```

### 4. Verify It Works

After creating tables, run the test again:

```bash
npm run test-snowflake
```

You should see:
- ✅ Connected to Snowflake!
- ✅ All tables exist
- ✅ Test inserts succeeded

---

## How It Works

The backend automatically writes to Snowflake when:

1. **Sensor data arrives** → `RAW.SENSOR_READINGS_RAW`
2. **ML model scores** → `RAW.ML_RISK_SCORES`
3. **Rewards are sent** → `BLOCKCHAIN.REWARD_PAYOUTS`

All writes are **fire-and-forget** (non-blocking) - if Snowflake is down, the server continues working.

---

## Troubleshooting

### Connection Failed

- Check credentials in `.env`
- Verify account format: `LPCJKSM-FS98034` (no `.snowflakecomputing.com`)
- Check if warehouse `INGEST_WH` exists and is running
- Verify database `SAFE_SHIFT` exists

### Tables Don't Exist

Run the migration scripts in `snowflake/` directory.

### Insert Errors

- Check table schemas match the code
- Verify you have INSERT permissions
- Check warehouse is running (not suspended)

---

## Manual Test

You can also test manually in Snowflake:

```sql
-- Check connection
SELECT CURRENT_DATABASE(), CURRENT_WAREHOUSE();

-- Check tables
SHOW TABLES IN SCHEMA RAW;
SHOW TABLES IN SCHEMA BLOCKCHAIN;

-- Test insert
INSERT INTO RAW.SENSOR_READINGS_RAW (
  factory_id, sensor_node_id, reading_timestamp,
  temperature_f, humidity_pct, co2_ppm, noise_dba, light_lux, pressure_kpa
) VALUES (
  'test-factory', 'test-device', CURRENT_TIMESTAMP(),
  72.5, 45.0, 850, 75, 350, 101.3
);
```

---

## What Gets Stored

### RAW.SENSOR_READINGS_RAW
- Raw sensor data from Arduino devices
- Temperature, humidity, air quality, noise, lighting, pressure
- Timestamp and device info

### RAW.ML_RISK_SCORES
- ML model risk scores (0.0-1.0)
- Confidence levels
- Timestamps

### BLOCKCHAIN.REWARD_PAYOUTS
- Solana transaction hashes
- Reward amounts
- Compliance scores
- Payout dates

---

## Next Steps

Once Snowflake is working:
1. ✅ Backend will automatically write data
2. ✅ Check Snowflake dashboard for incoming data
3. ✅ Use Snowflake for analytics and reporting
4. ✅ Set up alerts on risk scores
