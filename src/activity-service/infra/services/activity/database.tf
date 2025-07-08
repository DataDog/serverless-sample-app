//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Main activities table
resource "aws_dynamodb_table" "activities_table" {
  name             = "Activities-${var.env}"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"
  range_key        = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = false

  tags = {
    Name        = "Activities-${var.env}"
    Environment = var.env
    Service     = "ActivityService"
  }
}

# Idempotency table for Lambda Powertools
resource "aws_dynamodb_table" "idempotency_table" {
  name         = "ActivitiesIdempotency-${var.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  ttl {
    attribute_name = "expiration"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = false

  tags = {
    Name        = "ActivitiesIdempotency-${var.env}"
    Environment = var.env
    Service     = "ActivityService"
  }
}