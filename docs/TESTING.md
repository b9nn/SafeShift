# SafeShift Testing Guide

## 1. Snowflake Test

After sending sensor data through Express (e.g., via `Invoke-RestMethod` or the E2E script), verify data landed in Snowflake:

1. Open Snowflake web UI → **Worksheets**
2. Create a new worksheet
3. Copy and run `snowflake/11_verify_bridge_data.sql`
4. You should see:
   - `RAW.SENSOR_READINGS_RAW` — row count > 0, recent rows with factory_id, sensor_node_id, metrics
   - `RAW.ML_RISK_SCORES` — row count > 0, recent risk scores
   - `BLOCKCHAIN.REWARD_PAYOUTS` — row count > 0 if a reward was sent, with solana_tx_hash

**If no data:** Ensure `.env` has `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD` and Express was restarted after adding them. Check Express logs for Snowflake connection errors.

---

## 2. E2E Test

Full flow: register company → send sensor data → verify response and reward.

**Prerequisites:**
- Express server running (`npm run server`)
- ML API running (`python -m src.api`)
- Config wallet set (`config/wallet.js` with devnet keypair)

**Run:**
```bash
npm run test:e2e
```

**Expected output:**
```
🧪 SafeShift E2E Test
1. Register company...   ✅
2. Send sensor data...   ✅ Risk score < 0.3, Reward sent
3. Verify /api/rewards... ✅
Passed: X | Failed: 0
✅ E2E test passed
```

**Note:** Reward cooldown is 1 hour per company. If you ran the test recently with `company-001`, use the E2E script (it uses `e2e-test-company`) or wait 1 hour before expecting another reward.

---

## 3. Manual E2E (PowerShell)

```powershell
# 1. Register
Invoke-RestMethod -Uri "http://localhost:3001/api/register-company" -Method POST -ContentType "application/json" -Body '{"companyId":"company-001","name":"Test Factory","walletAddress":"376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF"}'

# 2. Send sensor data (safe)
Invoke-RestMethod -Uri "http://localhost:3001/api/sensor-data" -Method POST -ContentType "application/json" -Body '{"deviceId":"test-1","companyId":"company-001","metrics":{"temperature":72,"humidity":45,"airQuality":850,"noise":70,"lighting":400,"pressure":1013}}'

# 3. Check rewards
Invoke-RestMethod -Uri "http://localhost:3001/api/rewards"

# 4. Verify in Snowflake (run 11_verify_bridge_data.sql)
```
