#!/bin/sh
set -eu

# Defaults match Railway private DNS when services are named api, frontend, marketing.
: "${PORT:=8080}"
: "${APP_HOST:=app.prismapply.com}"
: "${MARKETING_HOST:=prismapply.com}"
: "${API_HOST:=api.railway.internal}"
: "${API_PORT:=8080}"
: "${FRONTEND_HOST:=frontend.railway.internal}"
: "${FRONTEND_PORT:=8080}"
: "${MARKETING_UPSTREAM_HOST:=marketing.railway.internal}"
: "${MARKETING_UPSTREAM_PORT:=8080}"

# Railway reference vars can arrive empty before upstream services deploy — keep sane fallbacks.
[ -z "$API_PORT" ] && API_PORT=8080
[ -z "$FRONTEND_HOST" ] && FRONTEND_HOST=frontend.railway.internal
[ -z "$FRONTEND_PORT" ] && FRONTEND_PORT=8080
[ -z "$MARKETING_UPSTREAM_PORT" ] && MARKETING_UPSTREAM_PORT=8080

export PORT APP_HOST MARKETING_HOST API_HOST API_PORT FRONTEND_HOST FRONTEND_PORT MARKETING_UPSTREAM_HOST MARKETING_UPSTREAM_PORT

envsubst '${PORT} ${APP_HOST} ${MARKETING_HOST} ${API_HOST} ${API_PORT} ${FRONTEND_HOST} ${FRONTEND_PORT} ${MARKETING_UPSTREAM_HOST} ${MARKETING_UPSTREAM_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
