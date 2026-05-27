#!/usr/bin/env sh
# Thin wrapper: run the production-style container via Compose.
set -e
cd "$(dirname "$0")"
exec docker compose up --build api
