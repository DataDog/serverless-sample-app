#!/bin/bash

pushd src/shared-infra
npm i
popd

pushd src/inventory-service
mvn clean package -DskipTests
popd

pushd src/user-management-service
npm i
popd

pushd src/loyalty-point-service
npm i
popd

pushd src/user-management-service
./package.sh
popd

pushd src/product-management-service
make build
popd

