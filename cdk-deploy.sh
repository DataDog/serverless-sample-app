#!/bin/bash

pushd src/shared-infra
npm i
cdk bootstrap
cdk deploy --require-approval never
popd

pushd src/inventory-service/cdk
mvn clean package -DskipTests & cdk deploy --require-approval never &
bg
popd

pushd src/user-management-service
cdk deploy --require-approval never &
bg
popd

pushd src/order-service/cdk
cdk deploy --require-approval never &
bg
popd

pushd src/product-management-service/cdk
cdk deploy --require-approval never &
bg
popd

pushd src/loyalty-point-service/cdk
npm i
cdk deploy --require-approval never &
bg
popd

wait



