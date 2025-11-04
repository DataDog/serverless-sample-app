#!/bin/bash

# Create logs directory if it doesn't exist
mkdir -p deployment-logs

# Shared infra deployment - run in foreground
echo "Starting shared infrastructure deployment..."
pushd src/shared-infra
npm i
cdk bootstrap
cdk deploy --require-approval never
popd
echo "Shared infrastructure deployment complete"

# Service deployments in parallel - run in background
echo "Starting service deployments in background..."

# Inventory service
pushd src/inventory-service/cdk
  # Append cdk deploy output to the same log file
cdk deploy --require-approval never &>../../../deployment-logs/inventory-service.log &
popd

# User management service
pushd src/user-management-service
cdk deploy --require-approval never &>../../deployment-logs/user-management-service.log &
popd

# Order service
pushd src/order-service/cdk
cdk deploy --require-approval never &>../../../deployment-logs/order-service.log &
popd

# Product management service
pushd src/product-management-service/cdk
cdk deploy --require-approval never &>../../../deployment-logs/product-management-service.log &
popd

# Loyalty point service
pushd src/loyalty-point-service
cdk deploy --require-approval never &>../../deployment-logs/loyalty-point-service.log &
popd

# pushd src/activity-service
# make dev && make deps && cdk deploy --require-approval=never &>../../deployment-logs/activity-service.log &
# popd

echo "All service deployments started in background"
echo "You can check deployment progress in the deployment-logs directory"