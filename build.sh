#!/bin/bash

pushd src/inventory-service
mvn clean package -DskipTests
popd

pushd src/user-management-service
./package.sh
popd

pushd src/product-management-service
make build
popd

