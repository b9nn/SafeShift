#!/usr/bin/env node
/**
 * SafeShift Serial Bridge
 *
 * Reads JSON from Arduino Nano 33 BLE Sense over USB Serial
 * and POSTs to the Express server.
 *
 * Supports ArduinoToJson.ino output format (ts_ms, temp_c, pressure_hPa,
 * accel, color, mic_rms, etc.) and maps it to server metrics.
 *
 * Usage:
 *   node scripts/serial-bridge.js
 *   node scripts/serial-bridge.js COM3          # Windows
 *   node scripts/serial-bridge.js /dev/ttyACM0  # Linux/Mac
 *
 * Env: SERVER_URL (default http://localhost:3001), SERIAL_PORT (auto-detect if not set),
 *      DEVICE_ID (default arduino-001), COMPANY_ID (default company-001)
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fetch = require('node-fetch');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const PORT_OVERRIDE = process.argv[2] || process.env.SERIAL_PORT;
const DEFAULT_DEVICE_ID = process.env.DEVICE_ID || 'arduino-001';
const DEFAULT_COMPANY_ID = process.env.COMPANY_ID || 'company-001';
// Throttle: max 1 request per 2s so ML window isn't filled with identical readings (avoids false high risk)
const THROTTLE_MS = parseInt(process.env.BRIDGE_THROTTLE_MS || '2000', 10);
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

/** Detect ArduinoToJson.ino format (ts_ms, temp_c, pressure_hPa, accel, mic_rms) */
function isArduinoToJsonFormat(p) {
  return p && typeof p.temp_c === 'number' && (p.ts_ms != null || p.accel != null);
}

/**
 * Estimate relative humidity from temperature and pressure (Magnus formula proxy).
 * Without a real humidity sensor we derive a plausible RH that reacts to live
 * temp/pressure changes.  Assumes indoor dew point ~12 °C (typical occupied space).
 */
const ASSUMED_DEW_POINT_C = 12;
function estimateHumidity(temp_c, pressure_hPa) {
  // Magnus constants (Alduchov & Eskridge 1996)
  const a = 17.625, b = 243.04;
  const satVp = 6.1094 * Math.exp((a * temp_c) / (b + temp_c));
  const dewVp = 6.1094 * Math.exp((a * ASSUMED_DEW_POINT_C) / (b + ASSUMED_DEW_POINT_C));
  // Pressure correction: higher pressure slightly raises RH
  const pressureFactor = (pressure_hPa ?? 1013.25) / 1013.25;
  let rh = (dewVp / satVp) * 100 * pressureFactor;
  return Math.round(Math.max(10, Math.min(90, rh)) * 10) / 10;
}

/**
 * Estimate CO2 proxy from mic noise level.
 * More people / machinery → more noise → plausibly higher CO2.
 * Maps mic_rms into a 400–1200 ppm range (outdoor baseline to busy indoor).
 */
function estimateAirQuality(mic_rms) {
  if (mic_rms == null || mic_rms < 0.5) return 450; // quiet room baseline
  // log scale: rms 1→~450, rms 100→~900, rms 1000→~1100
  return Math.round(Math.min(1200, Math.max(400, 450 + Math.log10(mic_rms + 1) * 250)));
}

// Smoothed noise (dBA) so conversation doesn't vanish in one quiet sample
let smoothedNoiseDba = 45;

/**
 * Map mic_rms to dBA with a gradual curve so room conversation shows mid-range (50–65 dBA).
 * - Silence (mic_rms ~200): 45 dBA
 * - Conversation (250–500): linear 48–62 dBA
 * - Louder (500–800): 62–72 dBA
 * - Yelling / close (800+): log scale up to 95 dBA
 */
function micRmsToDba(micRms) {
  const rms = micRms ?? 0;
  const FLOOR = 180;   // below this = silence
  const LOW = 250;     // start of "conversation" range
  const MID = 500;     // end of linear conversation range
  const HIGH = 800;    // start of log "loud" range
  if (rms <= FLOOR) return 45;
  if (rms <= LOW) return 45 + ((rms - FLOOR) / (LOW - FLOOR)) * 5;   // 45 → 50
  if (rms <= MID) return 50 + ((rms - LOW) / (MID - LOW)) * 15;      // 50 → 65
  if (rms <= HIGH) return 65 + ((rms - MID) / (HIGH - MID)) * 10;    // 65 → 75
  const over = Math.max(0, rms - HIGH);
  return Math.min(95, 75 + Math.log10(over + 1) * 12);
}

/** Map ArduinoToJson.ino output to server /api/sensor-data metrics */
function arduinoToJsonToMetrics(p) {
  const tempF = (p.temp_c != null) ? (p.temp_c * 9 / 5 + 32) : 72;
  // LPS22HB BARO.readPressure() returns kPa (~98.7), convert to hPa (*10) for standard use
  const rawPressure = p.pressure_hPa ?? 101.325;
  const pressureHpa = rawPressure < 200 ? rawPressure * 10 : rawPressure; // auto-detect kPa vs hPa
  const ax = p.accel?.x ?? 0, ay = p.accel?.y ?? 0, az = p.accel?.z ?? 0;
  const vibration = Math.sqrt(ax * ax + ay * ay + az * az);
  // APDS9960 clear channel: Arduino now persists last valid reading,
  // but guard for initial -1 before first reading arrives
  const cRaw = typeof p.color?.c === 'number' ? p.color.c : -1;
  const c = cRaw >= 0 ? cRaw : 15000;
  const lightLux = Math.max(0, Math.min(500, Math.round((c / 65535) * 500 * 10) / 10));
  // PDM mic: gradual curve so conversation shows mid-range; smooth so it doesn't snap to silence
  const micRms = p.mic_rms ?? 0;
  const rawDba = micRmsToDba(micRms);
  const SMOOTH_ALPHA = 0.4; // respond in ~2–3 samples, decay slowly when quiet
  smoothedNoiseDba = SMOOTH_ALPHA * rawDba + (1 - SMOOTH_ALPHA) * smoothedNoiseDba;
  const noiseDba = Math.round(smoothedNoiseDba * 10) / 10;
  // LSM9DS1 magnetometer: magnitude in µT (optional for risk)
  const mag_uT = typeof p.mag?.mag_uT === 'number' && !Number.isNaN(p.mag.mag_uT) ? p.mag.mag_uT : null;

  return {
    temperature: tempF,
    humidity: estimateHumidity(p.temp_c ?? 22, pressureHpa),
    airQuality: estimateAirQuality(micRms),
    noise: noiseDba,
    lighting: lightLux,
    pressure: pressureHpa,
    vibration,
    ...(mag_uT != null && { magnetic_uT: Math.round(mag_uT * 10) / 10 }),
  };
}

/** Build request body for POST /api/sensor-data */
function toServerPayload(payload) {
  if (isArduinoToJsonFormat(payload)) {
    return {
      deviceId: DEFAULT_DEVICE_ID,
      companyId: DEFAULT_COMPANY_ID,
      timestamp: Date.now(),
      metrics: arduinoToJsonToMetrics(payload),
    };
  }
  if (payload.metrics && payload.deviceId && payload.companyId) {
    return {
      deviceId: payload.deviceId,
      companyId: payload.companyId,
      timestamp: Date.now(),
      metrics: payload.metrics,
    };
  }
  return null;
}

/** Tolerances for "super similar" (ignore timestep and reprint same risk) */
const SIMILAR_TEMP = 1;       // °F
const SIMILAR_HUMIDITY = 2;
const SIMILAR_NOISE = 2;
const SIMILAR_LIGHTING = 20;
const SIMILAR_PRESSURE = 5;
const SIMILAR_VIBRATION = 0.1;
const SIMILAR_MAGNETIC_UT = 5;

function metricsSimilar(a, b) {
  if (!a || !b) return false;
  const base =
    Math.abs((a.temperature ?? 0) - (b.temperature ?? 0)) <= SIMILAR_TEMP &&
    Math.abs((a.humidity ?? 0) - (b.humidity ?? 0)) <= SIMILAR_HUMIDITY &&
    Math.abs((a.noise ?? 0) - (b.noise ?? 0)) <= SIMILAR_NOISE &&
    Math.abs((a.lighting ?? 0) - (b.lighting ?? 0)) <= SIMILAR_LIGHTING &&
    Math.abs((a.pressure ?? 0) - (b.pressure ?? 0)) <= SIMILAR_PRESSURE &&
    Math.abs((a.vibration ?? 0) - (b.vibration ?? 0)) <= SIMILAR_VIBRATION;
  const magOk =
    (a.magnetic_uT == null && b.magnetic_uT == null) ||
    (a.magnetic_uT != null && b.magnetic_uT != null &&
      Math.abs(a.magnetic_uT - b.magnetic_uT) <= SIMILAR_MAGNETIC_UT);
  return base && magOk;
}

async function listPorts() {
  const ports = await SerialPort.list();
  const uart = ports.find((p) => p.manufacturer?.includes('Arduino') || p.vendorId === '2341' || p.productId?.match(/00(5[3-7]|8[0-4])/));
  return uart?.path || ports[0]?.path;
}

async function main() {
  let portPath = PORT_OVERRIDE;
  if (!portPath) {
    console.log('🔍 Scanning for Arduino...');
    portPath = await listPorts();
    if (!portPath) {
      console.error('❌ No serial port found. Specify: node scripts/serial-bridge.js COM3');
      process.exit(1);
    }
  }

  const port = new SerialPort({
    path: portPath,
    baudRate: 115200,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  port.on('open', () => {
    console.log(`📡 Serial bridge: ${portPath} → ${SERVER_URL}/api/sensor-data`);
  });

  port.on('error', (err) => {
    console.error('Serial error:', err.message);
  });

  let lastSendTime = 0;
  let lastSentMetrics = null;
  let lastPrintedRisk = '?';
  let lastPrintedSafe = '✅';
  let lastPrintedReward = '';

  parser.on('data', async (line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('{') === false) return;
    if (trimmed.includes('"err"') || trimmed.includes('"status"')) {
      console.log('Arduino:', trimmed);
      return;
    }

    let payload;
    try {
      payload = JSON.parse(trimmed);
    } catch (e) {
      return;
    }

    const body = toServerPayload(payload);
    if (!body) return;

    // Throttle: in ArduinoToJson mode we get ~5/sec; sending that many identical readings
    // makes the LSTM think the window is anomalous (static = high reconstruction error)
    if (isArduinoToJsonFormat(payload)) {
      const now = Date.now();
      if (now - lastSendTime < THROTTLE_MS) return;
      lastSendTime = now;

      // If conditions are super similar to last sent, skip POST and reprint same risk
      if (metricsSimilar(body.metrics, lastSentMetrics)) {
        console.log(`${lastPrintedSafe} risk=${lastPrintedRisk} ${lastPrintedReward}`);
        return;
      }
      lastSentMetrics = { ...body.metrics };

      if (DEBUG) {
        console.log('metrics:', JSON.stringify(body.metrics));
      }
    }

    try {
      const res = await fetch(`${SERVER_URL}/api/sensor-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        const risk = data.modelResponse?.riskScore ?? '?';
        const safe = data.modelResponse?.isSafe ? '✅' : '⚠️';
        const reward = data.reward?.sent ? '💰' : '';
        lastPrintedRisk = risk;
        lastPrintedSafe = safe;
        lastPrintedReward = reward;
        console.log(`${safe} risk=${risk} ${reward}`);
      } else {
        console.warn('Server error:', data.error || res.status);
      }
    } catch (err) {
      console.warn('POST failed:', err.message);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
