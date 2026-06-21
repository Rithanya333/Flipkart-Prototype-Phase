"""ParkPulse data store: load CSV, cache aggregations, recompute hotspots.

Held in-memory + persisted in MongoDB collection.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd

from db import db
from pipeline import (
    build_hotspots, cluster_dbscan, cluster_hdbscan, cluster_kmeans,
    train_predictor,
)

logger = logging.getLogger("parkpulse.data")

# In-memory cache; populated on startup. Single-process app so this is fine.
_STATE: dict = {
    "records": [],          # list[dict] - canonical records
    "hotspots": {},         # algo -> list[dict]
    "predictor": None,
    "loaded_at": None,
    "source": None,
    "summary": {},
}


def state() -> dict:
    return _STATE


def _parse_violation_type(raw) -> list[str]:
    if not raw or str(raw).lower() == "nan" or raw == "NULL":
        return []
    if isinstance(raw, list):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return [str(raw)]


def _coerce_records(df: pd.DataFrame) -> list[dict]:
    """Normalize DataFrame into canonical dict list."""
    # Column auto-detect
    lower = {c.lower(): c for c in df.columns}
    col_lat = lower.get("latitude") or lower.get("lat")
    col_lng = lower.get("longitude") or lower.get("lng") or lower.get("lon")
    col_ts = lower.get("created_datetime") or lower.get("timestamp") or lower.get("date")
    col_vt = lower.get("vehicle_type")
    col_vio = lower.get("violation_type")
    col_loc = lower.get("location")
    col_ps = lower.get("police_station")
    col_jn = lower.get("junction_name") or lower.get("junction")

    if not col_lat or not col_lng or not col_ts:
        raise ValueError("Required columns latitude/longitude/timestamp missing.")

    df = df[df[col_lat].notna() & df[col_lng].notna()].copy()
    df[col_lat] = pd.to_numeric(df[col_lat], errors="coerce")
    df[col_lng] = pd.to_numeric(df[col_lng], errors="coerce")
    df = df[df[col_lat].notna() & df[col_lng].notna()]
    df = df[(df[col_lat].between(12.5, 13.5)) & (df[col_lng].between(77.2, 77.9))]

    ts = pd.to_datetime(df[col_ts], errors="coerce", utc=True)
    df = df.assign(_ts=ts)
    df = df[df["_ts"].notna()]

    out = []
    for _, row in df.iterrows():
        out.append({
            "latitude": float(row[col_lat]),
            "longitude": float(row[col_lng]),
            "ts": row["_ts"].to_pydatetime(),
            "vehicle_type": (str(row[col_vt]).upper() if col_vt and pd.notna(row[col_vt]) else "UNKNOWN"),
            "violation_types": _parse_violation_type(row[col_vio]) if col_vio else [],
            "location": (str(row[col_loc]) if col_loc and pd.notna(row[col_loc]) else None),
            "police_station": (str(row[col_ps]) if col_ps and pd.notna(row[col_ps]) else None),
            "junction_name": (str(row[col_jn]) if col_jn and pd.notna(row[col_jn]) else None),
        })
    return out


def _summary(records: list[dict]) -> dict:
    if not records:
        return {"total": 0}
    times = [r["ts"] for r in records]
    veh = {}
    for r in records:
        veh[r["vehicle_type"]] = veh.get(r["vehicle_type"], 0) + 1
    return {
        "total": len(records),
        "date_min": min(times).isoformat(),
        "date_max": max(times).isoformat(),
        "vehicle_types": dict(sorted(veh.items(), key=lambda x: -x[1])[:8]),
    }


def load_from_csv(path: str, sample_size: Optional[int] = None) -> dict:
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    logger.info("Loading CSV %s", path)
    df = pd.read_csv(path, low_memory=False)
    if sample_size and len(df) > sample_size:
        df = df.sample(sample_size, random_state=42).reset_index(drop=True)
    recs = _coerce_records(df)
    _STATE["records"] = recs
    _STATE["source"] = os.path.basename(path)
    _STATE["loaded_at"] = datetime.now(timezone.utc).isoformat()
    _STATE["summary"] = _summary(recs)
    _STATE["hotspots"] = {}
    return _STATE["summary"]


def recompute_all() -> dict:
    recs = _STATE.get("records") or []
    if not recs:
        return {"dbscan": 0, "hdbscan": 0, "kmeans": 0}
    coords = np.array([[r["latitude"], r["longitude"]] for r in recs], dtype=float)
    logger.info("Clustering %d points: DBSCAN", len(coords))
    labels_db = cluster_dbscan(coords)
    logger.info("Clustering %d points: HDBSCAN", len(coords))
    labels_hd = cluster_hdbscan(coords)
    logger.info("Clustering %d points: KMeans", len(coords))
    labels_km = cluster_kmeans(coords, k=min(30, max(8, len(coords) // 2500)))

    _STATE["hotspots"] = {
        "dbscan": build_hotspots(recs, labels_db, algo="dbscan"),
        "hdbscan": build_hotspots(recs, labels_hd, algo="hdbscan"),
        "kmeans": build_hotspots(recs, labels_km, algo="kmeans"),
    }
    logger.info("Training predictor")
    _STATE["predictor"] = train_predictor(recs)
    return {k: len(v) for k, v in _STATE["hotspots"].items()}


def add_synthetic(records: list[dict]) -> None:
    """Append synthetic records (simulator) and force hotspot recompute on next read."""
    _STATE["records"].extend(records)
    _STATE["summary"] = _summary(_STATE["records"])
    _STATE["hotspots"] = {}  # invalidate; client should call recompute
