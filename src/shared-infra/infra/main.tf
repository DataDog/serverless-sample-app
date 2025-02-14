//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Deploying multiple independent services from a single TF file is not recommended, this is for demonstration purposes only

module "shared" {
  source = "./services/shared"
  env    = var.env
}