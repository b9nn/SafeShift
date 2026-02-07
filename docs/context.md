# Safe Shift — Project Context

## Overview

Safe Shift is a hardware-first platform designed to monitor factory working conditions — especially in regions where labor standards are difficult to verify — and to incentivize safe, ethical operations rather than punish violations.

The system uses Arduino-based environmental sensors, machine learning on time-series data, and blockchain-backed reporting and rewards to make working conditions measurable, verifiable, and economically rewarding.

> Safe Shift is explicitly **not** worker surveillance. It measures environmental and operational conditions that workers often cannot safely report themselves.

---

## Core Problem

In many factories, especially in developing countries:

- Unsafe conditions are hidden or temporarily fixed during inspections
- Workers face retaliation for reporting issues
- Regulators lack continuous, trustworthy data
- Companies lack incentives to proactively improve conditions

Safe Shift addresses this by creating an **independent, continuous, and incentive-aligned** monitoring system.

---

## System Architecture

### 1. Hardware Layer (Arduino Nano 33 BLE Sense)

Deployed in factories as neutral sensor nodes. All sensors are built into the Nano 33 BLE Sense board.

**Built-in sensors used:**

- Temperature & humidity (HTS221)
- Barometric pressure (LPS22HB)
- Ambient light (APDS-9960)
- Noise levels — decibels only, no audio recording (MP34DT05 microphone)
- Machine vibration / usage patterns (LSM9DS1 accelerometer/gyro)

**Opt-in worker reporting (separate from passive monitoring):**

- Workers can voluntarily submit voice reports via the onboard microphone
- Audio is transcribed externally and analyzed by the NLP module for verbal abuse detection
- This is explicitly opt-in — the system does not passively record or transcribe speech

**Explicit exclusions:**

- No cameras
- No audio recording (mic is used only for dB level calculation during passive monitoring)
- No biometrics
- No individual tracking
- No passive audio recording or transcription
- No CO2/PM2.5/VOC sensors (not available on this board)

### 2. Machine Learning Layer

Safe Shift uses two ML components:

**A. Environmental Anomaly Detection (LSTM Autoencoder)**

An LSTM autoencoder trained on public sensor datasets learns what "normal" factory conditions look like. When real sensor readings don't match normal patterns, the reconstruction error is high — indicating something is wrong.

- LSTM Autoencoder (2-layer, hidden_size=32, window_size=24)
- 10 input features: 4 raw sensors (temp, humidity, pressure, light) + 4 threshold distances + 2 time encodings (sin/cos hour)
- Output: **risk score (0.0–1.0)** combining anomaly score (60%) with OSHA/ILO threshold violations (40%)
- Trained on 4 public datasets (~60k rows): SML2010, AirQualityUCI, Air-Quality-Dataset, Beijing PM2.5
- Vibration + noise channels are zeroed during training, active at inference from real Arduino data
- Self-supervised (reconstruction-based anomaly detection); anomaly threshold at 95th percentile of validation errors
- Thresholds sourced from OSHA, ILO, and EU standards (`config/safety_thresholds.json`)

**B. Verbal Abuse Detection (NLP — toxic-bert)**

A pre-trained BERT model (`unitary/toxic-bert`) classifies transcribed text for workplace verbal abuse across six categories: toxic, severe toxic, obscene, threat, insult, and identity hate.

- Input: transcribed text from opt-in worker voice reports
- Output: per-category toxicity scores, flagged categories, severity rating (threshold 0.25)
- No training required — uses a pre-trained model from HuggingFace

Both models output **risk indicators**, not accusations or individual judgments.

### 3. Data Sources for Training

Because labeled factory abuse data is rare, the anomaly detector trains on public environmental sensor datasets:

- **SML2010** — indoor temperature, humidity, lighting (4,137 rows, 15-min intervals)
- **Air-Quality-Dataset** — indoor temperature, humidity (6,199 rows, ~30s intervals)
- **AirQualityUCI** — temperature, humidity (9,471 rows, hourly)
- **Beijing PM2.5** — temperature, barometric pressure (43,824 rows, hourly)

The NLP model uses a pre-trained model (toxic-bert) and requires no additional training data.

### 4. Incentive & Reward System

Safe Shift includes a positive incentive mechanism. When factories maintain consistently safe conditions:

- Bonuses or rewards are triggered
- Payments can be distributed digitally
- Physical or reputational rewards can also be issued

**Reward forms:**

- Direct deposits / stablecoins
- Physical goods
- Certification or compliance credits
- Insurance or financing benefits
- Preferred supplier status

### 5. Funding Model

Factories alone are unlikely to fund rewards in low-margin or developing regions.

**Realistic funders include:**

- Governments (compliance incentives, tax credits)
- Multinational brands (ethical supply chain verification)
- NGOs and development agencies
- Industry associations or pooled funds

The framing is **value creation through compliance**, not cost imposition.

### 6. Blockchain Integration (Solana)

Blockchain is used selectively and purposefully.

**On-chain data includes:**

- Hashed summaries of condition reports
- Timestamps of alerts or compliance events
- Automated reward payouts

**Blockchain is NOT used for:**

- Raw sensor data
- Personal information

This provides tamper resistance, transparency, and cross-border trust with low latency and cost.

### 7. Reporting & Governance Layer (e.g., Blackboard.io)

A dashboard and governance interface provides:

- Historical condition trends
- Compliance scores
- Audit logs
- Certification indicators

**Designed for:** regulators, auditors, companies, and NGOs. It acts as the human-readable control plane.

---

## Ethical Positioning

Safe Shift is explicitly framed as:

> *"Monitoring conditions workers cannot safely report."*

**Safeguards:**

- No personal data in passive monitoring
- Aggregate analysis only
- Transparent scoring logic
- Opt-in deployment
- Standards-based evaluation
- Voice reporting is opt-in only — workers choose when to submit
- Transcribed text is analyzed and discarded, not stored

Ethics and consent are treated as first-class design constraints.

---

## Current Status (What's Built)

| Component | Status | Notes |
|---|---|---|
| ML Model (LSTM Autoencoder) | Done | 10-feature model, trained on 4 datasets |
| FastAPI Inference Server | Done | `POST /predict` → riskScore 0-1, port 8000 |
| NLP Abuse Detection | Done | toxic-bert, threshold 0.25 |
| Express Server + Solana | Done | Port 3001, calls ML API, sends SOL rewards |
| React Dashboard | Partial | Has wallet connect, needs ML integration |
| Snowflake Data Warehouse | Done | 6 schemas, aligned with Arduino sensors |
| Arduino Hardware | Pending | Nano 33 BLE Sense, sensors ready |

### Arduino Nano 33 BLE Sense — Available Sensors

| Sensor | Chip | Measures |
|---|---|---|
| Temperature / Humidity | HTS221 | °C, %RH |
| Barometric Pressure | LPS22HB | hPa |
| Ambient Light | APDS-9960 | lux |
| Accelerometer / Gyro | LSM9DS1 | vibration proxy (m/s²) |
| Microphone | MP34DT05 | noise proxy (dB) |

**Not on the Arduino:** CO2, PM2.5, VOC sensors. These columns exist in raw tables for dataset storage but are excluded from scoring and ML inference.

### ML Model Contract

The FastAPI server (`src/api.py`) accepts sensor readings and returns:
```json
POST /predict → { "riskScore": "0.0-1.0", "confidence": "0.0-1.0", "timestamp": "ISO" }
```
Risk formula: `risk = 0.6 × anomaly_score + 0.4 × violation_ratio`

### Solana Reward Flow

1. Express server receives sensor data every ~30s
2. Calls ML API `/predict` for risk score
3. If `riskScore < 0.3` → factory is "safe" → sends 0.1-0.2 SOL reward
4. 1-hour cooldown between rewards

### Snowflake Architecture

6 schemas: `RAW` → `STAGING` → `ANALYTICS` → `ML` / `BLOCKCHAIN` / `GOVERNANCE`

Key features:
- Streams + Tasks pipeline (auto-cleans → scores → features → rewards)
- Cortex ML (anomaly detection + forecasting on temperature)
- Cortex LLM (auto-generated compliance reports via mistral-large2)
- Dynamic tables (real-time dashboard, air quality unification)
- RBAC roles, data masking, row access policies
- Blockchain schema tracks Solana tx hashes + hashed compliance reports

Compliance scoring uses 5 Arduino sensors (weights add to ~85 max penalty):
- Temperature: 15 pts (outside 68-76°F)
- Humidity: 10 pts (outside 20-60%)
- Noise: 25 pts (above 85/90 dBA OSHA)
- Light: 15 pts (below 110/300 lux)
- Vibration: 20 pts (above 2.5/5.0 m/s² EU)

---

## What's Next

### Immediate (Hackathon Priority)
1. ~~**Merge branches**~~ — Done (all on `main`)
2. **Arduino firmware** — Write sketch to read all 5 sensors and send JSON over BLE/Serial
3. **End-to-end demo** — Arduino → Express → ML API → Solana reward → Snowflake storage
4. **Dashboard polish** — Wire React frontend to show live risk scores, compliance history, reward payouts

### Nice-to-Have
5. **Snowflake data loading** — Upload training datasets to stages, run COPY INTO
6. **Cortex ML** — Train Snowflake's built-in anomaly detection on loaded data
7. **NLP integration** — Add verbal abuse detection endpoint to Express server

---

## Project Goals

- Create continuous accountability infrastructure
- Shift labor compliance from punishment to incentives
- Demonstrate real ML on real sensor data
- Provide tamper-resistant reporting
- Remain feasible as a hackathon-scale prototype
