//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.61"
    }
  }
#  backend "s3" {
#    bucket = "<your unique bucket name>"
#    key    = "my_lambda/terraform.tfstate"
#    region = "eu-central-1"
#  }
}

provider "aws" {
  region = "eu-west-1"
}