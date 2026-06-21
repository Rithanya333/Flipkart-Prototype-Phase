"""ML & analytics pipeline: clustering, scoring, capacity loss, predictions."""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from typing import Iterable, Optional

import numpy as np

# IST offset for hour-of-day analytics
IST = timezone(timedelta(hours=5, minutes=30))


def _hour_ist(ts) -> int:
    if not ts:
        return 0
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(IST).hour


def _dow_ist(ts) -> int:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(IST).weekday()

# Average lane width in metres; values used in capacity-loss estimation
VEHICLE_FOOTPRINT_M = {
    "SCOOTER": 1.8, "MOPED": 1.6, "MOTOR CYCLE": 2.0,
    "CAR": 4.6, "MAXI-CAB": 4.8, "PASSENGER AUTO": 3.0, "GOODS AUTO": 3.4,
    "LGV": 5.5, "TEMPO": 5.0, "VAN": 5.2, "JEEP": 4.8,
    "BUS (BMTC/KSRTC)": 11.0, "PRIVATE BUS": 11.0, "HGV": 10.0,
    "OTHERS": 4.0, "UNKNOWN": 4.0,
}
LANE_WIDTH_M = 3.5  # typical urban lane width
AVG_PARKING_MINUTES = {
    "SCOOTER": 12, "MOPED": 12, "MOTOR CYCLE": 15,
    "CAR": 35, "MAXI-CAB": 25, "PASSENGER AUTO": 8, "GOODS AUTO": 20,
    "LGV": 45, "TEMPO": 40, "VAN": 30, "JEEP": 30,
    "BUS (BMTC/KSRTC)": 20, "PRIVATE BUS": 30, "HGV": 60,
    "OTHERS": 25, "UNKNOWN": 25,
}


# ---------- Hotspot Clustering ----------
def cluster_dbscan(coords: np.ndarray, eps_m: float = 80.0, min_samples: int = 18) -> np.ndarray:
    """Run DBSCAN with haversine metric. coords shape (N,2) in degrees [lat,lng]."""
    from sklearn.cluster import DBSCAN
    if len(coords) == 0:
        return np.array([])
    rad = np.radians(coords)
    eps = eps_m / 6_371_000.0  # earth radius m → radians
    model = DBSCAN(eps=eps, min_samples=min_samples, algorithm="ball_tree", metric="haversine", n_jobs=-1)
    return model.fit_predict(rad)


def cluster_kmeans(coords: np.ndarray, k: int = 25) -> np.ndarray:
    from sklearn.cluster import MiniBatchKMeans
    if len(coords) == 0:
        return np.array([])
    model = MiniBatchKMeans(n_clusters=k, random_state=42, n_init="auto", batch_size=2048)
    return model.fit_predict(coords)


def cluster_hdbscan(coords: np.ndarray, min_cluster_size: int = 25) -> np.ndarray:
    try:
        import hdbscan
    except Exception:
        return cluster_dbscan(coords)
    if len(coords) == 0:
        return np.array([])
    rad = np.radians(coords)
    model = hdbscan.HDBSCAN(min_cluster_size=min_cluster_size, metric="haversine", core_dist_n_jobs=-1)
    return model.fit_predict(rad)


# ---------- Scoring ----------
def normalize(value: float, vmin: float, vmax: float) -> float:
    if vmax <= vmin:
        return 0.0
    return float(max(0.0, min(1.0, (value - vmin) / (vmax - vmin))))


def congestion_impact_score(
    violation_density: float,
    peak_hour_frequency: float,
    junction_criticality: float,
    repeat_violation_index: float,
) -> float:
    """Spec formula. All inputs are 0..1 normalised."""
    raw = (
        0.4 * violation_density
        + 0.3 * peak_hour_frequency
        + 0.2 * junction_criticality
        + 0.1 * repeat_violation_index
    )
    return round(raw * 100.0, 2)


def classify_impact(score: float) -> str:
    if score >= 70:
        return "Critical"
    if score >= 50:
        return "High"
    if score >= 30:
        return "Moderate"
    return "Low"


def capacity_loss_pct(violations: list[dict], near_junction: bool) -> float:
    """Estimate % road capacity loss for a hotspot at peak hour.

    Approach: estimate concurrent illegally-parked vehicles at the busiest hour,
    convert into blocked lane-metres, and compare against a reference 80m
    single-lane segment. Police challans are known to capture only a fraction
    of actual illegal parking — we apply an empirical capture ratio of 8×.
    """
    if not violations:
        return 0.0
    ts = [v.get("ts") for v in violations if v.get("ts")]
    if not ts:
        return 0.0
    days = max(1.0, (max(ts) - min(ts)).total_seconds() / 86400.0)
    hours = [_hour_ist(t) for t in ts]
    hour_counter = Counter(hours)
    peak_count = hour_counter.most_common(1)[0][1]
    enforcement_capture_ratio = 8.0
    peak_per_day = (peak_count / days) * enforcement_capture_ratio

    total_m_h = 0.0
    for v in violations:
        vt = (v.get("vehicle_type") or "UNKNOWN").upper()
        width = VEHICLE_FOOTPRINT_M.get(vt, VEHICLE_FOOTPRINT_M["UNKNOWN"])
        mins = AVG_PARKING_MINUTES.get(vt, AVG_PARKING_MINUTES["UNKNOWN"])
        total_m_h += width * (mins / 60.0)
    avg_m_h_per_violation = total_m_h / len(violations)

    occupied_lane_metres = peak_per_day * avg_m_h_per_violation
    reference_lane_m = 80.0  # 1 effective lane × 80m segment
    pct = (occupied_lane_metres / reference_lane_m) * 100.0
    if near_junction:
        pct *= 1.4
    return float(min(round(pct, 1), 95.0))


# ---------- Hotspot Aggregation ----------
def build_hotspots(records: list[dict], labels: np.ndarray, *, algo: str) -> list[dict]:
    """Aggregate per-cluster metrics."""
    clusters: dict[int, list[dict]] = defaultdict(list)
    for rec, lab in zip(records, labels.tolist()):
        if lab == -1:
            continue
        clusters[int(lab)].append(rec)

    if not clusters:
        return []

    counts = [len(v) for v in clusters.values()]
    log_max = math.log1p(max(counts))

    hotspots = []
    for cid, recs in clusters.items():
        lats = [r["latitude"] for r in recs]
        lngs = [r["longitude"] for r in recs]
        clat, clng = float(np.mean(lats)), float(np.mean(lngs))

        hours = [_hour_ist(r["ts"]) for r in recs if r.get("ts")]
        hour_counter = Counter(hours)
        peak_hours = [h for h, _ in hour_counter.most_common(3)]
        # peak-hour share: morning + evening rush windows
        peak_share = sum(c for h, c in hour_counter.items() if h in (8, 9, 10, 11, 17, 18, 19, 20, 21)) / max(1, len(hours))

        vehicles = Counter(r.get("vehicle_type", "UNKNOWN") for r in recs)
        top_vehicles = [v for v, _ in vehicles.most_common(4)]

        stations = Counter(r.get("police_station") for r in recs if r.get("police_station"))
        top_station = stations.most_common(1)[0][0] if stations else None

        junctions = Counter(
            r.get("junction_name") for r in recs
            if r.get("junction_name") and r["junction_name"] != "No Junction"
        )
        top_junction = junctions.most_common(1)[0][0] if junctions else None
        junction_share = (junctions.most_common(1)[0][1] / len(recs)) if junctions else 0.0
        near_junction = junction_share >= 0.25  # at least a quarter tied to a real junction

        repeat_idx = (vehicles.most_common(1)[0][1] / len(recs)) if vehicles else 0.0
        # Log-density normalised against the dataset's biggest cluster
        density = math.log1p(len(recs)) / log_max if log_max > 0 else 0.0
        junction_crit = float(min(1.0, junction_share * 1.6 + (0.2 if near_junction else 0.0)))

        score = congestion_impact_score(
            violation_density=density,
            peak_hour_frequency=min(1.0, peak_share),
            junction_criticality=junction_crit,
            repeat_violation_index=min(1.0, repeat_idx),
        )
        cap_loss = capacity_loss_pct(recs, near_junction=near_junction)
        hotspots.append({
            "cluster_id": int(cid),
            "algorithm": algo,
            "lat": clat,
            "lng": clng,
            "violations": len(recs),
            "peak_hours": peak_hours,
            "top_vehicles": top_vehicles,
            "police_station": top_station,
            "junction": top_junction,
            "near_junction": near_junction,
            "repeat_index": round(repeat_idx, 3),
            "score": score,
            "severity": classify_impact(score),
            "capacity_loss_pct": cap_loss,
        })
    hotspots.sort(key=lambda x: x["score"], reverse=True)
    return hotspots


# ---------- Enforcement Rules ----------
def enforcement_action(score: float) -> dict:
    if score >= 90:
        return {"action": "Immediate Tow Deployment", "priority": "P0", "expected_reduction_pct": 35}
    if score >= 75:
        return {"action": "Dedicated Enforcement Patrol", "priority": "P1", "expected_reduction_pct": 25}
    if score >= 60:
        return {"action": "Mobile Monitoring Team", "priority": "P2", "expected_reduction_pct": 15}
    return {"action": "Periodic Monitoring", "priority": "P3", "expected_reduction_pct": 7}


# ---------- Predictive Modelling ----------
def train_predictor(records: list[dict]):
    """Train an XGBoost classifier predicting whether a (hour, dow, station) tuple is a violation-heavy slot."""
    from sklearn.preprocessing import LabelEncoder
    import xgboost as xgb

    if not records:
        return None

    # Aggregate counts per (station, dow, hour) cell (IST)
    cell_counts: dict[tuple, int] = defaultdict(int)
    for r in records:
        ts = r.get("ts")
        if not ts:
            continue
        cell_counts[(r.get("police_station") or "UNKNOWN", _dow_ist(ts), _hour_ist(ts))] += 1

    counts = list(cell_counts.values())
    if not counts:
        return None
    threshold = np.percentile(counts, 75)  # top quartile = "hot"

    stations = sorted({k[0] for k in cell_counts.keys()})
    enc = LabelEncoder().fit(stations)

    X = []
    y = []
    for (station, dow, hour), c in cell_counts.items():
        X.append([enc.transform([station])[0], dow, hour])
        y.append(1 if c >= threshold else 0)
    X = np.array(X, dtype=float)
    y = np.array(y, dtype=int)
    if y.sum() == 0 or y.sum() == len(y):
        return None

    model = xgb.XGBClassifier(
        n_estimators=120, max_depth=4, learning_rate=0.12,
        eval_metric="logloss", verbosity=0,
    )
    model.fit(X, y)
    feature_importance = {
        "station": float(model.feature_importances_[0]),
        "day_of_week": float(model.feature_importances_[1]),
        "hour": float(model.feature_importances_[2]),
    }
    return {"model": model, "encoder": enc, "stations": stations, "threshold": float(threshold),
            "feature_importance": feature_importance}


def predict_horizon(state: dict, when: datetime) -> list[dict]:
    """Return prediction risk per police station for a specific datetime (IST)."""
    if not state:
        return []
    model = state["model"]
    enc = state["encoder"]
    stations = state["stations"]
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    ist_when = when.astimezone(IST)
    dow, hour = ist_when.weekday(), ist_when.hour
    feats = np.array([[enc.transform([s])[0], dow, hour] for s in stations], dtype=float)
    probs = model.predict_proba(feats)[:, 1]
    out = [{"police_station": s, "probability": float(round(p, 3)),
            "expected_intensity": round(float(p) * 100.0, 1)} for s, p in zip(stations, probs)]
    out.sort(key=lambda x: x["probability"], reverse=True)
    return out


# ---------- Analytics helpers ----------
def hourly_breakdown(records: list[dict]) -> list[dict]:
    counts = Counter()
    for r in records:
        if r.get("ts"):
            counts[_hour_ist(r["ts"])] += 1
    return [{"hour": h, "violations": counts.get(h, 0)} for h in range(24)]


def daily_breakdown(records: list[dict]) -> list[dict]:
    names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    counts = Counter()
    for r in records:
        if r.get("ts"):
            counts[_dow_ist(r["ts"])] += 1
    return [{"day": names[i], "violations": counts.get(i, 0)} for i in range(7)]


def weekly_breakdown(records: list[dict]) -> list[dict]:
    counts = Counter()
    for r in records:
        ts = r.get("ts")
        if ts:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            wk = ts.astimezone(IST).isocalendar().week
            counts[wk] += 1
    return [{"week": f"W{w}", "violations": counts[w]} for w in sorted(counts.keys())]


def top_breakdown(records: list[dict], key: str, top: int = 10) -> list[dict]:
    c = Counter(r.get(key) for r in records if r.get(key) and r.get(key) != "No Junction")
    return [{"label": k, "violations": v} for k, v in c.most_common(top)]
