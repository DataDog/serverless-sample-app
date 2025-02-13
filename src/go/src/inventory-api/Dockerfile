# Dockerfile.production

FROM golang:1.22-alpine as builder

ENV APP_HOME /go/inventory-api

WORKDIR "$APP_HOME"

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o inventory-api

FROM alpine

ENV APP_HOME /go/inventory-api

COPY --from=builder "$APP_HOME" /

EXPOSE 8080
ENTRYPOINT ["./inventory-api"]