#!/bin/bash

# Create build logs directory if it doesn't exist
mkdir -p build-logs

pushd src/shared-infra
npm i
popd

pushd src/inventory-service
echo "Building inventory service..."
mvn clean package -DskipTests
popd

pushd src/user-management-service
echo "Building user management service..."
npm i
./package.sh
popd

pushd src/loyalty-point-service
echo "Building loyalty point service..."
npm i
./package.sh
popd

pushd src/pricing-service
echo "Building pricing service..."
npm i
./package.sh
popd

pushd src/order-service
echo "Building order service..."
dotnet restore
popd

pushd src/order-service/src/Orders.BackgroundWorkers
echo "Building order background workers..."
dotnet lambda package
popd

pushd src/product-management-service
echo "Building product management service..."
make build
popd

pushd src/activity-service
echo "Building activity service..."
make dev && make deps && make build
popd
