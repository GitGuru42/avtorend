"""AvtoRend API (prod-ready)

Key principles applied:
- Fail-fast in production if DATABASE_URL / ALLOWED_ORIGINS are missing.
- No implicit schema creation or data seeding on startup.
- Telegram bot is not started inside the API process by default (run as a separate service/worker).
- Minimal diagnostic endpoints in production.
"""

from __future__ import annotations

import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session


def _env() -> str:
    return os.getenv("ENVIRONMENT", "development").strip().lower()


def _is_production() -> bool:
    return _env() in {"prod", "production"}


# --- Imports (support both `uvicorn api.main:app` and `uvicorn main:app` from /api) ---
try:
    from api import models, schemas
    from api.database import get_db, engine
except Exception:
    # Local execution from the /api directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.append(current_dir)
    import models, schemas  # type: ignore
    from database import get_db, engine  # type: ignore


def _parse_allowed_origins() -> List[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    if not raw:
        if _is_production():
            raise RuntimeError("ALLOWED_ORIGINS is required in production")
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if _is_production():
        # Ensures we don't start with an accidental SQLite fallback.
        if not os.getenv("DATABASE_URL"):
            raise RuntimeError("DATABASE_URL is required in production")

    # Create required runtime directories (uploads).
    os.makedirs("static/uploads/cars", exist_ok=True)
    os.makedirs("static/uploads/temp", exist_ok=True)

    # NOTE: No Base.metadata.create_all() and no seeding here.
    # Use Alembic migrations / explicit admin scripts.
    yield

    # Shutdown
    if engine:
        engine.dispose()


app = FastAPI(
    title="AvtoRend API",
    description="API для аренды автомобилей",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)


# --- CORS ---
allowed_origins = _parse_allowed_origins()

# If credentials are enabled, wildcard origins are invalid per browser CORS rules.
allow_credentials = os.getenv("CORS_ALLOW_CREDENTIALS", "false").strip().lower() in {"1", "true", "yes"}
if allow_credentials and "*" in allowed_origins:
    # Fail-safe: disable credentials rather than crashing at runtime.
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Total-Count"],
    max_age=600,
)

# --- Static files / SPA hosting ---
# The API process may be started with different working directories
# (e.g. `cd api && uvicorn main:app`). Resolve the project root relative
# to this file to reliably serve frontend assets in production.
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIRS = [
    ("/styles", "styles"),
    ("/js", "js"),
    ("/locales", "locales"),
    ("/static", "static"),
    ("/images", "images"),
]

for route, dir_name in STATIC_DIRS:
    dir_path = BASE_DIR / dir_name
    if dir_path.exists():
        app.mount(route, StaticFiles(directory=str(dir_path)), name=dir_name)


# --- Request logging (keep it lightweight; optionally disable in prod) ---
LOG_REQUESTS = os.getenv("LOG_REQUESTS", "true").strip().lower() in {"1", "true", "yes"}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    if not LOG_REQUESTS:
        return await call_next(request)

    start_time = time.time()
    if request.url.path not in {"/health", "/favicon.ico"}:
        print(f"🌐 {request.method} {request.url.path} - start")

    response = await call_next(request)

    process_time = time.time() - start_time
    if request.url.path not in {"/health", "/favicon.ico"}:
        print(f"✅ {request.method} {request.url.path} - {process_time:.3f}s")
    response.headers["X-Process-Time"] = str(process_time)
    return response


# --- Routes ---


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "avtorend-api",
        "environment": _env(),
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/")
async def read_root():
    index_path = BASE_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse(status_code=404, content={"error": "index.html not found"})


@app.get("/sw.js", include_in_schema=False)
async def service_worker():
    sw_path = BASE_DIR / "sw.js"
    if sw_path.exists():
        return FileResponse(str(sw_path), media_type="application/javascript")
    return JSONResponse(status_code=404, content={"error": "sw.js not found"})


if not _is_production():
    @app.get("/api")
    async def api_info():
        return {
            "message": "AvtoRend API работает!",
            "documentation": "/api/docs",
            "health_check": "/health",
            "environment": _env(),
            "endpoints": {
                "cars": "/api/cars",
                "categories": "/api/categories",
                "car_by_id": "/api/cars/{id}",
            },
        }


@app.get("/api/categories", response_model=List[schemas.Category])
def get_categories(db: Session = Depends(get_db)):
    try:
        return db.query(models.Category).filter(models.Category.is_active == True).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения категорий: {str(e)}")


@app.get("/api/cars", response_model=List[schemas.Car])
def get_cars(
    response: Response,
    db: Session = Depends(get_db),
    category_id: Optional[int] = Query(None, description="ID категории"),
    brand: Optional[str] = Query(None, description="Марка автомобиля"),
    min_price: Optional[float] = Query(None, description="Минимальная цена"),
    max_price: Optional[float] = Query(None, description="Максимальная цена"),
    status: Optional[str] = Query(None, description="Статус автомобиля (AVAILABLE/UNAVAILABLE)"),
    limit: int = Query(100, ge=1, le=100, description="Лимит записей"),
    offset: int = Query(0, ge=0, description="Смещение"),
):
    try:
        query = db.query(models.Car).filter(models.Car.is_active == True)

        if category_id:
            query = query.filter(models.Car.category_id == category_id)
        if brand:
            query = query.filter(models.Car.brand.ilike(f"%{brand}%"))
        if min_price is not None:
            query = query.filter(models.Car.daily_price >= min_price)
        if max_price is not None:
            query = query.filter(models.Car.daily_price <= max_price)
        if status:
            status_norm = status.strip().upper()
            allowed = {s.value for s in models.CarStatus}
            if status_norm not in allowed:
                raise HTTPException(
                    status_code=422,
                    detail=f"Неверный статус '{status}'. Допустимые: {', '.join(sorted(allowed))}",
                )
            query = query.filter(models.Car.status == models.CarStatus(status_norm))

        total_count = query.count()
        cars = query.offset(offset).limit(limit).all()
        response.headers["X-Total-Count"] = str(total_count)
        return cars
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения автомобилей: {str(e)}")


@app.get("/api/cars/{car_id}", response_model=schemas.Car)
def get_car(car_id: int, db: Session = Depends(get_db)):
    try:
        car = db.query(models.Car).filter(models.Car.id == car_id).first()
        if not car:
            raise HTTPException(status_code=404, detail="Автомобиль не найден")
        return car
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения автомобиля: {str(e)}")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = BASE_DIR / "static" / "favicon.ico"
    if favicon_path.exists():
        return FileResponse(str(favicon_path))
    return Response(status_code=204)


# --- SPA fallback ---
# If a user refreshes a client-side route (e.g. /cars/12), FastAPI would 404.
# This fallback serves index.html for non-API, non-static routes.
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    # Skip API paths
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"error": "Not Found"})

    # Skip known static mount prefixes
    static_prefixes = ("styles/", "js/", "locales/", "static/", "images/")
    if any(full_path.startswith(p) for p in static_prefixes):
        return JSONResponse(status_code=404, content={"error": "Not Found"})

    index_path = BASE_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse(status_code=404, content={"error": "index.html not found"})


# --- Error handlers ---
from starlette.exceptions import HTTPException as StarletteHTTPException


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail, "path": str(request.url.path)})


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    import traceback

    debug = os.getenv("DEBUG", "false").strip().lower() in {"1", "true", "yes"} and not _is_production()
    details = traceback.format_exc() if debug else None
    return JSONResponse(
        status_code=500,
        content={
            "error": "Внутренняя ошибка сервера",
            "path": str(request.url.path),
            "message": "Произошла внутренняя ошибка. Пожалуйста, попробуйте позже.",
            "details": details,
        },
    )


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host=host, port=port, reload=not _is_production())
