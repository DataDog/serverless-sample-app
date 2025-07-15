//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

variable "api_name" {
  type        = string
  description = "Name of the HTTP API Gateway"
}

variable "service_name" {
  type        = string
  description = "Name of the service"
}

variable "stage_name" {
  type        = string
  description = "Name of the API stage"
  default     = "$default"
}

variable "stage_auto_deploy" {
  type        = bool
  description = "Whether to automatically deploy changes"
  default     = true
}

variable "env" {
  type        = string
  description = "Environment name"
}