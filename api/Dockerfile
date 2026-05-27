# syntax=docker/dockerfile:1
# Production-style image: static binary, non-root, minimal runtime.

FROM golang:1.22-bookworm AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/prismapply-api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=builder /out/prismapply-api /prismapply-api
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/prismapply-api"]
