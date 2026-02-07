# Safe Shift — Plan of Action

## Phase 1: Data & Foundation

- [x] Collect public datasets (air quality, industrial safety, indoor env, steel industry)
- [x] Define safety thresholds from OSHA/ILO standards (`config/safety_thresholds.json`)
- [x] Set up Python project (`requirements.txt`, folder structure)
- [x] Normalize usable datasets into shared time-series format (`src/preprocess.py`)

## Phase 2: ML — Anomaly Detection & Scoring

- [x] Engineer features: threshold distances, time-of-day encodings (sin/cos)
- [x] Build LSTM autoencoder for anomaly detection (`src/model.py`)
- [x] Define scoring function: anomaly score + threshold violations → **risk index 0–100**
- [x] Training pipeline with early stopping and threshold calibration (`src/train.py`)
- [x] Run training and validate output
- [ ] Inject synthetic anomalies to verify model flags them

## Phase 3: NLP — Verbal Abuse Detection

- [x] Integrate pre-trained toxic-bert model (`src/nlp.py`)
- [x] Classify transcribed text across 6 toxicity categories
- [x] Aggregate abuse stats for reporting periods
- [ ] Test with sample transcriptions

## Phase 4: Shift Length Inference (Deferred)

Deferred until hardware is connected. Requires live sensor data (light, vibration, noise patterns) to detect factory on/off cycles. Will be heuristic-based, not ML.

- [ ] Use operational signals (noise, vibration, light patterns) to detect shift start/end times
- [ ] Compare inferred shift lengths against ILO limits (8 hr/day, 48 hr/week)
- [ ] Flag factories running suspected excessive shifts

## Phase 5: Blockchain — Reporting & Rewards (Solana)

- [ ] Design on-chain data schema (hashed report summaries, timestamps, scores)
- [ ] Write smart contract: accept risk scores, trigger reward payouts when score stays above threshold
- [ ] Integrate: ML pipeline → hash report → submit to chain
- [ ] Test reward flow end-to-end on devnet

## Phase 6: Dashboard (Blackboard.io)

- [ ] Build frontend showing per-factory risk scores and historical trends
- [ ] Display threshold violations, anomaly alerts, and shift length flags
- [ ] Show blockchain-verified audit log and reward history
- [ ] Add views for different users (regulator, auditor, factory owner)

## Phase 7: Hardware (Arduino Nano 33 BLE Sense)

- [ ] Write firmware to sample built-in sensors (HTS221, LPS22HB, APDS-9960, LSM9DS1, MP34DT05)
- [ ] Transmit readings over BLE to gateway device
- [ ] Connect live sensor stream to ML pipeline for real-time scoring
- [ ] Demo: live sensor → anomaly score → dashboard update

---

## Team Split Suggestion

| Track | Phases | Skills |
|---|---|---|
| **ML / Data** | 1, 2, 3 | Python, pandas, PyTorch/sklearn |
| **Blockchain** | 5 | Rust/Anchor or JS, Solana basics |
| **Frontend** | 6 | React/Next.js or whatever Blackboard uses |
| **Hardware** | 7 | Arduino/C++, basic circuits |

Phases 1–3 are the critical path — everything else plugs into the ML output.
