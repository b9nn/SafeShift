# Session Analysis with Snowflake Cortex AI

## Overview

At the end of a monitoring session, SafeShift analyzes all sensor data from Snowflake and generates AI-powered health warnings for any metrics that were outside safe ranges. This uses **Snowflake Cortex COMPLETE** to generate specific, actionable health warnings.

---

## How It Works

### 1. **Data Collection**
- Queries Snowflake `RAW.SENSOR_READINGS_RAW` table
- Retrieves all readings for a company from the session period (default: last 24 hours)
- Analyzes up to 1000 most recent readings

### 2. **Bad Score Detection**
- Compares readings against safety thresholds:
  - **Temperature**: 68-76°F (ideal), <65°F or >80°F (unsafe)
  - **Humidity**: 20-60% RH
  - **Air Quality**: <1000 ppm CO₂
  - **Noise**: <85 dBA
  - **Lighting**: >300 lux
- Identifies metrics where >10% of readings violate thresholds
- Calculates average values and violation rates

### 3. **AI Warning Generation**
- For each bad metric, uses **Snowflake Cortex COMPLETE** (mistral-large2) to generate:
  - Specific health risks (e.g., "can lead to heat stroke, cardiovascular strain")
  - Health conditions it can cause (e.g., "heart disease", "respiratory issues")
  - Actionable recommendations
- Falls back to pre-written warnings if Cortex is unavailable

### 4. **Frontend Display**
- Shows warnings in Dashboard with:
  - Metric name and icon
  - Average value vs. safe threshold
  - Violation percentage
  - Severity level (high/medium)
  - AI-generated health warning

---

## API Endpoint

### `GET /api/session-analysis/:companyId`

**Query Parameters:**
- `hours` (optional): Number of hours to analyze (default: 24)

**Response:**
```json
{
  "success": true,
  "companyId": "company-001",
  "analysis": {
    "warnings": [
      {
        "metric": "temperature",
        "metricName": "temperature",
        "value": 82.5,
        "unit": "°F",
        "threshold": "68-76°F",
        "violationRate": "45.2",
        "warning": "High temperatures can lead to heat stress, dehydration, and cardiovascular strain. Prolonged exposure increases risk of heat exhaustion, heat stroke, and can exacerbate existing heart conditions. Immediate action: Ensure adequate ventilation, provide cool rest areas, and implement frequent hydration breaks.",
        "severity": "high"
      }
    ],
    "summary": "Analyzed 500 readings. Found 2 metric(s) with safety concerns.",
    "totalReadings": 500,
    "sessionPeriod": "24 hours"
  },
  "generatedAt": 1234567890
}
```

---

## Frontend Component

### `SessionAnalysis.tsx`

**Features:**
- Time period selector (1h, 6h, 24h, 7 days)
- Auto-refresh button
- Color-coded severity badges
- Expandable warning cards
- Success message when all clear

**Usage:**
```tsx
<SessionAnalysis company={selectedCompany} />
```

---

## Example Warnings

### High Temperature
> "High temperatures can lead to heat stress, dehydration, and cardiovascular strain. Prolonged exposure increases risk of heat exhaustion, heat stroke, and can exacerbate existing heart conditions. Immediate action: Ensure adequate ventilation, provide cool rest areas, and implement frequent hydration breaks."

### Poor Air Quality
> "Elevated CO2 levels can cause headaches, dizziness, fatigue, and reduced cognitive function. Prolonged exposure may lead to respiratory issues and cardiovascular strain. Immediate action: Improve ventilation, check HVAC systems, and consider air quality monitoring."

### Excessive Noise
> "Excessive noise exposure can lead to permanent hearing loss, tinnitus, and increased stress levels. It can also cause cardiovascular issues, sleep disturbances, and reduced concentration. Immediate action: Provide hearing protection, reduce noise sources, and implement engineering controls."

---

## Safety Thresholds

Based on OSHA and international standards (from `config/safety_thresholds.json`):

| Metric | Safe Range | Source |
|--------|------------|--------|
| Temperature | 68-76°F | OSHA Technical Manual |
| Humidity | 20-60% RH | OSHA Technical Manual |
| Air Quality | <1000 ppm CO₂ | OSHA CO2 Monitoring Guidelines |
| Noise | <85 dBA | OSHA 29 CFR 1910.95 |
| Lighting | >300 lux | OSHA 29 CFR 1926.56 |

---

## Fallback Behavior

If Snowflake Cortex is unavailable:
- Uses pre-written warnings based on metric type
- Still provides health information
- Logs warning but doesn't fail

---

## Testing

1. **Send sensor data** with bad values:
   ```bash
   curl -X POST http://localhost:3001/api/sensor-data \
     -H "Content-Type: application/json" \
     -d '{
       "deviceId": "test-device",
       "companyId": "test-company",
       "metrics": {
         "temperature": 85,
         "humidity": 70,
         "airQuality": 1500,
         "noise": 90,
         "lighting": 200
       }
     }'
   ```

2. **Generate analysis**:
   ```bash
   curl http://localhost:3001/api/session-analysis/test-company?hours=24
   ```

3. **View in frontend**:
   - Open Dashboard
   - Select company
   - Scroll to "Session Health Analysis" section
   - Click "Generate Analysis"

---

## Future Enhancements

- [ ] Historical trend analysis
- [ ] Predictive warnings (using Cortex FORECAST)
- [ ] Email/SMS alerts for high-severity warnings
- [ ] Exportable PDF reports
- [ ] Multi-language support (using Cortex TRANSLATE)
