//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_dynamodb_table" "orders_api" {
  name           = "OrdersService-Orders-${var.env}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "GSI1PK"
    type = "S"
  }
  attribute {
    name = "GSI1SK"
    type = "S"
  }
  global_secondary_index {
    name               = "GSI1"
    hash_key           = "GSI1PK"
    range_key          = "GSI1SK"
    write_capacity     = 5
    read_capacity      = 5
    projection_type    = "ALL"
  }
}