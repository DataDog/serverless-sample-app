//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "function_arn" {
  value       =  module.aws_lambda_function.arn
  description = "The arn of the lambda function."
} 

output "function_invoke_arn" {
  value       =  module.aws_lambda_function.invoke_arn
  description = "The invoke ARN of the lambda function."
} 

output "function_name" {
  value       =  module.aws_lambda_function.function_name
  description = "The name of the lambda function."
} 

output function_role_arn {
    value = aws_iam_role.lambda_function_role.arn
} 

output function_role_name {
    value = aws_iam_role.lambda_function_role.name
}

output "common_layer_arn" {
  value = var.layer_zip_file != null ? aws_lambda_layer_version.common_layer[0].arn : null
}