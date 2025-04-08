#!/bin/bash

# Create logs directory if it doesn't exist
mkdir -p deployment-logs

# Shared infra deployment
pushd src/shared-infra
npm i
cdk bootstrap
cdk deploy --require-approval never
popd

# Service deployments in parallel
pushd src/inventory-service/cdk
mvn clean package -DskipTests -q
cdk deploy --require-approval never &>../../../deployment-logs/inventory-service.log &
popd

pushd src/user-management-service
npm i
cdk deploy --require-approval never &>../../deployment-logs/user-management-service.log &
popd

pushd src/order-service/cdk
cdk deploy --require-approval never &>../../../deployment-logs/order-service.log &
popd

pushd src/product-management-service/cdk
cdk deploy --require-approval never &>../../../deployment-logs/product-management-service.log &
popd

pushd src/loyalty-point-service
npm i
./package.sh
cdk deploy --require-approval never &>../../deployment-logs/loyalty-point-service.log &
popd

# Print deployment status
echo "Deployment complete. Check logs in deployment-logs directory"
ls -l deployment-logs/
