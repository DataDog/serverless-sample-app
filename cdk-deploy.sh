#!/bin/bash

pushd src/shared-infra
cdk deploy
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
cdk deploy --require-approval never &
bg
popd

wait



