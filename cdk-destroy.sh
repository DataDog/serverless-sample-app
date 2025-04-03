#!/bin/bash

pushd src/inventory-service/cdk
mvn clean package -DskipTests -q &
cdk destroy --all --force &
bg
popd

pushd src/user-management-service
cdk destroy --all --force &
bg
popd

pushd src/order-service/cdk
cdk destroy --all --force &
bg
popd

pushd src/product-management-service/cdk
cdk destroy --all --force &
bg
popd

pushd src/pricing-service/cdk
cdk destroy --all --force &
bg
popd

pushd src/loyalty-point-service
cdk destroy --all --force &
popd

wait

pushd src/shared-infra
cdk destroy --all --force
popd
