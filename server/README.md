# SafeShift Backend Server

## Overview

The SafeShift backend server receives sensor data from Arduino devices, queries the ML model for risk assessment, and automatically distributes Solana rewards to companies when safety conditions are met.

## Architecture

```
Arduino Device → POST /api/sensor-data → ML Model API → Risk Score Check → Solana Reward
```

## API Endpoints

### POST /api/sensor-data
Receives sensor data from Arduino devices.

**Request Body:**
```json
{
  "deviceId": "device-001",
  "companyId": "company-001",
  "timestamp": 1234567890,
  "metrics": {
    "temperature": 72.5,
    "humidity": 45.0,
    "airQuality": 850,
    "noise": 75,
    "lighting": 350,
    "pressure": 101.3
  }
}
```

**Response:**
```json
{
  "success": true,
  "deviceId": "device-001",
  "companyId": "company-001",
  "modelResponse": {
    "riskScore": "0.2345",
    "confidence": "0.9297",
    "isSafe": true
  },
  "reward": {
    "sent": true,
    "amount": 0.1655,
    "transactionSignature": "5KJvsngHeM..."
  }
}
```

### POST /api/register-company
Register a new company (called from frontend).

**Request Body:**
```json
{
  "companyId": "company-001",
  "name": "Factory ABC",
  "walletAddress": "376uy5oJLDSAb6EqjaZrAtsumHBQyTVoPk6AANpvAqqF",
  "deviceIds": ["device-001", "device-002"]
}
```

### GET /api/companies
Get all registered companies.

### GET /api/rewards
Get reward history.

### GET /api/health
Health check endpoint.

## ML Model Integration

Currently uses a **fake/hardcoded ML model** that simulates risk scoring. 

**Risk Score Threshold:**
- `< 0.3` = Safe → Reward sent
- `>= 0.3` = Unsafe → No reward

**To integrate real ML model:**
1. Update `queryMLModel()` function in `server/index.js`
2. Replace fake logic with actual API call to your teammate's ML service
3. Ensure response format matches: `{ riskScore: number, confidence: number }`

## Reward Logic

1. **Sensor data received** → Store latest readings
2. **Query ML model** → Get risk score
3. **Check threshold** → If riskScore < 0.3, proceed
4. **Check cooldown** → Must be > 1 hour since last reward
5. **Calculate reward** → 0.1 to 0.2 SOL based on risk score
6. **Send Solana transaction** → Transfer SOL to company wallet
7. **Record transaction** → Store in reward history

## Running the Server

```bash
# Install dependencies (if not already installed)
npm install

# Start server
node server/index.js

# Server runs on http://localhost:3001
```

## Environment Variables

Create `.env` file:
```env
PORT=3001
SOLANA_NETWORK=devnet
```

## Arduino Integration

Arduino devices should POST sensor data every second to:
```
POST http://your-server:3001/api/sensor-data
```

Example Arduino code structure:
```cpp
void loop() {
  // Read sensors
  float temp = readTemperature();
  float humidity = readHumidity();
  int airQuality = readAirQuality();
  int noise = readNoise();
  int lighting = readLighting();
  
  // Send to server
  httpPost("/api/sensor-data", {
    deviceId: "device-001",
    companyId: "company-001",
    metrics: { temp, humidity, airQuality, noise, lighting }
  });
  
  delay(1000); // 1 second
}
```

## Production Considerations

- Replace in-memory storage with database (PostgreSQL, MongoDB)
- Add authentication for API endpoints
- Implement rate limiting
- Add request validation
- Set up proper error handling and logging
- Use environment variables for sensitive config
- Add monitoring and alerting
