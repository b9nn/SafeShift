import json
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "data")
CONFIG_DIR = os.path.join(ROOT_DIR, "config")
MODELS_DIR = os.path.join(ROOT_DIR, "models")

# All 6 channels the Nano 33 BLE Sense can provide.
# During training, channels without dataset coverage (vibration, noise) are zeroed.
CHANNELS = [
    "temperature_c",
    "humidity_pct",
    "pressure_hpa",
    "light_lux",
    "vibration_ms2",
    "noise_db",
]

# Channels we actually have training data for
TRAIN_CHANNELS = ["temperature_c", "humidity_pct", "pressure_hpa", "light_lux"]

WINDOW_SIZE = 24          # 24 steps × 15 min = 6 hours
TRAIN_SPLIT = 0.8
BATCH_SIZE = 64
HIDDEN_SIZE = 32
NUM_LAYERS = 2
LEARNING_RATE = 1e-3
EPOCHS = 50
PATIENCE = 5              # early stopping patience
ANOMALY_PERCENTILE = 95   # val reconstruction error percentile for threshold


def load_thresholds():
    """Load OSHA/ILO safety thresholds from config JSON."""
    path = os.path.join(CONFIG_DIR, "safety_thresholds.json")
    with open(path, "r") as f:
        return json.load(f)


def get_threshold_bounds():
    """Return (min, max) bounds per channel for threshold-distance features.

    Temperature thresholds are converted from °F to °C.
    Returns dict mapping channel name -> (lower_bound, upper_bound) or None
    if no threshold applies.
    """
    t = load_thresholds()

    def f_to_c(f):
        return (f - 32) * 5 / 9

    return {
        "temperature_c": (f_to_c(t["temperature"]["recommended_min"]),
                          f_to_c(t["temperature"]["recommended_max"])),
        "humidity_pct":  (t["humidity"]["recommended_min"],
                          t["humidity"]["recommended_max"]),
        "pressure_hpa":  (950.0, 1050.0),   # standard atmospheric range
        "light_lux":     (t["lighting"]["warehouse_min"], None),  # min only
        "vibration_ms2": (None, t["vibration"]["whole_body"]["exposure_limit_8hr"]),
        "noise_db":      (None, t["noise"]["pel_8hr_twa"]),
    }
