"""ParkPulse AI – FastAPI server entrypoint."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import asyncio  # noqa: E402
import logging  # noqa: E402
import os  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from auth import ensure_indexes, router as auth_router, seed_admin_and_officer  # noqa: E402
from data_store import load_from_csv, recompute_all, state  # noqa: E402
from routes import router as api_router  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("parkpulse.server")

app = FastAPI(title="ParkPulse AI", version="1.0")

# CORS – allow frontend + cookies. With credentials, wildcard origin is rejected.
_origins_env = os.environ.get("CORS_ORIGINS", "*")
if _origins_env.strip() in ("*", ""):
    origins = ["*"]
    creds = False  # browser rule: cannot mix * with allow_credentials
else:
    origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    creds = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(api_router)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await seed_admin_and_officer()
    logger.info("Auth ready")

    csv_path = os.environ.get("DATA_CSV_PATH")
    sample = int(os.environ.get("SEED_SAMPLE_SIZE", "60000") or 60000)
    if csv_path and os.path.exists(csv_path):
        # Heavy I/O: run in a worker thread so startup doesn't block the loop.
        await asyncio.to_thread(load_from_csv, csv_path, sample)
        await asyncio.to_thread(recompute_all)
        st = state()
        logger.info("Dataset ready: %d records, hotspots=%s",
                    len(st.get("records") or []),
                    {k: len(v) for k, v in (st.get("hotspots") or {}).items()})
    else:
        logger.warning("DATA_CSV_PATH missing or file not found; awaiting upload.")


@app.get("/")
async def root():
    return {"service": "ParkPulse AI", "status": "ok"}
