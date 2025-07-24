//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

variable "env" {
  description = "The current environment."
  type        = string
}

variable "api_name" {
  description = "The name of the HTTP API to create."
  type        = string
}