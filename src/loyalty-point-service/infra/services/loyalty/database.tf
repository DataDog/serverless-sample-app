//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_dynamodb_table" "loyalty_table" {
  name             = "LoyaltyService-accounts-${var.env}"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "PK"
    type = "S"
  }
}
