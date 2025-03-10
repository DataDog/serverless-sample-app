#!/bin/bash

pushd src/inventory-service
make build
popd

pushd src/user-management-service
make build
popd

pushd src/product-management-service
make build
popd

