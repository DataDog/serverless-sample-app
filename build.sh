#!/bin/bash

# Create build logs directory if it doesn't exist
mkdir -p build-logs

pushd src/shared-infra
npm i
popd

pushd src/inventory-service
echo "Building inventory service..."
mvn clean package -DskipTests &>../../build-logs/inventory-service.log
popd

pushd src/user-management-service
echo "Building user management service..."
npm i &>../../build-logs/user-management-service.log
./package.sh &>../../build-logs/user-management-service.log
popd

pushd src/loyalty-point-service
echo "Building loyalty point service..."
npm i &>../../build-logs/loyalty-point-service.log
./package.sh &>../../build-logs/loyalty-point-service.log
popd

pushd src/pricing-service
echo "Building pricing service..."
npm i &>../../build-logs/pricing-service.log
./package.sh &>../../build-logs/pricing-service.log
popd

pushd src/order-service
echo "Building order service..."
dotnet restore &>../../build-logs/order-service.log
popd

pushd src/order-service/src/Orders.BackgroundWorkers
echo "Building order background workers..."
dotnet lambda package &>../../../../build-logs/order-service.log
popd

pushd src/product-management-service
echo "Building product management service..."
make build &>../../build-logs/product-service.log
popd

pushd src/activity-service
echo "Building activity service..."
make dev && make deps && make build &>../../build-logs/activity-service.log
popd
