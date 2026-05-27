# syntax=docker/dockerfile:1
# Static marketing site for internal routing via deploy/nginx gateway.

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
ARG PUBLIC_SITE_URL=https://prismapply.com
ARG PUBLIC_APP_URL=https://app.prismapply.com
ARG PUBLIC_POSTHOG_KEY=
ARG PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV PUBLIC_SITE_URL=${PUBLIC_SITE_URL}
ENV PUBLIC_APP_URL=${PUBLIC_APP_URL}
ENV PUBLIC_POSTHOG_KEY=${PUBLIC_POSTHOG_KEY}
ENV PUBLIC_POSTHOG_HOST=${PUBLIC_POSTHOG_HOST}
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache gettext
COPY nginx.default.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint.sh"]
