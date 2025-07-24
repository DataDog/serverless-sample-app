//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# IAM policy for JWT secret access
resource "aws_iam_policy" "get_jwt_ssm_parameter" {
  name = "OrderMcpService-GetJWTSSMParameter-${var.env}"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ],
        Effect : "Allow",
        Resource : [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/shared/secret-access-key",
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/OrderMcpService/secret-access-key"
        ]
      }
    ]
  })
}

# IAM policy for SSM parameter access to external services
resource "aws_iam_policy" "ssm_external_services_access" {
  name = "OrderMcpService-SSMExternalServicesAccess-${var.env}"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ],
        Effect : "Allow",
        Resource : [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/OrdersService/api-endpoint",
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/ProductService/api-endpoint",
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/Users/api-endpoint",
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/OrderMcpService/api-endpoint"
        ]
      }
    ]
  })
}

# IAM policy for KMS decryption (SSM parameter encryption)
resource "aws_iam_policy" "kms_ssm_decrypt" {
  name = "OrderMcpService-KMSSSMDecrypt-${var.env}"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
          "kms:Decrypt"
        ],
        Effect : "Allow",
        Resource : "arn:aws:kms:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:alias/aws/ssm"
      }
    ]
  })
}

# IAM policy for EventBridge publishing
resource "aws_iam_policy" "eb_publish" {
  name = "OrderMcpService-EventBridgePublish-${var.env}"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
          "events:PutEvents"
        ],
        Effect : "Allow",
        Resource : [
          aws_cloudwatch_event_bus.order_mcp_service_bus.arn,
          # For integrated environments, also allow publishing to shared bus
          var.env == "dev" || var.env == "prod" ? "arn:aws:events:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:event-bus/*" : "arn:aws:events:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:event-bus/default"
        ]
      }
    ]
  })
}

# Data source for current region and account ID
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}