#!/bin/bash

pushd src/inventory-service/cdk
mvn clean package -DskipTests &
cdk destroy --require-approval never &
bg
popd

pushd src/user-management-service
cdk destroy --require-approval never &
bg
popd

pushd src/order-service/cdk
cdk destroy --require-approval never &
bg
popd

pushd src/product-management-service/cdk
cdk destroy --require-approval never &
bg
popd

pushd src/loyalty-point-service
cdk destroy --require-approval never &
popd

wait

pushd src/shared-infra
cdk destroy
popd
