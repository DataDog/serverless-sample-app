resource "random_uuid" "secret-access-key" {
}

resource "aws_ssm_parameter" "jwt_secret_access_key" {
  name  = "/${var.env}/shared/secret-access-key"
  value = random_uuid.secret-access-key.result
  type  = "SecureString"
}
