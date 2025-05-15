#!/bin/bash

# Create build logs directory if it doesn't exist
mkdir -p build-logs

pushd src/shared-infra
npm i
popd

pushd src/inventory-service
mvn clean package -DskipTests &>../../build-logs/inventory-service.log
popd

pushd src/user-management-service
npm i &>../../build-logs/user-management-service.log
./package.sh &>../../build-logs/user-management-service.log
popd

pushd src/loyalty-point-service
npm i &>../../build-logs/loyalty-point-service.log
./package.sh &>../../build-logs/loyalty-point-service.log
popd

pushd src/pricing-service
npm i &>../../build-logs/pricing-service.log
./package.sh &>../../build-logs/pricing-service.log
popd

pushd src/order-service
dotnet restore &>../../build-logs/order-service.log
popd

pushd src/order-service/src/Orders.BackgroundWorkers
dotnet lambda package &>../../../build-logs/order-service.log
popd

pushd src/product-management-service
make build &>../../build-logs/product-service.log
popd
