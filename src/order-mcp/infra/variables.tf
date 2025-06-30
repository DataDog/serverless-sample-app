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
  description = "The Datadog site to use"
  default     = "datadoghq.com"
}

variable "env" {
  type        = string
  description = "The deployment environment"
}

variable "app_version" {
  type        = string
  description = "The version of the application being deployed"
  default     = "latest"
}

variable "region" {
  type        = string
  description = "The AWS region to deploy to"
}

variable "tf_state_bucket_name" {
  type    = string
  default = "The name of the S3 bucket to store state"
}
