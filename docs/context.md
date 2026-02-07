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

Deployed in factories as neutral sensor nodes using the Nano 33 BLE Sense's built-in sensors.

**Built-in sensors used:**

- Temperature & humidity (HTS221)
- Barometric pressure (LPS22HB)
- Ambient light / color (APDS-9960)
- Vibration via accelerometer/gyroscope (LSM9DS1)
- Noise levels via microphone (MP34DT05) — decibel measurement only, no speech recording during passive monitoring

**Opt-in worker reporting (separate from passive monitoring):**

- Workers can voluntarily submit voice reports via the onboard microphone
- Audio is transcribed externally and analyzed by the NLP module for verbal abuse detection
- This is explicitly opt-in — the system does not passively record or transcribe speech

**Explicit exclusions:**

- No cameras
- No biometrics
- No individual tracking
- No passive audio recording or transcription

### 2. Machine Learning Layer

Safe Shift uses two ML components:

**A. Environmental Anomaly Detection (LSTM Autoencoder)**

An LSTM autoencoder trained on public sensor datasets learns what "normal" factory conditions look like. When real sensor readings don't match normal patterns, the reconstruction error is high — indicating something is wrong.

- Input: sliding windows of temperature, humidity, pressure, and light readings
- Output: a **risk index (0–100)** combining anomaly score (60%) with OSHA/ILO threshold violations (40%)
- Trained on ~57,000 rows from four public datasets (SML2010, AirQualityUCI, Air-Quality-Dataset, Beijing PM2.5)
- Thresholds sourced from OSHA and ILO standards (`config/safety_thresholds.json`)

**B. Verbal Abuse Detection (NLP — toxic-bert)**

A pre-trained BERT model (`unitary/toxic-bert`) classifies transcribed text for workplace verbal abuse across six categories: toxic, severe toxic, obscene, threat, insult, and identity hate.

- Input: transcribed text from opt-in worker voice reports
- Output: per-category toxicity scores, flagged categories, severity rating
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

| Component | Status | File(s) |
|---|---|---|
| Safety thresholds (OSHA/ILO) | Done | `config/safety_thresholds.json` |
| Data preprocessing pipeline | Done | `src/preprocess.py`, `src/convert_to_parquet.py` |
| LSTM autoencoder (anomaly detection) | Trained | `src/model.py`, `src/train.py` |
| Model artifacts saved | Done | `models/anomaly_detector.pt`, `models/scaler.pkl`, `models/threshold.json` |
| NLP verbal abuse detector | Built (not yet tested) | `src/nlp.py` |
| Shift length inference | Deferred | Planned as heuristic on live sensor data, not needed until hardware is connected |
| Blockchain (Solana) | Not started | — |
| Dashboard | Not started | — |
| Arduino firmware | Not started | — |

**Next up:** Blockchain integration (Phase 5), Dashboard (Phase 6), or Arduino firmware (Phase 7) — these are independent tracks that can be parallelized across the team.

---

## Project Goals

- Create continuous accountability infrastructure
- Shift labor compliance from punishment to incentives
- Demonstrate real ML on real sensor data
- Provide tamper-resistant reporting
- Remain feasible as a hackathon-scale prototype
