"""
Training script for the SafeShift LSTM Autoencoder.

Usage:
    python -m src.train
"""

import json
import os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
import joblib

from src.config import (
    MODELS_DIR, BATCH_SIZE, HIDDEN_SIZE, NUM_LAYERS,
    LEARNING_RATE, EPOCHS, PATIENCE, ANOMALY_PERCENTILE,
)
from src.preprocess import prepare_data
from src.model import LSTMAutoencoder, reconstruction_errors, compute_risk_index


def train():
    os.makedirs(MODELS_DIR, exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")

    # --- Data ---
    print("\n=== Preparing data ===")
    X_train, X_val, scaler, feature_cols = prepare_data()
    n_features = X_train.shape[2]

    train_tensor = torch.tensor(X_train, dtype=torch.float32)
    val_tensor = torch.tensor(X_val, dtype=torch.float32)

    train_loader = DataLoader(
        TensorDataset(train_tensor, train_tensor),
        batch_size=BATCH_SIZE, shuffle=True,
    )
    val_loader = DataLoader(
        TensorDataset(val_tensor, val_tensor),
        batch_size=BATCH_SIZE, shuffle=False,
    )

    # --- Model ---
    model = LSTMAutoencoder(n_features, HIDDEN_SIZE, NUM_LAYERS).to(device)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)

    print(f"\nModel: {sum(p.numel() for p in model.parameters())} parameters")
    print(f"Input features: {n_features} ({feature_cols})")

    # --- Training loop ---
    print("\n=== Training ===")
    best_val_loss = float("inf")
    patience_counter = 0

    for epoch in range(1, EPOCHS + 1):
        # Train
        model.train()
        train_loss = 0
        for batch_x, batch_y in train_loader:
            batch_x = batch_x.to(device)
            optimizer.zero_grad()
            output = model(batch_x)
            loss = criterion(output, batch_x)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * batch_x.size(0)
        train_loss /= len(train_loader.dataset)

        # Validate
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                batch_x = batch_x.to(device)
                output = model(batch_x)
                loss = criterion(output, batch_x)
                val_loss += loss.item() * batch_x.size(0)
        val_loss /= len(val_loader.dataset)

        print(f"Epoch {epoch:3d}/{EPOCHS}  train_loss={train_loss:.6f}  val_loss={val_loss:.6f}")

        # Early stopping
        if not np.isnan(val_loss) and val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            torch.save(model.state_dict(), os.path.join(MODELS_DIR, "anomaly_detector.pt"))
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                print(f"Early stopping at epoch {epoch} (patience={PATIENCE})")
                break

    # --- Load best model (if saved) ---
    model_path = os.path.join(MODELS_DIR, "anomaly_detector.pt")
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, weights_only=True))
    else:
        # No improvement was ever saved — save current model
        torch.save(model.state_dict(), model_path)

    # --- Calibrate anomaly threshold ---
    print("\n=== Calibrating anomaly threshold ===")
    val_errors = reconstruction_errors(model, val_tensor, device)
    threshold = float(np.percentile(val_errors, ANOMALY_PERCENTILE))
    print(f"Anomaly threshold ({ANOMALY_PERCENTILE}th percentile): {threshold:.6f}")
    print(f"Val error range: [{val_errors.min():.6f}, {val_errors.max():.6f}]")

    # --- Demo risk scores on validation set ---
    risk_scores = compute_risk_index(val_errors, threshold)
    print(f"\nRisk index stats on validation set:")
    print(f"  Mean:   {risk_scores.mean():.1f}")
    print(f"  Median: {np.median(risk_scores):.1f}")
    print(f"  Max:    {risk_scores.max():.1f}")
    print(f"  >50:    {(risk_scores > 50).sum()} / {len(risk_scores)} windows")

    # --- Save artifacts ---
    print("\n=== Saving artifacts ===")
    joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.pkl"))
    print(f"  Saved scaler → models/scaler.pkl")

    threshold_data = {
        "anomaly_threshold": threshold,
        "percentile": ANOMALY_PERCENTILE,
        "val_error_min": float(val_errors.min()),
        "val_error_max": float(val_errors.max()),
        "val_error_mean": float(val_errors.mean()),
        "n_features": n_features,
        "feature_cols": feature_cols,
    }
    with open(os.path.join(MODELS_DIR, "threshold.json"), "w") as f:
        json.dump(threshold_data, f, indent=2)
    print(f"  Saved threshold → models/threshold.json")
    print(f"  Model already saved → models/anomaly_detector.pt")

    print("\nDone.")


if __name__ == "__main__":
    train()
