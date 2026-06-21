"""All ParkPulse API routes."""
from __future__ import annotations

import io
import logging
import random
from datetime import datetime, timezone, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from auth import get_current_user, require_role
from data_store import _coerce_records, recompute_all, state, add_synthetic, load_from_csv
from llm_service import generate_enforcement_narrative
from pipeline import (
    classify_impact, daily_breakdown, enforcement_action, hourly_breakdown,
    predict_horizon, top_breakdown, weekly_breakdown,
)

logger = logging.getLogger("parkpulse.routes")
router = APIRouter(prefix="/api", tags=["parkpulse"])


def _ensure_hotspots(algo: str) -> list[dict]:
    st = state()
    if not st["hotspots"]:
        recompute_all()
    return st["hotspots"].get(algo, [])


# ---------- Health / Meta ----------
@router.get("/")
async def health():
    st = state()
    return {
        "ok": True,
        "service": "ParkPulse AI",
        "loaded_at": st.get("loaded_at"),
        "records": len(st.get("records") or []),
    }


@router.get("/meta/dataset")
async def dataset_meta():
    st = state()
    return {
        "source": st.get("source"),
        "loaded_at": st.get("loaded_at"),
        "summary": st.get("summary", {}),
        "algorithms": list((st.get("hotspots") or {}).keys()),
    }


# ---------- Executive KPI ----------
@router.get("/exec/kpi")
async def exec_kpi():
    st = state()
    recs = st.get("records") or []
    hs = _ensure_hotspots("dbscan")
    critical = [h for h in hs if h["severity"] == "Critical"]
    avg_score = round(float(np.mean([h["score"] for h in hs])), 1) if hs else 0
    avg_cap = round(float(np.mean([h["capacity_loss_pct"] for h in hs])), 1) if hs else 0
    if recs:
        ts_list = [r["ts"] for r in recs]
        date_min, date_max = min(ts_list), max(ts_list)
    else:
        date_min = date_max = None
    return {
        "total_violations": len(recs),
        "active_hotspots": len(hs),
        "critical_zones": len(critical),
        "avg_congestion_score": avg_score,
        "avg_capacity_loss_pct": avg_cap,
        "predicted_hotspots_next_24h": min(len(hs), len([h for h in hs if h["score"] >= 50])),
        "date_min": date_min.isoformat() if date_min else None,
        "date_max": date_max.isoformat() if date_max else None,
    }


# ---------- Hotspots ----------
@router.get("/hotspots")
async def list_hotspots(algorithm: str = Query("dbscan", pattern="^(dbscan|hdbscan|kmeans)$")):
    hs = _ensure_hotspots(algorithm)
    return {"algorithm": algorithm, "count": len(hs), "items": hs}


@router.post("/hotspots/recompute")
async def recompute_hotspots(_: dict = Depends(require_role("admin"))):
    return recompute_all()


@router.get("/heatmap")
async def heatmap(limit: int = Query(20000, le=80000)):
    recs = state().get("records") or []
    if len(recs) > limit:
        idx = np.random.default_rng(42).choice(len(recs), size=limit, replace=False)
        recs = [recs[i] for i in idx]
    return {"points": [{"lat": r["latitude"], "lng": r["longitude"]} for r in recs]}


# ---------- Predictions ----------
@router.get("/predictions")
async def predictions(horizon: str = Query("hour", pattern="^(hour|day|week)$")):
    st = state()
    if not st.get("predictor"):
        recompute_all()
    pred = st.get("predictor")
    now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)  # IST

    def _avg_top(rows, n=10):
        if not rows:
            return 0
        top = rows[:n]
        return float(np.mean([r["expected_intensity"] for r in top]))

    if horizon == "hour":
        target = now + timedelta(hours=1)
        rows = predict_horizon(pred, target)
        series = []
        for i in range(8):
            t = now + timedelta(hours=i)
            series.append({"label": t.strftime("%H:%M"), "intensity": round(_avg_top(predict_horizon(pred, t)), 1)})
        return {"horizon": "hour", "target": target.isoformat(), "rankings": rows[:15], "series": series}
    if horizon == "day":
        series = []
        rows_all = []
        for i in range(7):
            t = now + timedelta(days=i)
            rows = predict_horizon(pred, t.replace(hour=18))
            series.append({"label": t.strftime("%a %d"), "intensity": round(_avg_top(rows), 1)})
            if i == 1:
                rows_all = rows
        return {"horizon": "day", "rankings": rows_all[:15], "series": series}
    # week
    series = []
    rows_all = []
    for i in range(4):
        t = now + timedelta(weeks=i)
        rows = predict_horizon(pred, t.replace(hour=18))
        series.append({"label": f"Week +{i}", "intensity": round(_avg_top(rows), 1)})
        if i == 1:
            rows_all = rows
    return {"horizon": "week", "rankings": rows_all[:15], "series": series}


@router.get("/predictions/feature-importance")
async def feature_importance():
    st = state()
    pred = st.get("predictor")
    if not pred:
        recompute_all()
        pred = state().get("predictor")
    if not pred:
        return {"importance": {}}
    return {"importance": pred["feature_importance"], "threshold": pred["threshold"]}


# ---------- Enforcement ----------
@router.get("/enforcement/queue")
async def enforcement_queue(limit: int = 20):
    hs = _ensure_hotspots("dbscan")[:limit]
    items = []
    for i, h in enumerate(hs):
        rec = enforcement_action(h["score"])
        items.append({
            "rank": i + 1,
            "hotspot_id": h["cluster_id"],
            "lat": h["lat"],
            "lng": h["lng"],
            "score": h["score"],
            "severity": h["severity"],
            "police_station": h["police_station"],
            "junction": h["junction"],
            "violations": h["violations"],
            "capacity_loss_pct": h["capacity_loss_pct"],
            "action": rec["action"],
            "priority": rec["priority"],
            "expected_reduction_pct": rec["expected_reduction_pct"],
            "top_vehicles": h["top_vehicles"],
            "peak_hours": h["peak_hours"],
        })
    return {"items": items}


@router.post("/enforcement/{hotspot_id}/narrative")
async def enforcement_narrative(hotspot_id: int, _: dict = Depends(get_current_user)):
    hs = _ensure_hotspots("dbscan")
    match = next((h for h in hs if h["cluster_id"] == hotspot_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Hotspot not found")
    rec = enforcement_action(match["score"])
    summary = {
        "id": hotspot_id,
        "lat": match["lat"],
        "lng": match["lng"],
        "police_station": match["police_station"],
        "junction": match["junction"],
        "violations": match["violations"],
        "peak_hours": match["peak_hours"],
        "top_vehicles": match["top_vehicles"],
        "capacity_loss_pct": match["capacity_loss_pct"],
    }
    text = await generate_enforcement_narrative(summary, rec["action"], match["score"])
    return {"narrative": text, "action": rec["action"], "score": match["score"],
            "expected_reduction_pct": rec["expected_reduction_pct"]}


# ---------- Analytics ----------
@router.get("/analytics/hourly")
async def analytics_hourly():
    return {"data": hourly_breakdown(state().get("records") or [])}


@router.get("/analytics/daily")
async def analytics_daily():
    return {"data": daily_breakdown(state().get("records") or [])}


@router.get("/analytics/weekly")
async def analytics_weekly():
    return {"data": weekly_breakdown(state().get("records") or [])}


@router.get("/analytics/vehicle")
async def analytics_vehicle():
    return {"data": top_breakdown(state().get("records") or [], "vehicle_type", top=10)}


@router.get("/analytics/police-station")
async def analytics_station():
    return {"data": top_breakdown(state().get("records") or [], "police_station", top=10)}


@router.get("/analytics/junction")
async def analytics_junction():
    return {"data": top_breakdown(state().get("records") or [], "junction_name", top=10)}


# ---------- Data Ingestion (CSV upload, admin only) ----------
@router.post("/data/upload")
async def upload_csv(file: UploadFile = File(...), _: dict = Depends(require_role("admin"))):
    if not file.filename or not file.filename.lower().endswith((".csv", ".tsv")):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content), low_memory=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read CSV: {exc}")
    try:
        recs = _coerce_records(df)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not recs:
        raise HTTPException(status_code=400, detail="No valid rows after coercion.")
    st = state()
    st["records"] = recs
    st["source"] = file.filename
    st["loaded_at"] = datetime.now(timezone.utc).isoformat()
    st["hotspots"] = {}
    st["predictor"] = None
    summary = recompute_all()
    return {"ok": True, "rows": len(recs), "hotspots": summary}


@router.get("/data/schema")
async def data_schema():
    """Return the canonical fields ParkPulse expects."""
    return {
        "required": ["latitude", "longitude", "created_datetime"],
        "optional": ["vehicle_type", "violation_type", "police_station",
                     "junction_name", "location"],
        "detected_source": state().get("source"),
        "sample": (state().get("records") or [])[:1],
    }


# ---------- Simulator ----------
class InjectBody(BaseModel):
    lat: float
    lng: float
    count: int = 20
    vehicle_type: str = "CAR"
    label: Optional[str] = "Manual Injection"


class EventBody(BaseModel):
    event_type: str  # metro | stadium | market
    lat: float
    lng: float
    intensity: int = 200  # number of synthetic violations


@router.post("/simulator/inject")
async def simulator_inject(body: InjectBody, _: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    rng = np.random.default_rng()
    new_recs = []
    for _i in range(int(body.count)):
        new_recs.append({
            "latitude": body.lat + rng.normal(0, 0.0006),
            "longitude": body.lng + rng.normal(0, 0.0006),
            "ts": now - timedelta(minutes=int(rng.integers(0, 1440))),
            "vehicle_type": body.vehicle_type.upper(),
            "violation_types": ["WRONG PARKING"],
            "location": body.label,
            "police_station": "Simulated",
            "junction_name": None,
        })
    add_synthetic(new_recs)
    recompute_all()
    return {"ok": True, "added": len(new_recs), "label": body.label}


@router.post("/simulator/event")
async def simulator_event(body: EventBody, _: dict = Depends(get_current_user)):
    rng = np.random.default_rng()
    now = datetime.now(timezone.utc)
    veh_mix = {
        "metro": ["SCOOTER", "MOTOR CYCLE", "CAR", "PASSENGER AUTO"],
        "stadium": ["CAR", "MAXI-CAB", "PASSENGER AUTO", "SCOOTER"],
        "market": ["GOODS AUTO", "LGV", "MAXI-CAB", "CAR"],
    }.get(body.event_type, ["CAR", "SCOOTER"])
    new_recs = []
    for _i in range(int(body.intensity)):
        new_recs.append({
            "latitude": body.lat + rng.normal(0, 0.0008),
            "longitude": body.lng + rng.normal(0, 0.0008),
            "ts": now - timedelta(minutes=int(rng.integers(0, 240))),
            "vehicle_type": random.choice(veh_mix),
            "violation_types": ["NO PARKING", "WRONG PARKING"],
            "location": f"Simulated {body.event_type}",
            "police_station": "Simulated",
            "junction_name": f"SIM-{body.event_type.upper()}",
        })
    add_synthetic(new_recs)
    recompute_all()
    return {"ok": True, "event": body.event_type, "added": len(new_recs)}


@router.post("/simulator/reset")
async def simulator_reset(_: dict = Depends(require_role("admin"))):
    """Reload original CSV — wipes all synthetic injections."""
    import os
    path = os.environ.get("DATA_CSV_PATH")
    sample = int(os.environ.get("SEED_SAMPLE_SIZE", "60000"))
    if not path:
        raise HTTPException(status_code=400, detail="DATA_CSV_PATH not configured")
    load_from_csv(path, sample)
    recompute_all()
    return {"ok": True, "rows": len(state().get("records") or [])}
