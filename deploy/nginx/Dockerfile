# syntax=docker/dockerfile:1
# Public edge router: host-based routing to private Railway services.
# See deploy/RAILWAY.md for service naming and env vars.

FROM nginx:1.27-alpine
RUN apk add --no-cache gettext

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint.sh"]
