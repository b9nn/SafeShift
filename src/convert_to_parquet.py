"""
Convert the 4 usable CSV datasets to Parquet for faster loading.

Usage:
    python -m src.convert_to_parquet

This reads each raw CSV/TXT, parses it (handling European decimals,
sentinels, etc.), and writes a clean Parquet file next to the original.
After conversion, the training pipeline will auto-detect and load
the Parquet files instead of re-parsing CSVs every time.
"""

import os
import numpy as np
import pandas as pd

from src.config import DATA_DIR


def convert_sml2010():
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
    for fname in ["NEW-DATA-1.T15.txt", "NEW-DATA-2.T15.txt"]:
        path = os.path.join(DATA_DIR, "sml2010", fname)
        df = pd.read_csv(path, sep=r"\s+", skiprows=1, header=None,
                         names=col_names)
        df["timestamp"] = pd.to_datetime(
            df["Date"] + " " + df["Time"], format="%d/%m/%Y %H:%M"
        )
        out_path = path.rsplit(".", 1)[0] + ".parquet"
        df.to_parquet(out_path, index=False)
        print(f"  {path} -> {out_path} ({len(df)} rows)")


def convert_air_quality_dataset():
    path = os.path.join(DATA_DIR, "air-quality", "Air-Quality-Dataset.csv")
    df = pd.read_csv(path, sep=";", decimal=",", encoding="utf-8-sig")
    df["timestamp"] = pd.to_datetime(df["TIME"], utc=True)
    df["timestamp"] = df["timestamp"].dt.tz_localize(None)
    for col in ["TEMPERATURE", "HUMIDITY", "CO2", "PM2,5", "PM10"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    out_path = path.rsplit(".", 1)[0] + ".parquet"
    df.to_parquet(out_path, index=False)
    print(f"  {path} -> {out_path} ({len(df)} rows)")


def convert_air_quality_uci():
    path = os.path.join(DATA_DIR, "air-quality", "AirQualityUCI.csv")
    df = pd.read_csv(path, sep=";", decimal=",", encoding="utf-8-sig")
    df = df.dropna(axis=1, how="all")
    df["timestamp"] = pd.to_datetime(
        df["Date"] + " " + df["Time"], format="%d/%m/%Y %H.%M.%S"
    )
    # Replace -200 sentinels with NaN across all numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].replace(-200, np.nan)
    out_path = path.rsplit(".", 1)[0] + ".parquet"
    df.to_parquet(out_path, index=False)
    print(f"  {path} -> {out_path} ({len(df)} rows)")


def convert_beijing_pm25():
    path = os.path.join(DATA_DIR, "beijing-pm25",
                        "PRSA_data_2010.1.1-2014.12.31.csv")
    df = pd.read_csv(path)
    df["timestamp"] = pd.to_datetime(df[["year", "month", "day", "hour"]])
    out_path = path.rsplit(".", 1)[0] + ".parquet"
    df.to_parquet(out_path, index=False)
    print(f"  {path} -> {out_path} ({len(df)} rows)")


def main():
    print("Converting datasets to Parquet...\n")

    print("SML2010:")
    convert_sml2010()

    print("Air-Quality-Dataset:")
    convert_air_quality_dataset()

    print("AirQualityUCI:")
    convert_air_quality_uci()

    print("Beijing PM2.5:")
    convert_beijing_pm25()

    print("\nDone. The training pipeline will now auto-load Parquet files.")


if __name__ == "__main__":
    main()
