#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/logs"

mkdir -p "$LOGS"

load_redis_env() {
  if [[ -f "$ROOT/api/.env" ]]; then
    while IFS= read -r line; do
      [[ "$line" =~ ^REDIS_(ADDR|PASSWORD|URL)= ]] || continue
      export "$line"
    done < <(grep -E '^REDIS_(ADDR|PASSWORD|URL)=' "$ROOT/api/.env" | sed 's/\r$//')
  fi
}

discovery_enabled() {
  local v
  v=$(grep -E '^DISCOVERY_ENABLED=' "$ROOT/api/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' | tr '[:upper:]' '[:lower:]')
  [[ "$v" != "false" && "$v" != "0" ]]
}

start_discovery_loop() {
  if ! discovery_enabled; then
    echo "Job discovery skipped (DISCOVERY_ENABLED=false in api/.env)"
    return 0
  fi

  local interval_hours="${DISCOVERY_INTERVAL_HOURS:-6}"
  echo "Starting job discovery (runs now, then every ${interval_hours}h)..."
  (
    while true; do
      {
        echo "=== discovery run $(date -Iseconds) ==="
        (cd "$ROOT/api" && make run-discover)
      } >> "$LOGS/discover.log" 2>&1 || true
      sleep "$((interval_hours * 3600))"
    done
  ) &
  DISCOVER_PID=$!
}

cleanup() {
  echo "Stopping all services..."
  kill $API_PID $WORKER_PID $JOBWORKER_PID $DISCOVER_PID $FRONTEND_PID $MARKETING_PID 2>/dev/null || true
  wait $API_PID $WORKER_PID $JOBWORKER_PID $DISCOVER_PID $FRONTEND_PID $MARKETING_PID 2>/dev/null || true
  echo "All services stopped."
}
trap cleanup EXIT INT TERM

echo "Starting API..."
(cd "$ROOT/api" && make run) > "$LOGS/api.log" 2>&1 &
API_PID=$!

echo "Starting embed worker..."
(cd "$ROOT/api" && make run-worker) > "$LOGS/worker.log" 2>&1 &
WORKER_PID=$!

load_redis_env
echo "Starting job worker (match + tailor + forward process)..."
(cd "$ROOT/api" && make run-jobworker) > "$LOGS/jobworker.log" 2>&1 &
JOBWORKER_PID=$!

DISCOVER_PID=""

# Brief pause so Redis + job worker are ready before first discovery run enqueues work.
sleep 2
start_discovery_loop

echo "Starting frontend..."
(cd "$ROOT/frontend" && npm run dev) > "$LOGS/frontend.log" 2>&1 &
FRONTEND_PID=$!

echo "Starting marketing site..."
(cd "$ROOT/marketing" && npm run dev) > "$LOGS/marketing.log" 2>&1 &
MARKETING_PID=$!

echo ""
echo "All services started. Logs:"
echo "  API:              tail -f $LOGS/api.log"
echo "  Embed Worker:     tail -f $LOGS/worker.log"
echo "  Job Worker:       tail -f $LOGS/jobworker.log"
echo "  Job Discovery:    tail -f $LOGS/discover.log"
echo "  Frontend:         tail -f $LOGS/frontend.log"
echo "  Marketing:        tail -f $LOGS/marketing.log"
echo ""
echo "Discovery schedule: every ${DISCOVERY_INTERVAL_HOURS:-6}h (set DISCOVERY_INTERVAL_HOURS to change)"
echo "Marketing site:       http://localhost:4321"
echo "App:                  http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services."

wait
