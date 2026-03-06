//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

module "product_search_service" {
  source                = "./services/product-search"
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  env                   = var.env
  app_version           = var.app_version
  region                = var.region
}
