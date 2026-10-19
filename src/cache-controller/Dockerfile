FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /out/cache-controller .

FROM alpine:3.21

RUN apk add --no-cache ca-certificates netcat-openbsd

WORKDIR /app
COPY --from=builder /out/cache-controller ./cache-controller

ENV REDIS_ADDR=redis:6379 GRPC_PORT=50051

EXPOSE 50051

ENTRYPOINT ["./cache-controller"]
