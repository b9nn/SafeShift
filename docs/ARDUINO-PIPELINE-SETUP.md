# Arduino → Live Data Pipeline Setup

This guide connects the Arduino Nano 33 BLE Sense to the SafeShift pipeline for live sensor data, ML scoring, and Snowflake ingestion.

**Arduino sketch:** `ArduinoToJson/ArduinoToJson.ino` (the project’s main Arduino file).

## Data Flow

```
Arduino (USB Serial)
    ↓
Serial Bridge (scripts/serial-bridge.js)
    ↓
Express Server (POST /api/sensor-data)
    ├── ML API (FastAPI /predict) → Risk Score
    ├── Snowflake RAW.SENSOR_READINGS_RAW
    ├── Snowflake RAW.ML_RISK_SCORES
    └── (Optional) Solana reward if safe
         ↓
Snowflake Streams & Tasks
    ↓
SENSOR_READINGS_CLEAN → FACT_HOURLY_COMPLIANCE → Cortex ML
```

---

## 1. Hardware Setup

**Board:** Arduino Nano 33 BLE Sense

**Required libraries** (install via Arduino IDE Library Manager):

- Arduino_HTS221 (temp + humidity)
- Arduino_LPS22HB (pressure)
- Arduino_APDS9960 (light)
- Arduino_LSM9DS1 (accelerometer / vibration)
- PDM (built-in, microphone)

---

## 2. Flash the Arduino Sketch

1. Open **`ArduinoToJson/ArduinoToJson.ino`** in Arduino IDE.
2. Select **Board**: Arduino Nano 33 BLE.
3. Select the correct **Port** (e.g. `COM3` on Windows, `/dev/ttyACM0` on Linux).
4. Upload the sketch.

After upload, the Serial Monitor at 115200 baud should show:
```
{"status":"all sensors ready"}
```
Then one JSON packet every 200 ms with `ts_ms`, `temp_c`, `pressure_hPa`, `accel`, `color`, `mic_rms`, etc. The serial bridge maps this format to the server’s expected metrics.

---

## 3. Configure Device & Company IDs

`ArduinoToJson.ino` does not send `deviceId` or `companyId`; the serial bridge adds them with defaults:

- **DEVICE_ID** (default `arduino-001`) — sensor node ID
- **COMPANY_ID** (default `company-001`) — maps to `factory_id` in Snowflake

Override via environment when starting the bridge:

```bash
DEVICE_ID=floor1-sensor1 COMPANY_ID=factory-001 node scripts/serial-bridge.js
```

If you want rewards, register the company via the Express API with the same `companyId` and a Solana wallet.

---

## 4. Seed Snowflake (Factory & Sensor)

Before live data flows, add the factory and sensor to Snowflake dimension tables:

```bash
# In Snowflake, run:
# snowflake/12_seed_factory_sensor.sql
```

This seeds `company-001` (factory) and `arduino-001` (sensor) to match the bridge defaults. If you use `DEVICE_ID`/`COMPANY_ID`, adjust the script or run equivalent `MERGE` statements for your IDs.

---

## 5. Environment Variables

Create a `.env` file in the project root:

```env
# Express server
PORT=3001

# ML API (optional — falls back to threshold scoring if unreachable)
ML_API_URL=http://localhost:8000

# Snowflake (required for data landing)
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=SAFE_SHIFT
SNOWFLAKE_WAREHOUSE=INGEST_WH

# Serial bridge
SERVER_URL=http://localhost:3001
```

---

## 6. Start the Full Stack

**Terminal 1 — ML API (optional but recommended):**

```bash
pip install -r requirements.txt
python -m src.api
```

**Terminal 2 — Express server:**

```bash
npm run server
```

**Terminal 3 — Serial bridge (Arduino connected via USB):**

```bash
npm run bridge
# Or specify port: node scripts/serial-bridge.js COM3
```

---

## 7. Verify Live Data

1. **Bridge console** — You should see lines like:
   ```
   ✅ risk=0.12
   ```
   (Risk score and safety flag per reading.)

2. **Snowflake** — Check raw and clean tables:
   ```sql
   SELECT * FROM RAW.SENSOR_READINGS_RAW ORDER BY reading_timestamp DESC LIMIT 10;
   SELECT * FROM STAGING.SENSOR_READINGS_CLEAN ORDER BY reading_timestamp DESC LIMIT 10;
   ```

3. **Express health** — `GET http://localhost:3001/api/health`

---

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| No serial port found | Specify port: `node scripts/serial-bridge.js COM3` |
| POST failed / ECONNREFUSED | Start Express server first (`npm run server`) |
| ML API unavailable | Server falls back to threshold scoring — check `python -m src.api` |
| Snowflake insert fails | Verify `.env` and that `RUN_ALL.sql` has been run |
| Invalid timestamp in Snowflake | Serial bridge uses `Date.now()` — ensure you're on the latest script |
| No data in SENSOR_READINGS_CLEAN | Snowflake task runs every 5 min — wait or trigger manually |

---

## Sensor Mapping (ArduinoToJson → Bridge → Snowflake)

The serial bridge maps ArduinoToJson fields to server metrics:

| ArduinoToJson field | Bridge metric | Snowflake column |
|---------------------|---------------|-------------------|
| temp_c | temperature (°F) | temperature_f |
| (none) | humidity 50 | humidity_pct |
| (none) | airQuality 850 | co2_ppm |
| mic_rms | noise (approx dBA) | noise_dba |
| color.c | lighting | light_lux |
| pressure_hPa | pressure | pressure_kpa |
| accel x,y,z | vibration (magnitude) | vibration_ms2 |
