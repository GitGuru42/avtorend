# Production deployment notes (no auth)

This project is packaged as a **single FastAPI service** that serves:
- Frontend (index.html + /js, /styles, /static, /locales)
- API under `/api/*`
- Health check at `/health`

## Environment variables (required)
- `ENVIRONMENT=production`
- `DATABASE_URL=...` (PostgreSQL recommended)

## Environment variables (optional)
- `ALLOWED_ORIGINS=...` comma-separated. For same-domain frontend+API, `*` is acceptable.
- `WEB_CONCURRENCY=2` Gunicorn workers
- `LOG_REQUESTS=true|false`
- `LOG_LEVEL=info|warning|error`

## Run locally (prod mode)
```bash
export ENVIRONMENT=production
export DATABASE_URL=postgresql://...
./start.sh
```

## Docker
```bash
docker build -t avtorend .
docker run -p 8000:8000 \
  -e ENVIRONMENT=production \
  -e DATABASE_URL=postgresql://... \
  avtorend
```

## Render
A `render.yaml` is included. Set `DATABASE_URL` and (optionally) `ALLOWED_ORIGINS` in Render dashboard.
