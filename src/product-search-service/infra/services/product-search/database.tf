//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_dynamodb_table" "product_search_metadata_table" {
  name         = "ProductSearchMetadata-${var.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "productId"

  attribute {
    name = "productId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = false

  tags = {
    Name        = "ProductSearchMetadata-${var.env}"
    Environment = var.env
    Service     = "ProductSearchService"
  }
}
