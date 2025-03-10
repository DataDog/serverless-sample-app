#!/bin/bash

pushd src/inventory-service
mvn clean package -DskipTests
bg
popd

pushd src/user-management-service
cargo build --release
bg
popd

pushd src/product-management-service
make build
bg
popd

