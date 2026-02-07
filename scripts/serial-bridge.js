#!/usr/bin/env node
/**
 * SafeShift Serial Bridge
 *
 * Reads JSON from Arduino Nano 33 BLE Sense over USB Serial
 * and POSTs to the Express server.
 *
 * Usage:
 *   node scripts/serial-bridge.js
 *   node scripts/serial-bridge.js COM3          # Windows
 *   node scripts/serial-bridge.js /dev/ttyACM0  # Linux/Mac
 *
 * Env: SERVER_URL (default http://localhost:3001), SERIAL_PORT (auto-detect if not set)
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fetch = require('node-fetch');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const PORT_OVERRIDE = process.argv[2] || process.env.SERIAL_PORT;

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

    if (!payload.metrics || !payload.deviceId || !payload.companyId) {
      return;
    }

    try {
      const res = await fetch(`${SERVER_URL}/api/sensor-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: payload.deviceId,
          companyId: payload.companyId,
          timestamp: payload.timestamp || Date.now(),
          metrics: payload.metrics,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        const risk = data.modelResponse?.riskScore ?? '?';
        const safe = data.modelResponse?.isSafe ? '✅' : '⚠️';
        const reward = data.reward?.sent ? '💰' : '';
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
