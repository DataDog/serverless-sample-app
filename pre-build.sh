#!/bin/bash

# Create logs directory if it doesn't exist
mkdir -p build-logs

# Shared infra build - run in foreground
echo "Starting shared infrastructure build..."
pushd src/shared-infra
npm i
popd
echo "Shared infrastructure build complete"

# Service builds in parallel - run in background
echo "Starting service builds in background..."

# Inventory service
pushd src/inventory-service/cdk
# Redirect all output from mvn to the log file
mvn clean package -DskipTests &>../../../build-logs/inventory-service.log
# Append cdk deploy output to the same log file
cdk synth &>../../../build-logs/inventory-service.log
popd

# User management service
pushd src/user-management-service
npm i &>../../build-logs/user-management-service.log
cdk synth &>../../build-logs/user-management-service.log
popd

# Order service
pushd src/order-service/cdk
cdk synth &>../../../build-logs/order-service.log
popd

# Product management service
pushd src/product-management-service/cdk
cdk synth &>../../../build-logs/product-management-service.log
popd

# Loyalty point service
pushd src/loyalty-point-service
npm i &>../../build-logs/loyalty-point-service.log
./package.sh &>../../build-logs/loyalty-point-service.log
cdk synth &>../../build-logs/loyalty-point-service.log
popd

# Pricing service
pushd src/pricing-service
npm i &>../../build-logs/pricing-service.log
./package.sh &>../../build-logs/pricing-service.log
cdk synth &>../../build-logs/pricing-service.log
popd

echo "All service builds started in background"
echo "You can check build progress in the build-logs directory"
