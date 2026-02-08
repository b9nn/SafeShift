# SafeShift Bridge Setup

This guide covers the three bridges: Arduino → Express, Express → ML API, and Express → Snowflake.

**For step-by-step Arduino live data setup**, see [ARDUINO-PIPELINE-SETUP.md](ARDUINO-PIPELINE-SETUP.md).

---

## Workflow

```
Arduino → Serial Bridge → Express Server → ML API → Risk Score → Solana Reward
                ↓                 ↓                       ↓
            Snowflake         Snowflake               Snowflake
         (raw readings)  (compliance scores)      (reward txns)
```

---

## 1. Express → ML API (Bridge #2)

**Already wired.** The Express server calls `http://localhost:8000/predict` by default.

**To run:**
1. Start the FastAPI ML API:
   ```bash
   pip install -r requirements.txt
   python -m src.api
   ```
2. Start the Express server:
   ```bash
   npm run server
   ```

If the ML API is down, Express falls back to simple threshold scoring.

**Env var:** `ML_API_URL` (default: `http://localhost:8000`)

---

## 2. Express → Snowflake (Bridge #3)

The Express server writes raw readings, ML risk scores, and reward payouts to Snowflake when configured.

**Setup:**
1. Run the Snowflake migration for ML risk scores:
   ```sql
   -- In Snowflake, run snowflake/10_ml_risk_scores.sql
   ```
2. Set environment variables:
   ```
   SNOWFLAKE_ACCOUNT=your_account
   SNOWFLAKE_USER=your_user
   SNOWFLAKE_PASSWORD=your_password
   SNOWFLAKE_DATABASE=SAFE_SHIFT
   SNOWFLAKE_WAREHOUSE=INGEST_WH
   ```

If env vars are not set, Snowflake writes are skipped (no errors).

---

## 3. Arduino → Express (Bridge #1)

**Arduino sketch:** `ArduinoToJson/ArduinoToJson.ino` (the project’s Arduino file)

- Board: Arduino Nano 33 BLE Sense
- Reads: temp (LPS22HB), pressure (LPS22HB), light/proximity/gesture (APDS9960), accel/gyro/mag (LSM9DS1), noise (PDM mic)
- Outputs JSON over Serial every 200 ms (`ts_ms`, `temp_c`, `pressure_hPa`, `accel`, `color`, `mic_rms`, etc.)

**Serial bridge:** `scripts/serial-bridge.js`

Reads Serial, maps ArduinoToJson format to server metrics, and POSTs to Express. Adds default `deviceId`/`companyId` if not present.

**To run:**
1. Flash `ArduinoToJson/ArduinoToJson.ino` to the Nano 33 BLE Sense
2. Connect via USB
3. Run the bridge:
   ```bash
   npm run bridge
   # Or specify port: node scripts/serial-bridge.js COM3
   ```
4. Ensure Express server is running (`npm run server`)

**Configure device/company:** Set env vars `DEVICE_ID` and `COMPANY_ID` when running the bridge (defaults: `arduino-001`, `company-001`).

---

## Full Stack Startup

```bash
# Terminal 1: ML API
python -m src.api

# Terminal 2: Express server
npm run server

# Terminal 3: Serial bridge (Arduino connected)
npm run bridge
```

Register a company with the Express API (or React frontend) before sending sensor data, so rewards can be sent to the company wallet.
