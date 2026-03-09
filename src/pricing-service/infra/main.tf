//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

module "pricing" {
  source                = "./services/pricing"
  dd_api_key            = var.dd_api_key
  dd_site               = var.dd_site
  env                   = var.env
  app_version           = var.app_version
}
