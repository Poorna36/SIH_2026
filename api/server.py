"""
backend/api/server.py
=====================
Main FastAPI application for the Chandrayaan-2 Lunar Image
Correspondence Pipeline (SIH 2026 PS-26166).

Provides CORS-enabled REST API bridge between the Python backend
pipeline and the React/Vite frontend dashboard.

Usage:
    python -m api.server
    # or
    uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Ensure project root is on sys.path ──
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.routes import datasets, config, pipeline, metrics, science  # noqa: E402

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("api.server")

# ── FastAPI Application ──
app = FastAPI(
    title="SIH26166 — Lunar Correspondence Pipeline API",
    description=(
        "REST API bridge for the Chandrayaan-2 multi-sensor lunar image "
        "registration and landing safety verification pipeline. "
        "Serves dataset manifests, pipeline configurations, registration "
        "metrics, and orchestrates pipeline execution."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS Middleware (allow frontend dev servers) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # sih-dashboard (Vite)
        "http://127.0.0.1:5173",
        "http://localhost:3000",   # fallback dev port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Route Modules ──
app.include_router(datasets.router)
app.include_router(config.router)
app.include_router(pipeline.router)
app.include_router(metrics.router)
app.include_router(science.router)


# ── Health Check ──
@app.get("/api/health")
async def health_check():
    """Health check endpoint for frontend connectivity verification."""
    return {
        "status": "online",
        "service": "SIH26166 Lunar Pipeline API",
        "version": "0.1.0",
    }


@app.get("/")
async def root():
    """Root redirect to API docs."""
    return {
        "message": "SIH26166 Lunar Correspondence Pipeline API",
        "docs": "/docs",
        "health": "/api/health",
        "endpoints": {
            "datasets": "/api/datasets/",
            "dataset_stats": "/api/datasets/stats",
            "metrics": "/api/metrics/",
            "pipeline_run": "/api/pipeline/run",
            "pipeline_history": "/api/pipeline/history",
            "config": "/api/config/",
            "config_matchers": "/api/config/matchers",
            "science_slz": "/api/science/slz/{scene_id}",
            "science_spectral": "/api/science/spectral/{scene_id}",
            "science_keypoints": "/api/science/keypoints/{pair_id}",
            "science_craters": "/api/science/craters/",
        },
    }


# ── Direct execution ──
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
