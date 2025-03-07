resource "random_uuid" "secret-access-key" {
}

resource "aws_ssm_parameter" "jwt_secret_access_key" {
  name  = "/${var.env}/shared/secret-access-key"
  value = random_uuid.secret-access-key.result
  type  = "SecureString"
}

resource "aws_secretsmanager_secret" "dd_api_key_secret" {
  name = "/${var.env}/shared/serverless-sample-dd-api-key"
}

resource "aws_secretsmanager_secret_version" "example" {
  secret_id     = aws_secretsmanager_secret.dd_api_key_secret.id
  secret_string = var.dd_api_key
}