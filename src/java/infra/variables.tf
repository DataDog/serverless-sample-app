//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

variable "dd_api_key_secret_arn" {
  type        = string
  description = "The ARN of the Datadog API key secret"
}

variable "dd_site" {
  type = string
  description = "The Datadog site to use"
  default = "datadoghq.com"
}

variable "env" {
  type = string
  description = "The environment to deploy to"
  default = "dev"
}

variable "region" {
  type = string
  description = "The AWS region to deploy to"
}

variable "tf_state_bucket_name" {
  type = string
  default = "The name of the S3 bucket to store state"
}