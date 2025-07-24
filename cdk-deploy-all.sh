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
pushd src/inventory-service
mvn clean package -DskipTests -q
popd
pushd  src/inventory-service/cdk
cdk deploy --require-approval never &>../../../deployment-logs/inventory-service.log &
popd

pushd src/user-management-service
npm i
cdk deploy --require-approval never &>../../deployment-logs/user-management-service.log &
popd

pushd src/pricing-service
npm i
cdk deploy --require-approval never &>../../deployment-logs/pricing-service.log &
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

pushd src/activity-service
pip install --upgrade pip pre-commit poetry
pre-commit install
poetry config --local virtualenvs.in-project true
poetry install --no-root
npm ci
poetry export --only=dev --format=requirements.txt > dev_requirements.txt
poetry export --without=dev --format=requirements.txt > lambda_requirements.txt
rm -rf .build
mkdir -p .build/lambdas ; cp -r activity_service .build/lambdas
mkdir -p .build/common_layer ; poetry export --without=dev --format=requirements.txt > .build/common_layer/requirements.txt
cdk deploy --require-approval=never &>../../deployment-logs/activity-service.log &
popd

# Print deployment status
echo "Deployment complete. Check logs in deployment-logs directory"
ls -l deployment-logs/
