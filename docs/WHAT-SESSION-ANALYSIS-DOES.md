# What Session Analysis Does - Complete Explanation

## 🎯 Purpose

The Session Analysis feature provides a **comprehensive end-of-session health report** by analyzing **ALL data** stored in the Snowflake database and generating AI-powered health warnings for any safety concerns.

---

## 📊 What It Does (Step by Step)

### Step 1: Query FULL Database
- Connects to Snowflake database
- Queries **ALL sensor readings** ever recorded for the company
- No time limit - analyzes the complete historical dataset
- Retrieves: temperature, humidity, air quality, noise, lighting, pressure

### Step 2: Analyze Every Reading
- Compares each reading against OSHA safety thresholds:
  - **Temperature**: Should be 68-76°F
  - **Humidity**: Should be 20-60% RH
  - **Air Quality**: Should be <1000 ppm CO₂
  - **Noise**: Should be <85 dBA
  - **Lighting**: Should be >300 lux
- Counts how many readings violate each threshold
- Calculates violation rates (e.g., "45% of temperature readings were too high")

### Step 3: Identify Bad Metrics
- Finds metrics where >10% of readings are outside safe ranges
- Calculates average values for each bad metric
- Determines if values are too high or too low
- Assigns severity levels (high/medium) based on violation rates

### Step 4: Generate AI Health Warnings
- For each bad metric, uses **Snowflake Cortex AI** (COMPLETE function)
- AI generates specific health warnings like:
  - **High Temperature**: "High temperatures can lead to heat stress, dehydration, and cardiovascular strain. Prolonged exposure increases risk of heat exhaustion, heat stroke, and can exacerbate existing heart conditions."
  - **Poor Air Quality**: "Elevated CO2 levels can cause headaches, dizziness, fatigue, and reduced cognitive function. Prolonged exposure may lead to respiratory issues and cardiovascular strain."
  - **Excessive Noise**: "Excessive noise exposure can lead to permanent hearing loss, tinnitus, and increased stress levels. It can also cause cardiovascular issues, sleep disturbances, and reduced concentration."

### Step 5: Display Results
- Shows summary: "Analyzed 5,000 readings. Found 2 metric(s) with safety concerns."
- Displays each warning with:
  - Metric name and icon
  - Average value vs. safe threshold
  - Violation percentage
  - Severity badge (high/medium)
  - AI-generated health warning with specific risks

---

## 🔍 Example Output

### Input: Full Database Query
```
Company: Factory ABC
Total Readings: 5,234
Date Range: Jan 1, 2025 - Feb 6, 2025
```

### Analysis Results:
```
✅ Temperature: 72.3°F (Safe: 68-76°F) - 2% violations
✅ Humidity: 48% (Safe: 20-60%) - 1% violations
⚠️ Air Quality: 1,250 ppm (Safe: <1000 ppm) - 35% violations
⚠️ Noise: 88 dBA (Safe: <85 dBA) - 28% violations
✅ Lighting: 420 lux (Safe: >300 lux) - 0% violations
```

### AI-Generated Warnings:

**🔴 High Severity - Air Quality**
> "Elevated CO2 levels can cause headaches, dizziness, fatigue, and reduced cognitive function. Prolonged exposure may lead to respiratory issues and cardiovascular strain. Immediate action: Improve ventilation, check HVAC systems, and consider air quality monitoring."

**🟡 Medium Severity - Noise**
> "Excessive noise exposure can lead to permanent hearing loss, tinnitus, and increased stress levels. It can also cause cardiovascular issues, sleep disturbances, and reduced concentration. Immediate action: Provide hearing protection, reduce noise sources, and implement engineering controls."

---

## 💡 Key Features

1. **Uses FULL Database** - Analyzes all historical data, not just recent readings
2. **AI-Powered** - Uses Snowflake Cortex to generate specific, contextual warnings
3. **Health-Focused** - Explains specific health risks (heart disease, respiratory issues, etc.)
4. **Actionable** - Provides immediate recommendations for each issue
5. **Comprehensive** - Analyzes every reading in the database for complete picture

---

## 🎨 User Interface

- **"Analyze All Data" toggle** - Default ON (analyzes full database)
- **Time period selector** - Optional: analyze last 1h, 6h, 24h, 7 days
- **Color-coded warnings** - Red for high severity, orange for medium
- **Detailed metrics** - Shows exact values, thresholds, and violation rates
- **AI warnings** - Full health risk explanations with recommendations

---

## 🔧 Technical Details

- **Database**: Snowflake `RAW.SENSOR_READINGS_RAW` table
- **AI Model**: Snowflake Cortex COMPLETE (mistral-large2)
- **Analysis**: Compares against OSHA safety thresholds
- **Threshold**: Flags metrics with >10% violation rate
- **Fallback**: Pre-written warnings if Cortex unavailable

---

## 📈 Benefits

1. **Complete Picture** - Uses all data, not just recent samples
2. **Specific Warnings** - AI explains exact health risks
3. **Actionable** - Provides clear recommendations
4. **Comprehensive** - Analyzes entire monitoring history
5. **Professional** - Uses OSHA standards for credibility

---

## 🚀 How to Use

1. Open Dashboard
2. Select a company
3. Scroll to "Session Health Analysis" section
4. Click "Analyze All Data" (default)
5. View AI-generated health warnings
6. Take action based on recommendations

---

**This feature provides a complete end-of-session health analysis using the FULL database to identify safety concerns and generate actionable AI-powered health warnings.**
