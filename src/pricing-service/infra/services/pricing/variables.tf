//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

variable "dd_api_key" {
  type        = string
  description = "The Datadog API key"
}

variable "dd_site" {
  type        = string
  description = "The Datadog site"
}

variable "env" {
  type        = string
  description = "The environment deploying to"
}

variable "app_version" {
  type        = string
  description = "The deployed version of the application"
  default     = "latest"
}
