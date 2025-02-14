data "aws_secretsmanager_secret" "api_key_secret" {
  arn = var.dd_api_key_secret_arn
}

data "aws_secretsmanager_secret_version" "current_api_key_secret" {
  secret_id = data.aws_secretsmanager_secret.api_key_secret.id
}
