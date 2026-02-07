"""
Load, clean, normalize, and window the four usable datasets into
a unified format for the LSTM autoencoder.

Target schema per row:
    timestamp | temperature_c | humidity_pct | pressure_hpa | light_lux

After windowing the output is numpy arrays of shape:
    (num_windows, WINDOW_SIZE, num_features)
"""

import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from src.config import (
    DATA_DIR, TRAIN_CHANNELS, WINDOW_SIZE, TRAIN_SPLIT, CHANNELS,
    get_threshold_bounds,
)

TARGET_COLS = ["temperature_c", "humidity_pct", "pressure_hpa", "light_lux"]


# ---------------------------------------------------------------------------
# Per-dataset loaders
# ---------------------------------------------------------------------------

def load_sml2010():
    """SML2010 smart-home dataset (2 files, 15-min). Prefers parquet."""
    frames = []
    for fname_base in ["NEW-DATA-1.T15", "NEW-DATA-2.T15"]:
        parquet = os.path.join(DATA_DIR, "sml2010", fname_base + ".parquet")
        if os.path.exists(parquet):
            df = pd.read_parquet(parquet)
        else:
            txt = os.path.join(DATA_DIR, "sml2010", fname_base + ".txt")
            col_names = [
                "Date", "Time",
                "Temperature_Comedor_Sensor", "Temperature_Habitacion_Sensor",
                "Weather_Temperature",
                "CO2_Comedor_Sensor", "CO2_Habitacion_Sensor",
                "Humedad_Comedor_Sensor", "Humedad_Habitacion_Sensor",
                "Lighting_Comedor_Sensor", "Lighting_Habitacion_Sensor",
                "Precipitacion", "Meteo_Exterior_Crepusculo",
                "Meteo_Exterior_Viento",
                "Meteo_Exterior_Sol_Oest", "Meteo_Exterior_Sol_Est",
                "Meteo_Exterior_Sol_Sud", "Meteo_Exterior_Piranometro",
                "Exterior_Entalpic_1", "Exterior_Entalpic_2",
                "Exterior_Entalpic_turbo",
                "Temperature_Exterior_Sensor", "Humedad_Exterior_Sensor",
                "Day_Of_Week",
            ]
            df = pd.read_csv(txt, sep=r"\s+", skiprows=1, header=None,
                             names=col_names)
            df["timestamp"] = pd.to_datetime(
                df["Date"] + " " + df["Time"], format="%d/%m/%Y %H:%M"
            )
        out = pd.DataFrame({
            "timestamp":     df["timestamp"],
            "temperature_c": df["Temperature_Comedor_Sensor"],
            "humidity_pct":  df["Humedad_Comedor_Sensor"],
            "pressure_hpa":  np.nan,
            "light_lux":     df["Lighting_Comedor_Sensor"],
        })
        frames.append(out)
    return pd.concat(frames, ignore_index=True)


def load_air_quality_dataset():
    """Air-Quality-Dataset.csv (irregular intervals). Prefers parquet."""
    parquet = os.path.join(DATA_DIR, "air-quality", "Air-Quality-Dataset.parquet")
    if os.path.exists(parquet):
        df = pd.read_parquet(parquet)
    else:
        csv = os.path.join(DATA_DIR, "air-quality", "Air-Quality-Dataset.csv")
        df = pd.read_csv(csv, sep=";", decimal=",", encoding="utf-8-sig")
        df["timestamp"] = pd.to_datetime(df["TIME"], utc=True)
        df["timestamp"] = df["timestamp"].dt.tz_localize(None)
    out = pd.DataFrame({
        "timestamp":     df["timestamp"],
        "temperature_c": pd.to_numeric(df["TEMPERATURE"], errors="coerce"),
        "humidity_pct":  pd.to_numeric(df["HUMIDITY"], errors="coerce"),
        "pressure_hpa":  np.nan,
        "light_lux":     np.nan,
    })
    # Resample irregular intervals to 15-min
    out = out.set_index("timestamp").resample("15min").mean().reset_index()
    return out


def load_air_quality_uci():
    """AirQualityUCI (hourly, -200 sentinels). Prefers parquet."""
    parquet = os.path.join(DATA_DIR, "air-quality", "AirQualityUCI.parquet")
    if os.path.exists(parquet):
        df = pd.read_parquet(parquet)
    else:
        csv = os.path.join(DATA_DIR, "air-quality", "AirQualityUCI.csv")
        df = pd.read_csv(csv, sep=";", decimal=",", encoding="utf-8-sig")
        df = df.dropna(axis=1, how="all")
        df["timestamp"] = pd.to_datetime(
            df["Date"] + " " + df["Time"], format="%d/%m/%Y %H.%M.%S"
        )
    t = pd.to_numeric(df["T"], errors="coerce")
    rh = pd.to_numeric(df["RH"], errors="coerce")
    t = t.replace(-200, np.nan)
    rh = rh.replace(-200, np.nan)
    out = pd.DataFrame({
        "timestamp":     df["timestamp"],
        "temperature_c": t,
        "humidity_pct":  rh,
        "pressure_hpa":  np.nan,
        "light_lux":     np.nan,
    })
    return out


def load_beijing_pm25():
    """Beijing PM2.5 (hourly, has TEMP + PRES). Prefers parquet."""
    parquet = os.path.join(DATA_DIR, "beijing-pm25",
                           "PRSA_data_2010.1.1-2014.12.31.parquet")
    if os.path.exists(parquet):
        df = pd.read_parquet(parquet)
    else:
        csv = os.path.join(DATA_DIR, "beijing-pm25",
                           "PRSA_data_2010.1.1-2014.12.31.csv")
        df = pd.read_csv(csv)
        df["timestamp"] = pd.to_datetime(df[["year", "month", "day", "hour"]])
    out = pd.DataFrame({
        "timestamp":     df["timestamp"],
        "temperature_c": pd.to_numeric(df["TEMP"], errors="coerce"),
        "humidity_pct":  np.nan,
        "pressure_hpa":  pd.to_numeric(df["PRES"], errors="coerce"),
        "light_lux":     np.nan,
    })
    return out


# ---------------------------------------------------------------------------
# Combine, clean, feature-engineer, window
# ---------------------------------------------------------------------------

def load_all():
    """Load and concatenate all four datasets."""
    print("Loading SML2010...")
    sml = load_sml2010()
    print(f"  {len(sml)} rows")

    print("Loading Air-Quality-Dataset...")
    aq = load_air_quality_dataset()
    print(f"  {len(aq)} rows")

    print("Loading AirQualityUCI...")
    uci = load_air_quality_uci()
    print(f"  {len(uci)} rows")

    print("Loading Beijing PM2.5...")
    bj = load_beijing_pm25()
    print(f"  {len(bj)} rows")

    combined = pd.concat([sml, aq, uci, bj], ignore_index=True)
    combined = combined.sort_values("timestamp").reset_index(drop=True)
    print(f"Combined: {len(combined)} rows")
    return combined


def clean(df):
    """Forward-fill short gaps, drop remaining NaN rows."""
    df = df.set_index("timestamp")
    # Forward fill gaps up to 3 consecutive steps
    df = df.ffill(limit=3)
    df = df.dropna(subset=TARGET_COLS, how="all")
    # For remaining NaNs in individual columns, fill with column median
    for col in TARGET_COLS:
        if df[col].isna().any():
            df[col] = df[col].fillna(df[col].median())
    df = df.reset_index()
    print(f"After cleaning: {len(df)} rows")
    return df


def add_features(df):
    """Add threshold-distance features and time encodings."""
    bounds = get_threshold_bounds()

    # Threshold distance: how far each value is from the safe range,
    # normalized by the range width. 0 = within range, >0 = outside.
    for col in TARGET_COLS:
        lo, hi = bounds.get(col, (None, None))
        if lo is not None and hi is not None:
            width = hi - lo
            df[f"{col}_thresh_dist"] = df[col].apply(
                lambda v: max(0, lo - v, v - hi) / width if width > 0 else 0
            )
        elif lo is not None:
            df[f"{col}_thresh_dist"] = df[col].apply(
                lambda v: max(0, lo - v) / lo if lo > 0 else 0
            )
        elif hi is not None:
            df[f"{col}_thresh_dist"] = df[col].apply(
                lambda v: max(0, v - hi) / hi if hi > 0 else 0
            )
        else:
            df[f"{col}_thresh_dist"] = 0.0

    # Hour-of-day encoding (sin/cos)
    hour = df["timestamp"].dt.hour + df["timestamp"].dt.minute / 60.0
    df["hour_sin"] = np.sin(2 * np.pi * hour / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * hour / 24.0)

    return df


def get_feature_columns():
    """Return the ordered list of feature columns used as model input."""
    feat_cols = list(TARGET_COLS)
    feat_cols += [f"{c}_thresh_dist" for c in TARGET_COLS]
    feat_cols += ["hour_sin", "hour_cos"]
    return feat_cols


def scale_and_window(df):
    """Standard-scale features and create sliding windows.

    Returns:
        X_train, X_val: np arrays of shape (N, WINDOW_SIZE, n_features)
        scaler: fitted StandardScaler (save for inference)
        feature_cols: list of feature column names
    """
    feature_cols = get_feature_columns()
    data = df[feature_cols].values.astype(np.float32)

    # Replace any remaining NaN/inf with 0
    data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)

    # Fit scaler on train portion only
    split_idx = int(len(data) * TRAIN_SPLIT)
    scaler = StandardScaler()
    scaler.fit(data[:split_idx])
    data = scaler.transform(data)

    # Safety check after scaling
    data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)

    # Sliding windows (vectorized with stride_tricks — no Python loop)
    n_windows = len(data) - WINDOW_SIZE + 1
    stride = data.strides  # (row_bytes, col_bytes)
    windows = np.lib.stride_tricks.as_strided(
        data,
        shape=(n_windows, WINDOW_SIZE, data.shape[1]),
        strides=(stride[0], stride[0], stride[1]),
    ).copy().astype(np.float32)

    # Split (respecting time order)
    split_w = int(len(windows) * TRAIN_SPLIT)
    X_train = windows[:split_w]
    X_val = windows[split_w:]

    print(f"Windows: {len(windows)} total, {len(X_train)} train, {len(X_val)} val")
    print(f"Feature dim: {len(feature_cols)} ({feature_cols})")
    return X_train, X_val, scaler, feature_cols


def prepare_data():
    """Full pipeline: load → clean → feature-engineer → scale → window."""
    df = load_all()
    df = clean(df)
    df = add_features(df)
    return scale_and_window(df)
