"""
FastAPI server that wraps the trained LSTM autoencoder for real-time inference.

Josh's Express server calls POST /predict with sensor data.
This returns { riskScore, confidence } in the format his server expects.

Usage:
    python -m src.api
    # or: uvicorn src.api:app --host 0.0.0.0 --port 8000
"""

import json
import os
import time
from collections import deque
from datetime import datetime

import joblib
import numpy as np
import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.config import MODELS_DIR, WINDOW_SIZE, HIDDEN_SIZE, NUM_LAYERS, get_threshold_bounds
from src.model import LSTMAutoencoder, compute_risk_index
from src.preprocess import get_feature_columns

# ---------------------------------------------------------------------------
# Load model artifacts once at startup
# ---------------------------------------------------------------------------

model_path = os.path.join(MODELS_DIR, "anomaly_detector.pt")
scaler_path = os.path.join(MODELS_DIR, "scaler.pkl")
threshold_path = os.path.join(MODELS_DIR, "threshold.json")

with open(threshold_path, "r") as f:
    threshold_data = json.load(f)

n_features = threshold_data["n_features"]
feature_cols = threshold_data["feature_cols"]
anomaly_threshold = threshold_data["anomaly_threshold"]

scaler = joblib.load(scaler_path)

model = LSTMAutoencoder(n_features, HIDDEN_SIZE, NUM_LAYERS)
model.load_state_dict(torch.load(model_path, weights_only=True, map_location="cpu"))
model.eval()

# Sliding window buffer — accumulates readings until we have a full window
reading_buffer = deque(maxlen=WINDOW_SIZE)

# OSHA bounds for threshold violation checking
bounds = get_threshold_bounds()

print(f"ML API ready: {n_features} features, window={WINDOW_SIZE}, threshold={anomaly_threshold:.6f}")

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="SafeShift ML API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SensorData(BaseModel):
    """Input format matching what Josh's server sends."""
    temperature: float = 72.0       # °F from Arduino
    humidity: float = 45.0          # %RH
    airQuality: float = 850.0       # ppm CO2 (not used by model, but accepted)
    noise: float = 75.0             # dBA (not used by model yet)
    lighting: float = 350.0         # lux
    pressure: float = 1013.0        # hPa


class PredictResponse(BaseModel):
    """Output format matching what Josh's server expects."""
    riskScore: str      # "0.2345" — float as string, 0.0-1.0
    confidence: str     # "0.9297" — float as string, 0.0-1.0
    timestamp: int


def sensor_to_feature_row(data: SensorData) -> np.ndarray:
    """Convert a single sensor reading into a feature row matching the model's input.

    The model was trained on 10 features:
        [temp_c, humidity, pressure, light,
         temp_thresh_dist, humidity_thresh_dist, pressure_thresh_dist, light_thresh_dist,
         hour_sin, hour_cos]
    """
    # Convert °F to °C (Josh's server sends °F)
    temp_c = (data.temperature - 32) * 5 / 9
    humidity = data.humidity
    pressure = data.pressure
    light = data.lighting

    # Threshold distance features (same logic as preprocess.py add_features)
    raw_vals = {
        "temperature_c": temp_c,
        "humidity_pct": humidity,
        "pressure_hpa": pressure,
        "light_lux": light,
    }

    thresh_dists = {}
    for col, val in raw_vals.items():
        lo, hi = bounds.get(col, (None, None))
        if lo is not None and hi is not None:
            width = hi - lo
            thresh_dists[col] = max(0, lo - val, val - hi) / width if width > 0 else 0
        elif lo is not None:
            thresh_dists[col] = max(0, lo - val) / lo if lo > 0 else 0
        elif hi is not None:
            thresh_dists[col] = max(0, val - hi) / hi if hi > 0 else 0
        else:
            thresh_dists[col] = 0.0

    # Time encoding
    now = datetime.now()
    hour = now.hour + now.minute / 60.0
    hour_sin = np.sin(2 * np.pi * hour / 24.0)
    hour_cos = np.cos(2 * np.pi * hour / 24.0)

    # Assemble row in same order as training
    row = np.array([
        temp_c, humidity, pressure, light,
        thresh_dists["temperature_c"],
        thresh_dists["humidity_pct"],
        thresh_dists["pressure_hpa"],
        thresh_dists["light_lux"],
        hour_sin, hour_cos,
    ], dtype=np.float32)

    return row


def build_window() -> np.ndarray:
    """Build a (1, WINDOW_SIZE, n_features) tensor from the buffer.

    If buffer has fewer than WINDOW_SIZE readings, pad by repeating
    the most recent reading to fill the window.
    """
    if len(reading_buffer) == 0:
        return None

    rows = list(reading_buffer)

    # Pad if we don't have a full window yet
    while len(rows) < WINDOW_SIZE:
        rows.insert(0, rows[0])  # repeat oldest reading to fill start

    window = np.array(rows, dtype=np.float32)  # (WINDOW_SIZE, n_features)

    # Scale using the same scaler from training
    window_scaled = scaler.transform(window)
    window_scaled = np.nan_to_num(window_scaled, nan=0.0, posinf=0.0, neginf=0.0)

    return window_scaled.reshape(1, WINDOW_SIZE, n_features)


@app.post("/predict", response_model=PredictResponse)
def predict(data: SensorData):
    """Score a sensor reading using the trained LSTM autoencoder.

    Accumulates readings in a sliding window. Once enough readings
    arrive, runs the full model. With fewer readings, pads the window.
    """
    # Convert to feature row and add to buffer
    row = sensor_to_feature_row(data)
    reading_buffer.append(row)

    # Build window
    window_scaled = build_window()

    # Run model
    with torch.no_grad():
        x = torch.tensor(window_scaled, dtype=torch.float32)
        x_hat = model(x)
        error = ((x - x_hat) ** 2).mean().item()

    # Anomaly score from reconstruction error
    anomaly_score = min(error / anomaly_threshold, 3.0) / 3.0

    # Scale anomaly score by buffer fullness — a padded window of identical
    # readings looks "weird" to the model even if values are safe, so we
    # trust the anomaly component more as we accumulate real varied data
    buffer_fullness = len(reading_buffer) / WINDOW_SIZE
    anomaly_score *= buffer_fullness

    # Check threshold violations on raw (unscaled) values
    raw_row = row[:4]  # temp_c, humidity, pressure, light
    violations = 0
    checks = 0
    raw_cols = ["temperature_c", "humidity_pct", "pressure_hpa", "light_lux"]
    for i, col in enumerate(raw_cols):
        lo, hi = bounds.get(col, (None, None))
        if lo is not None:
            violations += 1 if raw_row[i] < lo else 0
            checks += 1
        if hi is not None:
            violations += 1 if raw_row[i] > hi else 0
            checks += 1
    violation_ratio = violations / checks if checks > 0 else 0

    # Combined risk: 0.0-1.0 (matching Josh's expected range)
    risk_score = 0.6 * anomaly_score + 0.4 * violation_ratio
    risk_score = max(0.0, min(1.0, risk_score))

    # Confidence: higher when we have a full window
    confidence = min(1.0, 0.7 + 0.3 * buffer_fullness)  # 0.7-1.0

    return PredictResponse(
        riskScore=f"{risk_score:.4f}",
        confidence=f"{confidence:.4f}",
        timestamp=int(time.time() * 1000),
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "lstm-autoencoder",
        "features": n_features,
        "window_size": WINDOW_SIZE,
        "buffer_size": len(reading_buffer),
        "threshold": anomaly_threshold,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
