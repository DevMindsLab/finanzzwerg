import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import budgets, categories, dashboard, imports, presets, rules, transactions
from app.config import settings
from app.core.seeder import seed_default_categories

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Financeless API...")
    seed_default_categories()
    yield
    logger.info("Shutting down Financeless API.")


app = FastAPI(
    title="Financeless API",
    description="Self-hosted personal finance management — privacy-first.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(transactions.router, prefix=f"{PREFIX}/transactions", tags=["transactions"])
app.include_router(categories.router,   prefix=f"{PREFIX}/categories",   tags=["categories"])
app.include_router(rules.router,        prefix=f"{PREFIX}/rules",        tags=["rules"])
app.include_router(imports.router,      prefix=f"{PREFIX}/imports",      tags=["imports"])
app.include_router(presets.router,      prefix=f"{PREFIX}/presets",      tags=["presets"])
app.include_router(budgets.router,      prefix=f"{PREFIX}/budgets",      tags=["budgets"])
app.include_router(dashboard.router,    prefix=f"{PREFIX}/dashboard",    tags=["dashboard"])


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}
