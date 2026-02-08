# Safe Shift — How the Models Work

## Model 1: Environmental Anomaly Detector

**What it is:** An LSTM autoencoder that learns what "normal" factory conditions look like.

**Plain English:** We show the model thousands of examples of normal sensor readings — temperature, humidity, pressure, light — and it learns the patterns. When it sees something that doesn't fit the pattern, it raises a flag.

### How it works

```
Sensor readings → [Encoder] → compressed summary → [Decoder] → reconstructed readings
                                                                      ↓
                                                          Compare with original
                                                                      ↓
                                                          Big difference = anomaly
```

1. The **encoder** reads a 6-hour window of sensor data and compresses it into a small summary
2. The **decoder** tries to reconstruct the original readings from that summary
3. If the reconstruction is close → conditions are normal
4. If the reconstruction is far off → something unusual is happening

### What goes in

A sliding window of 24 timesteps (6 hours at 15-min intervals) with 10 features:

| Feature | Source |
|---|---|
| Temperature (°C) | HTS221 sensor |
| Humidity (%RH) | HTS221 sensor |
| Pressure (hPa) | LPS22HB sensor |
| Ambient light (lux) | APDS-9960 sensor |
| Temp threshold distance | How far from OSHA safe range |
| Humidity threshold distance | How far from OSHA safe range |
| Pressure threshold distance | How far from standard range |
| Light threshold distance | How far from OSHA minimum |
| Hour of day (sin) | Cyclical time encoding |
| Hour of day (cos) | Cyclical time encoding |

### What comes out

A **risk index from 0 to 100**:

- **0–20:** Safe — conditions are normal
- **20–50:** Caution — some readings are drifting or mildly unusual
- **50–80:** Warning — significant anomalies or threshold violations detected
- **80–100:** Critical — dangerous conditions, multiple threshold breaches

The score combines two things:
- **Anomaly score (60%)** — how abnormal the pattern is compared to what the model learned
- **Threshold violations (40%)** — how many readings are outside OSHA/ILO safety limits

### Why not just use thresholds?

Thresholds alone only catch obvious violations (e.g., temperature hits 100°F). The model also catches:

- **Patterns over time** — a factory that runs hot only at 2am (suggesting unusual operational patterns)
- **Correlated anomalies** — noise and humidity spiking together (suggesting a machine running without ventilation)
- **Slow drift** — conditions gradually worsening over weeks without ever crossing a single threshold

### Training data

~57,000 rows from four public datasets, using only columns the Nano 33 BLE Sense can natively measure:

| Dataset | What we use | Rows |
|---|---|---|
| SML2010 | Temperature, humidity, light | 4,137 |
| Air-Quality-Dataset | Temperature, humidity | 6,199 |
| AirQualityUCI | Temperature, humidity | 9,471 |
| Beijing PM2.5 | Temperature, pressure | 43,824 |

### Running it

```bash
# Train the model (saves to models/)
python -m src.train
```

Outputs: `models/anomaly_detector.pt`, `models/scaler.pkl`, `models/threshold.json`

---

## Model 2: Verbal Abuse Detector

**What it is:** A pre-trained BERT model that classifies text for toxic/abusive language.

**Plain English:** Workers can voluntarily submit voice reports. The audio gets transcribed to text, and this model checks if the text contains threats, insults, or other forms of verbal abuse.

### How it works

```
Worker submits voice report
        ↓
Audio transcribed to text (external service)
        ↓
Text → [toxic-bert] → toxicity scores for 6 categories
        ↓
Flagged if any category exceeds threshold
```

### What it detects

| Category | What it means | Flag threshold |
|---|---|---|
| toxic | Generally toxic language | 0.5 |
| severe_toxic | Extremely toxic language | 0.3 |
| obscene | Profane / vulgar language | 0.5 |
| threat | Threatening language | 0.3 |
| insult | Insulting / demeaning language | 0.5 |
| identity_hate | Discriminatory language | 0.3 |

Lower thresholds (0.3) for severe categories mean the system is more sensitive to threats, severe toxicity, and discrimination.

### What comes out

For each text snippet:
- **Scores** — confidence (0 to 1) for each of the 6 categories
- **Flagged categories** — which categories exceeded their threshold
- **Is abusive** — yes/no
- **Severity** — the highest score across all categories (0 to 1)

For a reporting period:
- **Abuse rate** — what percentage of reports were flagged
- **Category breakdown** — which types of abuse are most common
- **Average/max severity** — how bad the flagged incidents are

### Important: this is opt-in

This is **not** passive eavesdropping. The system does not record or transcribe audio during normal operation. Workers choose when to submit a report. The text is analyzed and the results are stored — the raw text is discarded.

### Running it

```bash
# Install dependency
pip install transformers

# Run demo with sample sentences
python -m src.nlp
```

No training needed — the model downloads pre-trained weights from HuggingFace on first run.

---

## How both models feed into the system

```
Arduino Nano 33 BLE Sense
    │
    ├── Passive sensors (temp, humidity, pressure, light, vibration, noise)
    │       ↓
    │   Anomaly Detector → Risk Index (0-100)
    │       ↓
    │   Dashboard + Blockchain reporting
    │
    └── Opt-in voice reports (worker-initiated)
            ↓
        Transcription → Abuse Detector → Abuse flags + severity
            ↓
        Dashboard + Blockchain reporting
```

Both outputs contribute to the factory's overall safety profile, which drives the reward system.
