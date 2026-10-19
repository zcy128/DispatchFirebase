# Build stage
FROM golang:alpine AS builder

WORKDIR /app

# Install ca-certificates and git
RUN apk add --no-cache ca-certificates git

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /app/dispatch-server ./cmd/server

# Final lightweight runtime image
FROM alpine:3.20

WORKDIR /app

# Copy root SSL certificates
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy compiled binary
COPY --from=builder /app/dispatch-server /app/dispatch-server

# Default port for Cloud Run
ENV PORT=8080
ENV ENV=production

EXPOSE 8080

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENTRYPOINT ["/app/dispatch-server"]
