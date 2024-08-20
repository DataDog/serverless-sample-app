#!/bin/bash

mvn clean package
cd infra
terraform apply --var-file dev.tfvars