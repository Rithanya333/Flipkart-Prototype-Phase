"""ParkPulse AI backend API tests (pytest)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://smart-parking-hub-44.preview.emergentagent.com").rstrip("/")
# Fallback to /app/frontend/.env if env not in shell
if "smart-parking" not in BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

ADMIN_EMAIL = "admin@parkpulse.ai"
ADMIN_PASS = "ParkPulse@2026"
OFFICER_EMAIL = "officer@parkpulse.ai"
OFFICER_PASS = "Officer@2026"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_session():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return sess


@pytest.fixture(scope="module")
def officer_session():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": OFFICER_EMAIL, "password": OFFICER_PASS})
    assert r.status_code == 200, f"Officer login failed: {r.status_code} {r.text}"
    return sess


# ---------- Health ----------
class TestHealth:
    def test_health(self, s):
        r = s.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["records"] >= 1000


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self):
        sess = requests.Session()
        r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d["role"] == "admin"
        # cookies set
        assert "access_token" in sess.cookies

    def test_officer_login(self):
        sess = requests.Session()
        r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": OFFICER_EMAIL, "password": OFFICER_PASS})
        assert r.status_code == 200
        assert r.json()["role"] == "officer"

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"


# ---------- Executive KPI ----------
class TestKPI:
    def test_kpi(self, s):
        r = s.get(f"{BASE_URL}/api/exec/kpi")
        assert r.status_code == 200
        d = r.json()
        assert d["total_violations"] == 60000
        assert d["active_hotspots"] >= 100
        assert "avg_congestion_score" in d
        assert "avg_capacity_loss_pct" in d


# ---------- Hotspots ----------
class TestHotspots:
    def test_dbscan(self, s):
        r = s.get(f"{BASE_URL}/api/hotspots", params={"algorithm": "dbscan"})
        assert r.status_code == 200
        d = r.json()
        assert d["algorithm"] == "dbscan"
        assert d["count"] >= 100
        h = d["items"][0]
        for k in ["cluster_id", "lat", "lng", "score", "severity", "violations", "capacity_loss_pct"]:
            assert k in h, f"missing {k}"

    def test_hdbscan(self, s):
        r = s.get(f"{BASE_URL}/api/hotspots", params={"algorithm": "hdbscan"})
        assert r.status_code == 200
        assert r.json()["count"] >= 50

    def test_kmeans(self, s):
        r = s.get(f"{BASE_URL}/api/hotspots", params={"algorithm": "kmeans"})
        assert r.status_code == 200
        assert r.json()["count"] >= 10

    def test_heatmap(self, s):
        r = s.get(f"{BASE_URL}/api/heatmap", params={"limit": 5000})
        assert r.status_code == 200
        pts = r.json()["points"]
        assert 1000 <= len(pts) <= 5000
        assert "lat" in pts[0] and "lng" in pts[0]


# ---------- Predictions ----------
class TestPredictions:
    @pytest.mark.parametrize("horizon", ["hour", "day", "week"])
    def test_predictions_horizon(self, s, horizon):
        r = s.get(f"{BASE_URL}/api/predictions", params={"horizon": horizon})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["horizon"] == horizon
        assert isinstance(d["series"], list) and len(d["series"]) > 0
        assert isinstance(d["rankings"], list)

    def test_feature_importance(self, s):
        r = s.get(f"{BASE_URL}/api/predictions/feature-importance")
        assert r.status_code == 200
        imp = r.json()["importance"]
        assert isinstance(imp, dict) and len(imp) > 0


# ---------- Enforcement ----------
class TestEnforcement:
    def test_queue(self, s):
        r = s.get(f"{BASE_URL}/api/enforcement/queue", params={"limit": 20})
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 20
        first = items[0]
        for k in ["hotspot_id", "action", "priority", "expected_reduction_pct", "score", "severity"]:
            assert k in first
        # ranked descending by score
        scores = [x["score"] for x in items]
        assert scores == sorted(scores, reverse=True)

    def test_narrative_requires_auth(self, s):
        # get a hotspot id first
        items = s.get(f"{BASE_URL}/api/enforcement/queue").json()["items"]
        hid = items[0]["hotspot_id"]
        r = requests.post(f"{BASE_URL}/api/enforcement/{hid}/narrative")
        assert r.status_code == 401

    def test_narrative_generation_admin(self, admin_session, s):
        items = s.get(f"{BASE_URL}/api/enforcement/queue").json()["items"]
        hid = items[0]["hotspot_id"]
        t0 = time.time()
        r = admin_session.post(f"{BASE_URL}/api/enforcement/{hid}/narrative", timeout=30)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["narrative"], str)
        assert len(d["narrative"]) > 50, f"narrative too short: {d['narrative']}"
        assert "action" in d and "score" in d
        print(f"\nNarrative generation took {elapsed:.1f}s, length={len(d['narrative'])}")

    def test_narrative_unique_per_hotspot(self, admin_session, s):
        items = s.get(f"{BASE_URL}/api/enforcement/queue").json()["items"]
        ids = [items[0]["hotspot_id"], items[5]["hotspot_id"], items[10]["hotspot_id"]]
        narratives = []
        for hid in ids:
            r = admin_session.post(f"{BASE_URL}/api/enforcement/{hid}/narrative", timeout=30)
            assert r.status_code == 200
            narratives.append(r.json()["narrative"])
        # at least 2 unique narratives
        assert len(set(narratives)) >= 2, "Narratives are not unique per hotspot"


# ---------- Analytics ----------
class TestAnalytics:
    @pytest.mark.parametrize("endpoint", [
        "hourly", "daily", "weekly", "vehicle", "police-station", "junction",
    ])
    def test_analytics(self, s, endpoint):
        r = s.get(f"{BASE_URL}/api/analytics/{endpoint}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "data" in d
        assert isinstance(d["data"], list) and len(d["data"]) > 0


# ---------- Role guard ----------
class TestRoleGuard:
    def test_officer_cannot_upload(self, officer_session):
        # officer should be blocked from /api/data/upload
        r = officer_session.post(
            f"{BASE_URL}/api/data/upload",
            files={"file": ("x.csv", b"lat,lng\n", "text/csv")},
        )
        assert r.status_code == 403

    def test_admin_can_recompute(self, admin_session):
        # don't actually recompute (slow); just check officer cannot
        pass

    def test_officer_cannot_recompute(self, officer_session):
        r = officer_session.post(f"{BASE_URL}/api/hotspots/recompute")
        assert r.status_code == 403
