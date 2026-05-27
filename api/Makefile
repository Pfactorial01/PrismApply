.PHONY: build build-worker build-jobworker build-discover run run-worker run-jobworker run-discover test docker-build docker-up install seed-profile regen-seed-json

BINARY := bin/prismapply-api
WORKER_BINARY := bin/prismapply-embed-worker
JOBWORKER_BINARY := bin/prismapply-jobworker
DISCOVER_BINARY := bin/prismapply-discover
CMD := ./cmd/api
WORKER_CMD := ./cmd/worker
JOBWORKER_CMD := ./cmd/jobworker
DISCOVER_CMD := ./cmd/discover

build:
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(BINARY) $(CMD)

build-worker:
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(WORKER_BINARY) $(WORKER_CMD)

build-jobworker:
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(JOBWORKER_BINARY) $(JOBWORKER_CMD)

build-discover:
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(DISCOVER_BINARY) $(DISCOVER_CMD)

run:
	@if [ -f .env ]; then set -a && . ./.env && set +a; fi && go run $(CMD)

run-worker:
	@if [ -f .env ]; then set -a && . ./.env && set +a; fi && go run $(WORKER_CMD)

run-jobworker:
	@if [ -f .env ]; then set -a && . ./.env && set +a; fi && go run $(JOBWORKER_CMD)

run-discover:
	@if [ -f .env ]; then set -a && . ./.env && set +a; fi && go run $(DISCOVER_CMD)

run-worker-dev-redis:
	@if [ ! -f .env ]; then echo "missing .env"; exit 1; fi
	set -a && . ./.env && set +a && \
	export REDIS_ADDR="$${REDIS_ADDR_DEV:-127.0.0.1:16379}" REDIS_PASSWORD= && \
	go run $(WORKER_CMD)

run-dev-redis:
	@if [ ! -f .env ]; then echo "missing .env"; fi
	set -a && . ./.env && set +a && \
	export REDIS_ADDR="$${REDIS_ADDR_DEV:-127.0.0.1:16379}" REDIS_PASSWORD= && \
	go run $(CMD)

seed-profile:
	@if [ -f .env ]; then set -a && . ./.env && set +a; fi && go run ./cmd/seed-profile

regen-seed-json:
	cd ../frontend && npx --yes tsx scripts/export-sample-to-api.ts

test:
	go test ./...

docker-build:
	docker build -t prismapply-api:local .

docker-up:
	docker compose up --build api

install: build
	install -Dm755 $(BINARY) $(DESTDIR)/usr/local/bin/prismapply-api
