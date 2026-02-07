"""
LSTM Autoencoder for time-series anomaly detection + risk scoring.

The autoencoder learns to reconstruct "normal" sensor windows.
High reconstruction error → anomalous / unsafe conditions.
"""

import numpy as np
import torch
import torch.nn as nn

from src.config import get_threshold_bounds


class Encoder(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
        )

    def forward(self, x):
        # x: (batch, seq_len, input_size)
        _, (hidden, cell) = self.lstm(x)
        # hidden: (num_layers, batch, hidden_size)
        return hidden, cell


class Decoder(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
        )
        self.fc = nn.Linear(hidden_size, input_size)

    def forward(self, x, hidden, cell):
        # x: (batch, seq_len, input_size)
        output, _ = self.lstm(x, (hidden, cell))
        # output: (batch, seq_len, hidden_size)
        return self.fc(output)


class LSTMAutoencoder(nn.Module):
    def __init__(self, n_features, hidden_size=32, num_layers=2):
        super().__init__()
        self.encoder = Encoder(n_features, hidden_size, num_layers)
        self.decoder = Decoder(n_features, hidden_size, num_layers)

    def forward(self, x):
        # Encode
        hidden, cell = self.encoder(x)
        # Decode — feed the original sequence and use encoder state
        reconstructed = self.decoder(x, hidden, cell)
        return reconstructed


def reconstruction_errors(model, data_tensor, device="cpu"):
    """Compute per-window mean squared reconstruction error.

    Args:
        model: trained LSTMAutoencoder
        data_tensor: (N, window_size, n_features) tensor
        device: 'cpu' or 'cuda'

    Returns:
        errors: (N,) numpy array of MSE per window
    """
    model.eval()
    model.to(device)
    with torch.no_grad():
        x = data_tensor.to(device)
        x_hat = model(x)
        # MSE per window: mean over (seq_len, features)
        errors = ((x - x_hat) ** 2).mean(dim=(1, 2)).cpu().numpy()
    return errors


def compute_risk_index(window_errors, anomaly_threshold, raw_window=None,
                       scaler=None, feature_cols=None):
    """Combine anomaly score + threshold violations into a 0-100 risk index.

    Args:
        window_errors: (N,) array of reconstruction errors
        anomaly_threshold: scalar threshold (e.g. 95th percentile)
        raw_window: optional (N, window_size, n_features) raw (unscaled) data
                    for threshold violation counting
        scaler: the StandardScaler used during preprocessing
        feature_cols: list of feature column names

    Returns:
        risk_scores: (N,) array, 0 = safe, 100 = critical
    """
    # Anomaly score: how far above the threshold, clipped to [0, 1]
    anomaly_scores = np.clip(window_errors / anomaly_threshold, 0, 3) / 3.0

    if raw_window is not None and scaler is not None and feature_cols is not None:
        # Count threshold violations in the raw (unscaled) data
        bounds = get_threshold_bounds()
        # Only check the first 4 columns (the raw sensor values)
        raw_cols = ["temperature_c", "humidity_pct", "pressure_hpa", "light_lux"]
        violation_ratios = []
        for i in range(raw_window.shape[0]):
            violations = 0
            checks = 0
            for j, col in enumerate(raw_cols):
                if j >= raw_window.shape[2]:
                    break
                col_idx = feature_cols.index(col) if col in feature_cols else -1
                if col_idx < 0:
                    continue
                values = raw_window[i, :, col_idx]
                lo, hi = bounds.get(col, (None, None))
                if lo is not None:
                    violations += np.sum(values < lo)
                    checks += len(values)
                if hi is not None:
                    violations += np.sum(values > hi)
                    checks += len(values)
            ratio = violations / checks if checks > 0 else 0
            violation_ratios.append(ratio)
        violation_ratios = np.array(violation_ratios)
        risk = 0.6 * anomaly_scores + 0.4 * violation_ratios
    else:
        risk = anomaly_scores

    return np.clip(risk * 100, 0, 100)
