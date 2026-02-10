#!/usr/bin/env bash
set -euo pipefail

# Production start script.
# Uses Gunicorn with Uvicorn workers for proper multi-worker handling.

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

# Reasonable default for small instances.
WEB_CONCURRENCY="${WEB_CONCURRENCY:-2}"

exec gunicorn \
  -k uvicorn.workers.UvicornWorker \
  -w "$WEB_CONCURRENCY" \
  -b "$HOST:$PORT" \
  --access-logfile - \
  --error-logfile - \
  --log-level "${LOG_LEVEL:-info}" \
  --timeout "${GUNICORN_TIMEOUT:-60}" \
  api.main:app
