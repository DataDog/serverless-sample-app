//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Deploying multiple independent services from a single TF file is not recommended, this is for demonstration purposes only

module "inventory-service" {
  source                = "./services/inventory-service"
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  env                   = var.env
  app_version           = var.app_version
  region                = var.region
}